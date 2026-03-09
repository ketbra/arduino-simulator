import './style.css';
import { createEditor } from './editor/editor.js';
import { CircuitRenderer } from './circuit/renderer.js';
import { transpile } from './editor/transpiler.js';
import { createArduinoRuntime } from './simulator/arduino-api.js';
import { createExecutor } from './simulator/executor.js';
import { createSerialMonitor } from './ui/serial-monitor.js';
import { createComponentPalette } from './ui/component-palette.js';
import { ConnectionGraph } from './circuit/connection-graph.js';
import { WiringSystem } from './circuit/wiring.js';
import { projects } from './projects/index.js';
import { CircuitBridge } from './simulator/circuit-bridge.js';
import { LED, RgbLed } from './circuit/components/index.js';
import { createUndoManager } from './ui/undo-manager.js';

// --- Dirty State (Feature 4) ---
let dirty = false;
function markDirty() { dirty = true; scheduleSave(); }
function clearDirty() { dirty = false; }

// --- Undo/Redo (Feature 3) - must be before editor/palette setup ---
const undoManager = createUndoManager();

// --- Editor Setup (with onChange for dirty tracking, Feature 4) ---
const editor = createEditor(document.getElementById('code-editor'), {
  onChange: () => {
    markDirty();
    undoManager.push({ type: 'code-change' });
  },
});
const renderer = new CircuitRenderer(document.getElementById('circuit-canvas'));
const serialMonitor = createSerialMonitor(document.getElementById('serial-output'));
createComponentPalette(document.getElementById('component-palette'), (type, id, x, y) => {
  renderer.addComponent(type, id, x, y);
  // Register component models so CircuitBridge can update visuals
  if (type === 'led') componentModels.set(id, new LED(id));
  if (type === 'rgb-led') componentModels.set(id, new RgbLed(id));
  // Connect resistor pins internally so BFS can traverse through them
  if (type === 'resistor') connectionGraph.addWire(`component:${id}:pin1`, `component:${id}:pin2`);
  undoManager.push({ type: 'add-component', data: { type, id, x, y } });
  markDirty();
});

const connectionGraph = new ConnectionGraph();
const wiring = new WiringSystem(
  document.getElementById('circuit-canvas'),
  renderer,
  connectionGraph
);

const componentModels = new Map();

// Evaluate static power rail connections (5V/GND directly to LEDs)
const POWER_NODES = ['arduino:5V', 'arduino:3V3'];
const GND_NODES = ['arduino:GND', 'arduino:GND2'];

function evaluateStaticConnections() {
  for (const [id, model] of componentModels) {
    if (model.type === 'led') {
      const anodeConnected = connectionGraph.getConnectedNodes(`component:${id}:anode`);
      const cathodeConnected = connectionGraph.getConnectedNodes(`component:${id}:cathode`);
      const allConnected = [...anodeConnected, ...cathodeConnected];

      const hasPower = allConnected.some((n) => POWER_NODES.includes(n));
      const hasGnd = allConnected.some((n) => GND_NODES.includes(n));

      if (hasPower && hasGnd) {
        const hasResistor = allConnected.some((n) => /^component:(r\d+|resistor-\d+):/.test(n));
        const anodeHasPower = anodeConnected.some((n) => POWER_NODES.includes(n));
        model.update({ anode: anodeHasPower ? 1 : 0, cathode: anodeHasPower ? 0 : 1 }, { hasResistor });
        renderer.updateLed(id, model.brightness, model.burnedOut);
      } else if (!model.burnedOut && model.brightness > 0) {
        // Circuit broken — turn off
        model.brightness = 0;
        renderer.updateLed(id, model.brightness, model.burnedOut);
      }
    }
  }
}

wiring.onWireAdded = () => evaluateStaticConnections();

let runtime = null;
let executor = null;

const btnRun = document.getElementById('btn-run');
const btnStep = document.getElementById('btn-step');
const btnStop = document.getElementById('btn-stop');
const btnSchematic = document.getElementById('mode-schematic');
const btnBreadboard = document.getElementById('mode-breadboard');
const distanceSlider = document.getElementById('distance-slider');
const distanceValue = document.getElementById('distance-value');

btnSchematic.addEventListener('click', () => {
  renderer.setMode('schematic');
  btnSchematic.classList.add('active');
  btnBreadboard.classList.remove('active');
});

btnBreadboard.addEventListener('click', () => {
  renderer.setMode('breadboard');
  btnBreadboard.classList.add('active');
  btnSchematic.classList.remove('active');
});

distanceSlider.addEventListener('input', () => {
  distanceValue.textContent = distanceSlider.value;
  if (runtime) runtime.setSensorDistance(Number(distanceSlider.value));
});

