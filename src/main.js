import './style.css';
import { createEditor } from './editor/editor.js';
import { CircuitRenderer } from './circuit/renderer.js';
import { transpile } from './editor/transpiler.js';
import { createArduinoRuntime } from './simulator/arduino-api.js';
import { createExecutor } from './simulator/executor.js';
import { createSerialMonitor } from './ui/serial-monitor.js';
import { createComponentPalette } from './ui/component-palette.js';

const editor = createEditor(document.getElementById('code-editor'));
const renderer = new CircuitRenderer(document.getElementById('circuit-canvas'));
const serialMonitor = createSerialMonitor(document.getElementById('serial-output'));
createComponentPalette(document.getElementById('component-palette'), (type, id, x, y) => {
  renderer.addComponent(type, id, x, y);
});

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

window.arduinoSimulator = { editor, renderer };
