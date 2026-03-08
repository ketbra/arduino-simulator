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

const editor = createEditor(document.getElementById('code-editor'));
const renderer = new CircuitRenderer(document.getElementById('circuit-canvas'));
const serialMonitor = createSerialMonitor(document.getElementById('serial-output'));
createComponentPalette(document.getElementById('component-palette'), (type, id, x, y) => {
  renderer.addComponent(type, id, x, y);
});

const connectionGraph = new ConnectionGraph();
const wiring = new WiringSystem(
  document.getElementById('circuit-canvas'),
  renderer,
  connectionGraph
);

const componentModels = new Map();

let runtime = null;
let executor = null;

const btnRun = document.getElementById('btn-run');
const btnStop = document.getElementById('btn-stop');
const distanceSlider = document.getElementById('distance-slider');
const distanceValue = document.getElementById('distance-value');

distanceSlider.addEventListener('input', () => {
  distanceValue.textContent = distanceSlider.value;
  if (runtime) runtime.setSensorDistance(Number(distanceSlider.value));
});

btnRun.addEventListener('click', async () => {
  serialMonitor.clear();
  runtime = createArduinoRuntime();
  runtime.setSensorDistance(Number(distanceSlider.value));
  runtime.on('serialData', (text) => serialMonitor.append(text));
  executor = createExecutor(runtime);
  new CircuitBridge(runtime, renderer, connectionGraph, componentModels);

  const code = transpile(editor.getCode());

  try {
    await executor.loadAndRunSetup(code);
    executor.startLoop(50);
    btnRun.disabled = true;
    btnStop.disabled = false;
  } catch (e) {
    serialMonitor.append(`Error: ${e.message}\n`);
  }
});

btnStop.addEventListener('click', () => {
  if (executor) executor.stop();
  btnRun.disabled = false;
  btnStop.disabled = true;
});

// --- Project Loader ---

function getPinCoords(pinId) {
  const pinEl = renderer.svg.querySelector(`[data-pin="${pinId}"]`);
  if (!pinEl) return null;
  const cx = parseFloat(pinEl.getAttribute('cx'));
  const cy = parseFloat(pinEl.getAttribute('cy'));
  // Walk up to find the parent group's translate transform
  let el = pinEl.parentElement;
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

function loadProject(project) {
  // 1. Stop any running code
  if (executor) executor.stop();
  btnRun.disabled = false;
  btnStop.disabled = true;

  // 2. Set code in editor
  editor.setCode(project.code);

  // 3. Clear circuit
  renderer.clear();
  wiring.clear();

  // 4. Place components
  for (const comp of project.components) {
    renderer.addComponent(comp.type, comp.id, comp.x, comp.y);
  }

  // 5. Add wires
  for (const wire of project.wires) {
    const fromPos = getPinCoords(wire.from);
    const toPos = getPinCoords(wire.to);
    if (fromPos && toPos) {
      renderer.addWire(fromPos.x, fromPos.y, toPos.x, toPos.y, wire.color);
    }
    connectionGraph.addWire(wire.from, wire.to);
  }
}

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
      loadProject(projects[index]);
    }
  });
}

window.arduinoSimulator = { editor, renderer, wiring, connectionGraph };