async function compileAndSetup() {
  serialMonitor.clear();
  runtime = createArduinoRuntime();
  runtime.setSensorDistance(Number(distanceSlider.value));
  runtime.on('serialData', (text) => serialMonitor.append(text));
  executor = createExecutor(runtime);
  executor.setLineCallback((line) => editor.highlightLine(line));
  new CircuitBridge(runtime, renderer, connectionGraph, componentModels);
  const code = transpile(editor.getCode());
  await executor.loadAndRunSetup(code);
}

btnRun.addEventListener('click', async () => {
  try {
    if (executor && executor.isStepping()) {
      // Switch from stepping to continuous
      executor.stop();
      executor.startLoop(50);
    } else {
      await compileAndSetup();
      executor.startLoop(50);
    }
    btnRun.disabled = true;
    btnStep.disabled = false;
    btnStep.textContent = 'Step';
    btnStop.disabled = false;
  } catch (e) {
    serialMonitor.append(`Error: ${e.message}\n`);
  }
});

btnStep.addEventListener('click', async () => {
  try {
    if (executor && executor.isRunning() && !executor.isStepping()) {
      // Switch from running to stepping
      executor.stop();
      await compileAndSetup();
      executor.startStepping();
      btnRun.disabled = false;
      btnStep.textContent = 'Next';
      btnStop.disabled = false;
    } else if (!executor || !executor.isCompiled()) {
      // Fresh start in step mode
      await compileAndSetup();
      executor.startStepping();
      btnRun.disabled = false;
      btnStep.textContent = 'Next';
      btnStop.disabled = false;
    } else if (executor.isStepping()) {
      // Advance one step
      executor.step();
    }
  } catch (e) {
    serialMonitor.append(`Error: ${e.message}\n`);
  }
});

btnStop.addEventListener('click', () => {
  if (executor) executor.stop();
  executor = null;
  editor.clearHighlight();
  btnRun.disabled = false;
  btnStep.disabled = false;
  btnStep.textContent = 'Step';
  btnStop.disabled = true;
});

// --- Project Loader ---

function getPinCoords(pinId) {
  const pinEl = renderer.svg.querySelector(`[data-pin="${pinId}"]`);
  if (!pinEl) return null;

  // Get local coordinates: circles have cx/cy, groups contain a rect child
  let cx, cy;
  if (pinEl.tagName === 'circle') {
    cx = parseFloat(pinEl.getAttribute('cx'));
    cy = parseFloat(pinEl.getAttribute('cy'));
  } else {
    // For <g> elements (Arduino pins), find the child rect and compute its center
    const rect = pinEl.querySelector('rect');
    if (rect) {
      cx = parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width')) / 2;
      cy = parseFloat(rect.getAttribute('y')) + parseFloat(rect.getAttribute('height')) / 2;
    } else {
      return null;
    }
  }

  // Walk up to accumulate parent translate transforms
  let el = pinEl.tagName === 'circle' ? pinEl.parentElement : pinEl;
  let tx = 0, ty = 0;
  while (el && el !== renderer.svg) {
    const transform = el.getAttribute('transform');
    if (transform) {
      const match = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/);
      if (match) {
        tx += parseFloat(match[1]);
        ty += parseFloat(match[2]);
      }
    }
    el = el.parentElement;
  }
  return { x: cx + tx, y: cy + ty };
}

// Wires follow components when dragged
renderer._onDragEnd = () => renderer.refreshWires(getPinCoords);

// Push button toggle - connect/disconnect pins when clicked
renderer.svg.addEventListener('buttonToggle', (e) => {
  const { id, pressed } = e.detail;
  const pin1 = `component:${id}:pin1a`;
  const pin2 = `component:${id}:pin2a`;
  if (pressed) {
    connectionGraph.addWire(pin1, pin2);
  } else {
    connectionGraph.removeWire(pin1, pin2);
  }
  // Re-evaluate circuit after topology change
  evaluateStaticConnections();
  if (runtime) {
    // Re-trigger pin change events for all active output pins
    for (let p = 0; p <= 13; p++) {
      const state = runtime.getPinState(p);
      if (state !== undefined) {
        runtime.emit('pinChange', p, state, runtime.getPinMode(p));
      }
    }
  }
});

function loadProject(project) {
  // 1. Stop any running code
  if (executor) executor.stop();
  btnRun.disabled = false;
  btnStop.disabled = true;

  // 2. Set code in editor
  editor.setCode(project.code);

  // 3. Clear circuit, graph, and models
  renderer.clear();
  wiring.clear();
  connectionGraph.clear();
  componentModels.clear();

  // 4. Place components and add internal connections
  for (const comp of project.components) {
    renderer.addComponent(comp.type, comp.id, comp.x, comp.y);
    if (comp.type === 'led') componentModels.set(comp.id, new LED(comp.id));
    if (comp.type === 'rgb-led') componentModels.set(comp.id, new RgbLed(comp.id));
    // Resistors are pass-through: pin1 and pin2 are internally connected
    if (comp.type === 'resistor') {
      connectionGraph.addWire(`component:${comp.id}:pin1`, `component:${comp.id}:pin2`);
    }
  }

  // 5. Add wires (store pin IDs so wires follow components when dragged)
  for (const wire of project.wires) {
    const fromPos = getPinCoords(wire.from);
    const toPos = getPinCoords(wire.to);
    if (fromPos && toPos) {
      renderer.addWire(fromPos.x, fromPos.y, toPos.x, toPos.y, wire.color, wire.from, wire.to);
    }
    connectionGraph.addWire(wire.from, wire.to);
  }

  clearDirty();
}

// --- Undo/Redo wiring ---

// Report drag completion for undo
renderer._onDragComplete = (info) => {
  undoManager.push({ type: 'move-component', data: info });
  markDirty();
};

function handleUndo(result) {
  if (!result) return;
  const { type, action } = result;
  const isUndo = type === 'undo';

  switch (action.type) {
    case 'add-component': {
      if (isUndo) {
        renderer.deleteComponent(action.data.id);
        wiring.removeWiresForComponent(action.data.id);
        componentModels.delete(action.data.id);
      } else {
        const { type: compType, id, x, y } = action.data;
        renderer.addComponent(compType, id, x, y);
      }
      break;
    }
    case 'remove-component': {
      if (isUndo) {
        // Re-add the component and its wires
        const { component, wires: removedWires } = action.data;
        renderer.addComponent(component.type, component.id, component.x, component.y);
        for (const w of removedWires) {
          const fromPos = getPinCoords(w.from);
          const toPos = getPinCoords(w.to);
          if (fromPos && toPos) {
            renderer.addWire(fromPos.x, fromPos.y, toPos.x, toPos.y, w.color, w.from, w.to);
          }
          connectionGraph.addWire(w.from, w.to);
        }
      } else {
        renderer.deleteComponent(action.data.component.id);
        wiring.removeWiresForComponent(action.data.component.id);
      }
      break;
    }
    case 'add-wire': {
      if (isUndo) {
        // Find and remove the wire
        const w = renderer.wires.find(
          (wire) => wire.dataset.fromPin === action.data.from && wire.dataset.toPin === action.data.to
        );
        if (w) {
          renderer.deleteWire(w);
          wiring.removeWire(w);
          connectionGraph.removeWire(action.data.from, action.data.to);
        }
      } else {
        const { from, to, color } = action.data;
        const fromPos = getPinCoords(from);
        const toPos = getPinCoords(to);
        if (fromPos && toPos) {
          renderer.addWire(fromPos.x, fromPos.y, toPos.x, toPos.y, color, from, to);
        }
        connectionGraph.addWire(from, to);
      }
      break;
    }
    case 'remove-wire': {
      if (isUndo) {
        const { from, to, color } = action.data;
        const fromPos = getPinCoords(from);
        const toPos = getPinCoords(to);
        if (fromPos && toPos) {
          renderer.addWire(fromPos.x, fromPos.y, toPos.x, toPos.y, color, from, to);
        }
        connectionGraph.addWire(from, to);
      } else {
        const w = renderer.wires.find(
          (wire) => wire.dataset.fromPin === action.data.from && wire.dataset.toPin === action.data.to
        );
        if (w) {
          renderer.deleteWire(w);
          wiring.removeWire(w);
          connectionGraph.removeWire(action.data.from, action.data.to);
        }
      }
      break;
    }
    case 'move-component': {
      const { id, fromX, fromY, toX, toY } = action.data;
      if (isUndo) {
        renderer.moveComponent(id, fromX, fromY);
      } else {
        renderer.moveComponent(id, toX, toY);
      }
      renderer.refreshWires(getPinCoords);
      break;
    }
    // code-change: we don't reverse code changes since tracking full text diffs is heavy
    default:
      break;
  }
  markDirty();
}

// --- Context Menu & Deletion (Feature 1) ---
const contextMenu = document.getElementById('context-menu');
const ctxDeleteBtn = document.getElementById('ctx-delete');

function hideContextMenu() {
  if (contextMenu) contextMenu.style.display = 'none';
}

function showContextMenu(x, y, label, onDelete) {
  if (!contextMenu || !ctxDeleteBtn) return;
  ctxDeleteBtn.textContent = label;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.style.display = 'block';
  ctxDeleteBtn.onclick = () => {
    onDelete();
    hideContextMenu();
  };
}

// Hide context menu on click elsewhere
document.addEventListener('click', () => hideContextMenu());

// Right-click on SVG elements
renderer.svg.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  hideContextMenu();

  // Check if right-clicked on a wire
  if (e.target.tagName === 'line' && renderer.wires.includes(e.target)) {
    renderer.selectWire(e.target);
    showContextMenu(e.clientX, e.clientY, 'Delete Wire', () => {
      deleteSelectedWire(e.target);
    });
    return;
  }

  // Check if right-clicked on a component
  const compEl = e.target.closest('[transform]');
  if (compEl) {
    for (const [id, comp] of renderer.components) {
      if (comp.el === compEl || comp.el.contains(e.target)) {
        renderer.selectComponent(id);
        showContextMenu(e.clientX, e.clientY, 'Delete', () => {
          deleteSelectedComponent(id);
        });
        return;
      }
    }
  }
});

function deleteSelectedComponent(id) {
  const result = renderer.deleteComponent(id);
  if (result) {
    wiring.removeWiresForComponent(id);
    // Also remove from connection graph
    for (const w of result.wires) {
      connectionGraph.removeWire(w.from, w.to);
    }
    componentModels.delete(id);
    undoManager.push({ type: 'remove-component', data: result });
    markDirty();
  }
}

function deleteSelectedWire(wireEl) {
  const info = renderer.deleteWire(wireEl);
  if (info) {
    wiring.removeWire(wireEl);
    connectionGraph.removeWire(info.from, info.to);
    undoManager.push({ type: 'remove-wire', data: info });
    markDirty();
  }
}

// Delete key handler
document.addEventListener('keydown', (e) => {
  // Undo/Redo (Feature 3)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    handleUndo(undoManager.undo());
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z'))) {
    e.preventDefault();
    handleUndo(undoManager.redo());
    return;
  }

  // Delete/Backspace to delete selected (Feature 1)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Don't intercept if typing in an input/editor
    if (e.target.closest('#code-editor') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (renderer.selectedComponent) {
      deleteSelectedComponent(renderer.selectedComponent);
    } else if (renderer.selectedWire) {
      deleteSelectedWire(renderer.selectedWire);
    }
  }
});

// --- Wire click selection (Feature 1) ---
renderer.svg.addEventListener('click', (e) => {
  if (e.target.tagName === 'line' && renderer.wires.includes(e.target)) {
    renderer.selectWire(e.target);
  }
});

// --- Save/Load (Feature 2) ---
const STORAGE_KEY = 'arduino-sim-project';
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProject(), 2000);
}

function serializeProject() {
  const components = [];
  for (const [id, comp] of renderer.components) {
    components.push({ type: comp.type, id, x: comp.x, y: comp.y });
  }
  const wires = [];
  for (const wire of renderer.wires) {
    wires.push({
      from: wire.dataset.fromPin || '',
      to: wire.dataset.toPin || '',
      color: wire.getAttribute('stroke'),
    });
  }
  return {
    code: editor.getCode(),
    components,
    wires,
  };
}

function saveProject() {
  const data = serializeProject();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  clearDirty();
}

function loadSavedProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    loadProject(data);
  } catch (e) {
    // Ignore corrupt data
  }
}

const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');

if (btnSave) {
  btnSave.addEventListener('click', () => {
    saveProject();
  });
}

if (btnLoad) {
  btnLoad.addEventListener('click', () => {
    if (dirty && !confirm('You have unsaved changes. Discard and load?')) return;
    loadSavedProject();
  });
}

// --- Example Select (with dirty warning, Feature 4) ---
const exampleSelect = document.getElementById('example-select');
if (exampleSelect) {
  projects.forEach((project, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = project.name;
    exampleSelect.appendChild(option);
  });

  exampleSelect.addEventListener('change', () => {
    const index = exampleSelect.value;
    if (index !== '' && projects[index]) {
      if (dirty && !confirm('You have unsaved changes. Discard and load example?')) {
        exampleSelect.value = '';
        return;
      }
      loadProject(projects[index]);
    }
  });
}

// Help overlay
const btnHelp = document.getElementById('btn-help');
const helpOverlay = document.getElementById('help-overlay');
btnHelp.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
document.getElementById('help-close').addEventListener('click', () => { helpOverlay.style.display = 'none'; });
helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) helpOverlay.style.display = 'none'; });

window.arduinoSimulator = { editor, renderer, wiring, connectionGraph };
