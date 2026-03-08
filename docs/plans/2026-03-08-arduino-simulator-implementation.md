# Arduino Simulator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based Arduino simulator where students drag-and-drop components onto a virtual breadboard, write Arduino-like JavaScript code, and see simulated circuit behavior.

**Architecture:** Single-page app with three panels (code editor, circuit workspace, serial monitor). SVG-based circuit rendering with a connection graph tracking electrical connectivity. Arduino API compatibility layer executes user code via async/await with simulated delays. Lightweight transpiler converts Arduino C syntax to JavaScript.

**Tech Stack:** Vite, vanilla JS (no framework), CodeMirror 6, SVG for circuit rendering, Playwright for testing.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`
- Create: `.gitignore`

**Step 1: Initialize Vite project**

```bash
cd /home/mfeinber/src/javascript/arduino_simulator
npm create vite@latest . -- --template vanilla
```

If the directory is not empty, you may need to confirm overwrite. Select vanilla JS template.

**Step 2: Install dependencies**

```bash
npm install
npm install codemirror @codemirror/lang-javascript @codemirror/theme-one-dark
```

**Step 3: Verify dev server starts**

```bash
npm run dev -- --host 0.0.0.0
```

Expected: Dev server starts, page loads at localhost:5173.

**Step 4: Replace default content with app shell**

Replace `index.html` with the three-panel layout structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Arduino Simulator</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app">
    <header id="toolbar">
      <span class="logo">Arduino Simulator</span>
      <select id="example-select">
        <option value="">Load Example...</option>
      </select>
      <div class="mode-toggle">
        <button id="mode-schematic" class="active">Schematic</button>
        <button id="mode-breadboard">Breadboard</button>
      </div>
      <div class="run-controls">
        <button id="btn-run">Run</button>
        <button id="btn-stop" disabled>Stop</button>
      </div>
    </header>
    <main id="workspace">
      <div id="editor-panel">
        <div id="code-editor"></div>
        <div id="serial-monitor">
          <div class="serial-header">Serial Monitor</div>
          <div id="serial-output"></div>
        </div>
      </div>
      <div id="circuit-panel">
        <div id="component-palette"></div>
        <svg id="circuit-canvas" xmlns="http://www.w3.org/2000/svg"></svg>
        <div id="sensor-controls">
          <label>Object Distance: <span id="distance-value">100</span>cm</label>
          <input type="range" id="distance-slider" min="0" max="200" value="100" />
        </div>
      </div>
    </main>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

Replace `src/style.css` with base layout styles:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; font-family: 'Segoe UI', system-ui, sans-serif; background: #1e1e1e; color: #d4d4d4; }

#app { display: flex; flex-direction: column; height: 100vh; }

#toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px; background: #2d2d2d; border-bottom: 1px solid #404040;
}
.logo { font-weight: bold; font-size: 16px; color: #fff; margin-right: auto; }
#toolbar select, #toolbar button {
  padding: 6px 12px; border-radius: 4px; border: 1px solid #555;
  background: #3c3c3c; color: #d4d4d4; cursor: pointer; font-size: 13px;
}
.mode-toggle { display: flex; gap: 0; }
.mode-toggle button { border-radius: 0; }
.mode-toggle button:first-child { border-radius: 4px 0 0 4px; }
.mode-toggle button:last-child { border-radius: 0 4px 4px 0; }
.mode-toggle button.active { background: #007acc; border-color: #007acc; color: #fff; }
#btn-run { background: #2ea043; border-color: #2ea043; color: #fff; }
#btn-stop { background: #d73a49; border-color: #d73a49; color: #fff; }
#btn-stop:disabled { opacity: 0.4; cursor: not-allowed; }

#workspace { display: flex; flex: 1; overflow: hidden; }

#editor-panel {
  width: 40%; display: flex; flex-direction: column;
  border-right: 1px solid #404040;
}
#code-editor { flex: 1; overflow: auto; }
#serial-monitor {
  height: 150px; border-top: 1px solid #404040;
  display: flex; flex-direction: column;
}
.serial-header {
  padding: 4px 8px; background: #2d2d2d; font-size: 12px;
  border-bottom: 1px solid #404040;
}
#serial-output {
  flex: 1; overflow-y: auto; padding: 8px;
  font-family: 'Courier New', monospace; font-size: 12px;
  background: #1a1a1a; white-space: pre-wrap;
}

#circuit-panel {
  width: 60%; display: flex; flex-direction: column;
  background: #f5f5f0;
}
#component-palette {
  padding: 8px; background: #e8e8e4; border-bottom: 1px solid #ccc;
  display: flex; gap: 8px; flex-wrap: wrap;
}
#circuit-canvas { flex: 1; }
#sensor-controls {
  padding: 8px 16px; background: #e8e8e4; border-top: 1px solid #ccc;
  display: flex; align-items: center; gap: 12px; color: #333;
}
#distance-slider { flex: 1; max-width: 300px; }
```

Replace `src/main.js` with:

```javascript
import './style.css';

console.log('Arduino Simulator loaded');
```

**Step 5: Verify the layout renders**

Open browser, confirm three-panel layout appears with toolbar.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite project with three-panel layout"
```

---

### Task 2: Code Editor with CodeMirror

**Files:**
- Create: `src/editor/editor.js`
- Modify: `src/main.js`

**Step 1: Create editor module**

Create `src/editor/editor.js`:

```javascript
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';

const DEFAULT_CODE = `// Arduino Simulator
// Write your code here!

void setup() {
  // runs once at start
  pinMode(13, OUTPUT);
}

void loop() {
  // runs repeatedly
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

export function createEditor(parentElement) {
  const state = EditorState.create({
    doc: DEFAULT_CODE,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent: parentElement,
  });

  return {
    getCode() {
      return view.state.doc.toString();
    },
    setCode(code) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
    view,
  };
}
```

**Step 2: Wire editor into main.js**

```javascript
import './style.css';
import { createEditor } from './editor/editor.js';

const editor = createEditor(document.getElementById('code-editor'));

window.arduinoSimulator = { editor };
```

**Step 3: Install missing CodeMirror dependency**

```bash
npm install @codemirror/state
```

**Step 4: Verify editor renders with syntax highlighting**

Open browser, confirm CodeMirror editor appears in the left panel with dark theme and the default Arduino-style code.

**Step 5: Commit**

```bash
git add src/editor/editor.js src/main.js package.json package-lock.json
git commit -m "feat: add CodeMirror code editor with dark theme"
```

---

### Task 3: Arduino Transpiler

**Files:**
- Create: `src/editor/transpiler.js`
- Create: `tests/transpiler.test.js`

**Step 1: Install test runner**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`

**Step 2: Write failing tests**

Create `tests/transpiler.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { transpile } from '../src/editor/transpiler.js';

describe('transpiler', () => {
  it('converts void functions to JS functions', () => {
    expect(transpile('void setup() {')).toBe('function setup() {');
    expect(transpile('void loop() {')).toBe('function loop() {');
    expect(transpile('void myFunc() {')).toBe('function myFunc() {');
  });

  it('converts void functions with return types in args', () => {
    expect(transpile('void rgbLedDisplay(int red, int green, int blue) {'))
      .toBe('function rgbLedDisplay( red,  green,  blue) {');
  });

  it('converts int/float variable declarations to let', () => {
    expect(transpile('int ledPin = 13;')).toBe('let ledPin = 13;');
    expect(transpile('float distance;')).toBe('let distance;');
    expect(transpile('unsigned long pingTime;')).toBe('let pingTime;');
  });

  it('converts #define to const', () => {
    expect(transpile('#define trigPin 12')).toBe('const trigPin = 12;');
    expect(transpile('#define MAX_DISTANCE 200')).toBe('const MAX_DISTANCE = 200;');
  });

  it('leaves plain JS/comments unchanged', () => {
    expect(transpile('// this is a comment')).toBe('// this is a comment');
    expect(transpile('x = 5;')).toBe('x = 5;');
  });

  it('handles multiline code', () => {
    const input = `void setup() {
  int x = 5;
  pinMode(13, OUTPUT);
}`;
    const output = transpile(input);
    expect(output).toContain('function setup() {');
    expect(output).toContain('let x = 5;');
    expect(output).toContain('pinMode(13, OUTPUT);');
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/transpiler.test.js
```

Expected: FAIL - module not found.

**Step 4: Implement transpiler**

Create `src/editor/transpiler.js`:

```javascript
const transforms = [
  // #define NAME value -> const NAME = value;
  (line) => {
    const defineMatch = line.match(/^#define\s+(\w+)\s+(.+)$/);
    if (defineMatch) {
      return `const ${defineMatch[1]} = ${defineMatch[2]};`;
    }
    return line;
  },

  // unsigned long varName -> let varName
  (line) => line.replace(/\bunsigned\s+long\s+/g, 'let ').replace(/\blet\s+let\s+/g, 'let '),

  // void funcName(...) { -> function funcName(...) {
  (line) => line.replace(/\bvoid\s+(\w+)\s*\(/, 'function $1('),

  // int/float type in function params -> remove type
  (line) => line.replace(/\b(int|float|long|unsigned long|byte|boolean|char)\s+(?=\w+\s*[,\)])/g, ''),

  // int/float variable declarations -> let
  (line) => {
    if (line.match(/^\s*(int|float|long|byte|boolean|char)\s+\w+/)) {
      return line.replace(/\b(int|float|long|byte|boolean|char)\s+/, 'let ');
    }
    return line;
  },
];

export function transpile(code) {
  const lines = code.split('\n');
  const result = lines.map((line) => {
    let transformed = line;
    for (const transform of transforms) {
      transformed = transform(transformed);
    }
    return transformed;
  });
  return result.join('\n');
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/transpiler.test.js
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/editor/transpiler.js tests/transpiler.test.js package.json package-lock.json
git commit -m "feat: add Arduino-to-JS transpiler with tests"
```

---

### Task 4: Arduino API Compatibility Layer

**Files:**
- Create: `src/simulator/arduino-api.js`
- Create: `tests/arduino-api.test.js`

**Step 1: Write failing tests**

Create `tests/arduino-api.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createArduinoRuntime } from '../src/simulator/arduino-api.js';

describe('Arduino API', () => {
  let runtime;

  beforeEach(() => {
    runtime = createArduinoRuntime();
  });

  it('sets pin mode', () => {
    runtime.api.pinMode(13, runtime.api.OUTPUT);
    expect(runtime.getPinMode(13)).toBe('OUTPUT');
  });

  it('writes digital HIGH/LOW', () => {
    runtime.api.pinMode(13, runtime.api.OUTPUT);
    runtime.api.digitalWrite(13, runtime.api.HIGH);
    expect(runtime.getPinState(13)).toBe(1);
    runtime.api.digitalWrite(13, runtime.api.LOW);
    expect(runtime.getPinState(13)).toBe(0);
  });

  it('writes analog values 0-255', () => {
    runtime.api.pinMode(9, runtime.api.OUTPUT);
    runtime.api.analogWrite(9, 128);
    expect(runtime.getPinState(9)).toBe(128);
  });

  it('reads digital pin state', () => {
    runtime.api.pinMode(7, runtime.api.INPUT);
    runtime.setExternalPinState(7, 1);
    expect(runtime.api.digitalRead(7)).toBe(1);
  });

  it('Serial.print appends to output buffer', () => {
    runtime.api.Serial.begin(9600);
    runtime.api.Serial.print('Hello');
    runtime.api.Serial.println(' World');
    expect(runtime.getSerialOutput()).toBe('Hello World\n');
  });

  it('random returns value in range', () => {
    for (let i = 0; i < 50; i++) {
      const val = runtime.api.random(10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
    }
  });

  it('constrain clamps values', () => {
    expect(runtime.api.constrain(300, 0, 255)).toBe(255);
    expect(runtime.api.constrain(-5, 0, 255)).toBe(0);
    expect(runtime.api.constrain(100, 0, 255)).toBe(100);
  });

  it('map scales values between ranges', () => {
    expect(runtime.api.map(512, 0, 1024, 0, 100)).toBe(50);
  });

  it('pulseIn returns simulated timing from distance', () => {
    runtime.setSensorDistance(50); // 50cm
    const timing = runtime.api.pulseIn(11, runtime.api.HIGH, 12000);
    // distance = timing * 340 / 2 / 10000 -> timing = 50 * 2 * 10000 / 340 ≈ 2941
    expect(timing).toBeCloseTo(2941, -1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/arduino-api.test.js
```

Expected: FAIL.

**Step 3: Implement Arduino API**

Create `src/simulator/arduino-api.js`:

```javascript
export function createArduinoRuntime() {
  const pinModes = {};
  const pinStates = {};
  const externalPinStates = {};
  let serialOutput = '';
  let sensorDistance = 100;
  const listeners = { pinChange: [], serialData: [] };

  function on(event, callback) {
    if (listeners[event]) listeners[event].push(callback);
  }

  function notifyPinChange(pin, value) {
    listeners.pinChange.forEach((cb) => cb(pin, value, pinModes[pin]));
  }

  function notifySerialData(text) {
    listeners.serialData.forEach((cb) => cb(text));
  }

  const HIGH = 1;
  const LOW = 0;
  const OUTPUT = 'OUTPUT';
  const INPUT = 'INPUT';

  const api = {
    HIGH, LOW, OUTPUT, INPUT,

    pinMode(pin, mode) {
      pinModes[pin] = mode;
      pinStates[pin] = 0;
    },

    digitalWrite(pin, value) {
      pinStates[pin] = value;
      notifyPinChange(pin, value);
    },

    digitalRead(pin) {
      if (externalPinStates[pin] !== undefined) return externalPinStates[pin];
      return pinStates[pin] || 0;
    },

    analogWrite(pin, value) {
      pinStates[pin] = value;
      notifyPinChange(pin, value);
    },

    pulseIn(pin, value, timeout) {
      // Simulate HC-SR04: timing = distance * 2 / 340 * 10000 (in microseconds)
      const timing = (sensorDistance * 2 * 10000) / 340;
      return timing;
    },

    delay(ms) {
      // This is a marker; the executor replaces delay() calls with async awaits
      return { __delay: ms };
    },

    delayMicroseconds(us) {
      return { __delay: us / 1000 };
    },

    Serial: {
      begin(baud) { /* no-op in simulator */ },
      print(value) {
        const text = String(value);
        serialOutput += text;
        notifySerialData(text);
      },
      println(value) {
        const text = String(value) + '\n';
        serialOutput += text;
        notifySerialData(text);
      },
    },

    random(minOrMax, max) {
      if (max === undefined) {
        return Math.floor(Math.random() * minOrMax);
      }
      return Math.floor(Math.random() * (max - minOrMax)) + minOrMax;
    },

    constrain(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    map(value, fromLow, fromHigh, toLow, toHigh) {
      return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    },
  };

  return {
    api,
    on,
    getPinMode: (pin) => pinModes[pin],
    getPinState: (pin) => pinStates[pin],
    setExternalPinState: (pin, value) => { externalPinStates[pin] = value; },
    getSerialOutput: () => serialOutput,
    setSensorDistance: (d) => { sensorDistance = d; },
    reset() {
      Object.keys(pinModes).forEach((k) => delete pinModes[k]);
      Object.keys(pinStates).forEach((k) => delete pinStates[k]);
      Object.keys(externalPinStates).forEach((k) => delete externalPinStates[k]);
      serialOutput = '';
      listeners.pinChange = [];
      listeners.serialData = [];
    },
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/arduino-api.test.js
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/simulator/arduino-api.js tests/arduino-api.test.js
git commit -m "feat: add Arduino API compatibility layer with tests"
```

---

### Task 5: Code Executor

**Files:**
- Create: `src/simulator/executor.js`
- Create: `tests/executor.test.js`

**Step 1: Write failing tests**

Create `tests/executor.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutor } from '../src/simulator/executor.js';
import { createArduinoRuntime } from '../src/simulator/arduino-api.js';
import { transpile } from '../src/editor/transpiler.js';

describe('Executor', () => {
  let runtime, executor;

  beforeEach(() => {
    runtime = createArduinoRuntime();
    executor = createExecutor(runtime);
  });

  it('runs setup once', async () => {
    const code = transpile(`
void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
}
void loop() {
}
`);
    await executor.loadAndRunSetup(code);
    expect(runtime.getPinMode(13)).toBe('OUTPUT');
    expect(runtime.getPinState(13)).toBe(1);
  });

  it('runs loop iterations', async () => {
    const pinValues = [];
    runtime.on('pinChange', (pin, value) => { pinValues.push({ pin, value }); });

    const code = transpile(`
int counter = 0;
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  digitalWrite(13, LOW);
  counter++;
}
`);
    await executor.loadAndRunSetup(code);
    await executor.runLoopIterations(3);
    // 3 iterations * 2 writes each = 6 pin changes
    expect(pinValues.length).toBe(6);
  });

  it('stops execution', async () => {
    const code = transpile(`
void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); }
`);
    await executor.loadAndRunSetup(code);
    executor.stop();
    expect(executor.isRunning()).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/executor.test.js
```

Expected: FAIL.

**Step 3: Implement executor**

Create `src/simulator/executor.js`:

```javascript
export function createExecutor(runtime) {
  let setupFn = null;
  let loopFn = null;
  let running = false;
  let loopTimeoutId = null;

  function buildGlobals() {
    const api = runtime.api;
    return {
      HIGH: api.HIGH, LOW: api.LOW, OUTPUT: api.OUTPUT, INPUT: api.INPUT,
      pinMode: api.pinMode, digitalWrite: api.digitalWrite, digitalRead: api.digitalRead,
      analogWrite: api.analogWrite, pulseIn: api.pulseIn,
      delay: api.delay, delayMicroseconds: api.delayMicroseconds,
      Serial: api.Serial,
      random: api.random, constrain: api.constrain, map: api.map,
    };
  }

  function compileCode(code) {
    const globals = buildGlobals();
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    // Wrap code so setup and loop are accessible
    const wrappedCode = `
      ${code}
      return { setup: typeof setup === 'function' ? setup : null, loop: typeof loop === 'function' ? loop : null };
    `;

    try {
      const factory = new Function(...globalNames, wrappedCode);
      return factory(...globalValues);
    } catch (e) {
      throw new Error(`Compilation error: ${e.message}`);
    }
  }

  async function loadAndRunSetup(code) {
    const compiled = compileCode(code);
    setupFn = compiled.setup;
    loopFn = compiled.loop;

    if (setupFn) {
      setupFn();
    }
    running = true;
  }

  async function runLoopIterations(count) {
    if (!loopFn) return;
    for (let i = 0; i < count && running; i++) {
      loopFn();
    }
  }

  function startLoop(intervalMs = 10) {
    if (!loopFn) return;
    running = true;

    function tick() {
      if (!running) return;
      try {
        const result = loopFn();
        // Check for delay marker
        let nextDelay = intervalMs;
        if (result && result.__delay) {
          nextDelay = Math.max(1, result.__delay);
        }
        loopTimeoutId = setTimeout(tick, nextDelay);
      } catch (e) {
        running = false;
        runtime.api.Serial.println(`Runtime error: ${e.message}`);
      }
    }

    tick();
  }

  function stop() {
    running = false;
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId);
      loopTimeoutId = null;
    }
  }

  function isRunning() {
    return running;
  }

  return { loadAndRunSetup, runLoopIterations, startLoop, stop, isRunning };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/executor.test.js
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/simulator/executor.js tests/executor.test.js
git commit -m "feat: add code executor with setup/loop lifecycle"
```

---

### Task 6: Serial Monitor UI

**Files:**
- Create: `src/ui/serial-monitor.js`
- Modify: `src/main.js`

**Step 1: Implement serial monitor module**

Create `src/ui/serial-monitor.js`:

```javascript
export function createSerialMonitor(outputElement) {
  function append(text) {
    outputElement.textContent += text;
    outputElement.scrollTop = outputElement.scrollHeight;
  }

  function clear() {
    outputElement.textContent = '';
  }

  return { append, clear };
}
```

**Step 2: Wire into main.js**

Update `src/main.js` to integrate editor, runtime, executor, and serial monitor. Connect Run/Stop buttons:

```javascript
import './style.css';
import { createEditor } from './editor/editor.js';
import { transpile } from './editor/transpiler.js';
import { createArduinoRuntime } from './simulator/arduino-api.js';
import { createExecutor } from './simulator/executor.js';
import { createSerialMonitor } from './ui/serial-monitor.js';

const editor = createEditor(document.getElementById('code-editor'));
const serialMonitor = createSerialMonitor(document.getElementById('serial-output'));

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
```

**Step 3: Verify end-to-end: type code, click Run, see Serial output**

Open browser. The default blink code won't produce serial output, so temporarily type:

```
void setup() { Serial.begin(9600); }
void loop() { Serial.println("Hello!"); delay(1000); }
```

Click Run. Serial Monitor should show "Hello!" appearing repeatedly.

**Step 4: Commit**

```bash
git add src/ui/serial-monitor.js src/main.js
git commit -m "feat: wire up Run/Stop buttons and serial monitor"
```

---

### Task 7: Circuit Model - Breadboard & Connection Graph

**Files:**
- Create: `src/circuit/breadboard.js`
- Create: `src/circuit/connection-graph.js`
- Create: `tests/breadboard.test.js`
- Create: `tests/connection-graph.test.js`

**Step 1: Write failing tests for breadboard**

Create `tests/breadboard.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { BreadboardModel } from '../src/circuit/breadboard.js';

describe('BreadboardModel', () => {
  it('has 30 columns (1-30) and rows a-j', () => {
    const bb = new BreadboardModel();
    expect(bb.isValidPosition('a', 1)).toBe(true);
    expect(bb.isValidPosition('j', 30)).toBe(true);
    expect(bb.isValidPosition('k', 1)).toBe(false);
  });

  it('holes in same row group on same column are connected', () => {
    const bb = new BreadboardModel();
    // top half: a-e are connected per column
    expect(bb.areConnected('a1', 'e1')).toBe(true);
    expect(bb.areConnected('b5', 'd5')).toBe(true);
    // bottom half: f-j are connected per column
    expect(bb.areConnected('f1', 'j1')).toBe(true);
  });

  it('holes across the center gap are NOT connected', () => {
    const bb = new BreadboardModel();
    expect(bb.areConnected('e1', 'f1')).toBe(false);
  });

  it('power rails run the full length', () => {
    const bb = new BreadboardModel();
    expect(bb.areConnected('power+:1', 'power+:30')).toBe(true);
    expect(bb.areConnected('power-:1', 'power-:30')).toBe(true);
    expect(bb.areConnected('power+:1', 'power-:1')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/breadboard.test.js
```

**Step 3: Implement breadboard model**

Create `src/circuit/breadboard.js`:

```javascript
export class BreadboardModel {
  constructor() {
    this.rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    this.cols = 30;
  }

  isValidPosition(row, col) {
    return this.rows.includes(row) && col >= 1 && col <= this.cols;
  }

  getNetId(posStr) {
    // Power rails
    if (posStr.startsWith('power+:')) return 'net:power+';
    if (posStr.startsWith('power-:')) return 'net:power-';

    const row = posStr[0];
    const col = parseInt(posStr.slice(1), 10);

    if (!this.isValidPosition(row, col)) return null;

    // Top group: a-e share a net per column
    if ('abcde'.includes(row)) return `net:top:${col}`;
    // Bottom group: f-j share a net per column
    if ('fghij'.includes(row)) return `net:bottom:${col}`;

    return null;
  }

  areConnected(pos1, pos2) {
    const net1 = this.getNetId(pos1);
    const net2 = this.getNetId(pos2);
    if (!net1 || !net2) return false;
    return net1 === net2;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/breadboard.test.js
```

**Step 5: Write failing tests for connection graph**

Create `tests/connection-graph.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { ConnectionGraph } from '../src/circuit/connection-graph.js';

describe('ConnectionGraph', () => {
  it('tracks wire connections between nodes', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'breadboard:a1');
    expect(graph.areConnected('arduino:pin13', 'breadboard:a1')).toBe(true);
  });

  it('finds transitive connections', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'breadboard:a1');
    graph.addWire('breadboard:e1', 'breadboard:f1'); // jumper across gap
    // a1 and e1 are same net on breadboard (top group col 1)
    graph.addBreadboardNets(['breadboard:a1', 'breadboard:e1']); // same net group
    graph.addBreadboardNets(['breadboard:f1', 'breadboard:j1']); // same net group
    expect(graph.areConnected('arduino:pin13', 'breadboard:j1')).toBe(true);
  });

  it('removes wires', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'breadboard:a1');
    graph.removeWire('arduino:pin13', 'breadboard:a1');
    expect(graph.areConnected('arduino:pin13', 'breadboard:a1')).toBe(false);
  });

  it('finds all nodes connected to a pin', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:5V', 'breadboard:power+');
    graph.addWire('breadboard:power+', 'component:led1:anode');
    const connected = graph.getConnectedNodes('arduino:5V');
    expect(connected).toContain('breadboard:power+');
    expect(connected).toContain('component:led1:anode');
  });
});
```

**Step 6: Run test to verify it fails**

```bash
npx vitest run tests/connection-graph.test.js
```

**Step 7: Implement connection graph**

Create `src/circuit/connection-graph.js`:

```javascript
export class ConnectionGraph {
  constructor() {
    this.edges = new Map(); // node -> Set of connected nodes
  }

  _ensureNode(node) {
    if (!this.edges.has(node)) this.edges.set(node, new Set());
  }

  addWire(nodeA, nodeB) {
    this._ensureNode(nodeA);
    this._ensureNode(nodeB);
    this.edges.get(nodeA).add(nodeB);
    this.edges.get(nodeB).add(nodeA);
  }

  removeWire(nodeA, nodeB) {
    if (this.edges.has(nodeA)) this.edges.get(nodeA).delete(nodeB);
    if (this.edges.has(nodeB)) this.edges.get(nodeB).delete(nodeA);
  }

  addBreadboardNets(nodes) {
    // Connect all nodes in the same net group to each other
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        this.addWire(nodes[i], nodes[j]);
      }
    }
  }

  getConnectedNodes(startNode) {
    const visited = new Set();
    const queue = [startNode];
    while (queue.length > 0) {
      const node = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      const neighbors = this.edges.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
    }
    visited.delete(startNode);
    return [...visited];
  }

  areConnected(nodeA, nodeB) {
    if (nodeA === nodeB) return true;
    return this.getConnectedNodes(nodeA).includes(nodeB);
  }

  clear() {
    this.edges.clear();
  }
}
```

**Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All PASS.

**Step 9: Commit**

```bash
git add src/circuit/breadboard.js src/circuit/connection-graph.js tests/breadboard.test.js tests/connection-graph.test.js
git commit -m "feat: add breadboard model and connection graph with tests"
```

---

### Task 8: Component Models

**Files:**
- Create: `src/circuit/components/led.js`
- Create: `src/circuit/components/rgb-led.js`
- Create: `src/circuit/components/resistor.js`
- Create: `src/circuit/components/push-button.js`
- Create: `src/circuit/components/ultrasonic-sensor.js`
- Create: `src/circuit/components/index.js`
- Create: `tests/components.test.js`

**Step 1: Write failing tests**

Create `tests/components.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { LED } from '../src/circuit/components/led.js';
import { RgbLed } from '../src/circuit/components/rgb-led.js';
import { Resistor } from '../src/circuit/components/resistor.js';
import { PushButton } from '../src/circuit/components/push-button.js';
import { UltrasonicSensor } from '../src/circuit/components/ultrasonic-sensor.js';

describe('LED', () => {
  it('has anode and cathode pins', () => {
    const led = new LED('led1');
    expect(led.pins).toEqual(['anode', 'cathode']);
  });

  it('computes brightness from pin states', () => {
    const led = new LED('led1');
    led.update({ anode: 1, cathode: 0 }, { hasResistor: true });
    expect(led.brightness).toBe(1);
    expect(led.burnedOut).toBe(false);
  });

  it('burns out without resistor', () => {
    const led = new LED('led1');
    led.update({ anode: 1, cathode: 0 }, { hasResistor: false });
    expect(led.burnedOut).toBe(true);
  });

  it('is off when cathode equals anode', () => {
    const led = new LED('led1');
    led.update({ anode: 0, cathode: 0 }, { hasResistor: true });
    expect(led.brightness).toBe(0);
  });
});

describe('RgbLed (common anode)', () => {
  it('has 4 pins', () => {
    const rgb = new RgbLed('rgb1');
    expect(rgb.pins).toEqual(['common', 'red', 'green', 'blue']);
  });

  it('inverts color values for common anode (LOW=bright)', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 0, green: 0, blue: 0 }, { hasResistors: true });
    // All channels LOW on common anode = full brightness white
    expect(rgb.color).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('HIGH means off for common anode', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 255, green: 255, blue: 255 }, { hasResistors: true });
    expect(rgb.color).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('handles PWM values', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 128, green: 255, blue: 0 }, { hasResistors: true });
    // Inverted: red=255-128=127, green=255-255=0, blue=255-0=255
    expect(rgb.color).toEqual({ r: 127, g: 0, b: 255 });
  });
});

describe('PushButton', () => {
  it('defaults to open (not pressed)', () => {
    const btn = new PushButton('btn1');
    expect(btn.isPressed).toBe(false);
  });

  it('toggles on press', () => {
    const btn = new PushButton('btn1');
    btn.press();
    expect(btn.isPressed).toBe(true);
    btn.release();
    expect(btn.isPressed).toBe(false);
  });
});

describe('Resistor', () => {
  it('has two pins and an ohm value', () => {
    const r = new Resistor('r1', 220);
    expect(r.pins).toEqual(['pin1', 'pin2']);
    expect(r.ohms).toBe(220);
  });
});

describe('UltrasonicSensor', () => {
  it('has 4 pins', () => {
    const us = new UltrasonicSensor('us1');
    expect(us.pins).toEqual(['vcc', 'trig', 'echo', 'gnd']);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components.test.js
```

**Step 3: Implement all component models**

Create `src/circuit/components/led.js`:

```javascript
export class LED {
  constructor(id) {
    this.id = id;
    this.type = 'led';
    this.pins = ['anode', 'cathode'];
    this.brightness = 0;
    this.burnedOut = false;
  }

  update(pinValues, context) {
    if (this.burnedOut) return;

    const voltage = (pinValues.anode || 0) - (pinValues.cathode || 0);

    if (voltage > 0 && !context.hasResistor) {
      this.burnedOut = true;
      this.brightness = 0;
      return;
    }

    this.brightness = voltage > 0 ? Math.min(voltage, 1) : 0;
  }

  reset() {
    this.brightness = 0;
    this.burnedOut = false;
  }
}
```

Create `src/circuit/components/rgb-led.js`:

```javascript
export class RgbLed {
  constructor(id) {
    this.id = id;
    this.type = 'rgb-led';
    this.pins = ['common', 'red', 'green', 'blue'];
    this.color = { r: 0, g: 0, b: 0 };
    this.burnedOut = false;
  }

  update(pinValues, context) {
    if (this.burnedOut) return;

    if ((pinValues.common || 0) > 0 && !context.hasResistors) {
      this.burnedOut = true;
      this.color = { r: 0, g: 0, b: 0 };
      return;
    }

    // Common anode: color = 255 - pinValue (LOW = bright, HIGH = off)
    this.color = {
      r: 255 - (pinValues.red || 0),
      g: 255 - (pinValues.green || 0),
      b: 255 - (pinValues.blue || 0),
    };
  }

  reset() {
    this.color = { r: 0, g: 0, b: 0 };
    this.burnedOut = false;
  }
}
```

Create `src/circuit/components/resistor.js`:

```javascript
export class Resistor {
  constructor(id, ohms = 220) {
    this.id = id;
    this.type = 'resistor';
    this.pins = ['pin1', 'pin2'];
    this.ohms = ohms;
  }
}
```

Create `src/circuit/components/push-button.js`:

```javascript
export class PushButton {
  constructor(id) {
    this.id = id;
    this.type = 'push-button';
    this.pins = ['pin1a', 'pin1b', 'pin2a', 'pin2b'];
    this.isPressed = false;
  }

  press() { this.isPressed = true; }
  release() { this.isPressed = false; }
}
```

Create `src/circuit/components/ultrasonic-sensor.js`:

```javascript
export class UltrasonicSensor {
  constructor(id) {
    this.id = id;
    this.type = 'ultrasonic-sensor';
    this.pins = ['vcc', 'trig', 'echo', 'gnd'];
  }
}
```

Create `src/circuit/components/index.js`:

```javascript
export { LED } from './led.js';
export { RgbLed } from './rgb-led.js';
export { Resistor } from './resistor.js';
export { PushButton } from './push-button.js';
export { UltrasonicSensor } from './ultrasonic-sensor.js';
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components.test.js
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/circuit/components/ tests/components.test.js
git commit -m "feat: add component models (LED, RGB LED, resistor, button, ultrasonic)"
```

---

### Task 9: SVG Circuit Renderer - Arduino Board & Breadboard

**Files:**
- Create: `src/circuit/renderer.js`
- Create: `src/circuit/svg-components.js`

This task builds the visual rendering. Due to the visual nature, testing is best done via Playwright (Task 14) and manual verification.

**Step 1: Create SVG component library**

Create `src/circuit/svg-components.js` - factory functions that return SVG element groups for each component type:

```javascript
const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function renderArduinoBoard(x, y) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'arduino-board' });

  // Board body
  g.appendChild(svgEl('rect', { width: 260, height: 160, rx: 8, fill: '#1a1a2e', stroke: '#333', 'stroke-width': 2 }));

  // Label
  const label = svgEl('text', { x: 130, y: 85, 'text-anchor': 'middle', fill: '#888', 'font-size': 14, 'font-family': 'monospace' });
  label.textContent = 'Arduino Uno';
  g.appendChild(label);

  // Digital pins 0-13 across the top
  const digitalPins = [0,1,2,3,4,5,6,7,8,9,10,11,12,13];
  digitalPins.forEach((pin, i) => {
    const px = 20 + i * 17;
    const pinG = svgEl('g', { class: `pin digital-pin pin-${pin}`, 'data-pin': `arduino:pin${pin}` });
    pinG.appendChild(svgEl('rect', { x: px, y: -8, width: 12, height: 16, rx: 2, fill: '#c0a030', stroke: '#887020' }));
    const txt = svgEl('text', { x: px + 6, y: -14, 'text-anchor': 'middle', fill: '#aaa', 'font-size': 8 });
    txt.textContent = pin;
    pinG.appendChild(txt);
    g.appendChild(pinG);
  });

  // Power pins across the bottom: GND, 5V, 3.3V
  const powerPins = [
    { name: 'GND', id: 'arduino:GND', x: 20 },
    { name: '5V', id: 'arduino:5V', x: 50 },
    { name: '3.3V', id: 'arduino:3V3', x: 80 },
  ];
  powerPins.forEach((p) => {
    const pinG = svgEl('g', { class: 'pin power-pin', 'data-pin': p.id });
    pinG.appendChild(svgEl('rect', { x: p.x, y: 152, width: 24, height: 16, rx: 2, fill: p.name === 'GND' ? '#333' : '#c03030', stroke: '#666' }));
    const txt = svgEl('text', { x: p.x + 12, y: 175, 'text-anchor': 'middle', fill: '#aaa', 'font-size': 8 });
    txt.textContent = p.name;
    pinG.appendChild(txt);
    g.appendChild(pinG);
  });

  return g;
}

export function renderBreadboard(x, y) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'breadboard' });

  const cols = 30;
  const holeSpacing = 16;
  const rowLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  // Board background
  const width = (cols + 1) * holeSpacing + 20;
  const height = (rowLabels.length + 2) * holeSpacing + 40;
  g.appendChild(svgEl('rect', { width, height, rx: 6, fill: '#f0efe8', stroke: '#ccc', 'stroke-width': 1 }));

  // Center gap line
  const gapY = 5.5 * holeSpacing + 20;
  g.appendChild(svgEl('line', { x1: 10, y1: gapY, x2: width - 10, y2: gapY, stroke: '#bbb', 'stroke-width': 2 }));

  // Holes
  rowLabels.forEach((row, ri) => {
    const hy = (ri + 1) * holeSpacing + 12;
    // Add gap between e and f
    const adjustedY = ri >= 5 ? hy + 16 : hy;

    for (let col = 1; col <= cols; col++) {
      const hx = col * holeSpacing + 10;
      const holeId = `breadboard:${row}${col}`;
      const hole = svgEl('circle', {
        cx: hx, cy: adjustedY, r: 4,
        fill: '#555', stroke: '#444', 'stroke-width': 0.5,
        class: 'breadboard-hole', 'data-pin': holeId,
      });
      g.appendChild(hole);
    }
  });

  // Power rail indicators
  const pwrPlusY = 8;
  const pwrMinusY = height - 8;
  g.appendChild(svgEl('line', { x1: 20, y1: pwrPlusY, x2: width - 20, y2: pwrPlusY, stroke: '#d33', 'stroke-width': 2 }));
  g.appendChild(svgEl('line', { x1: 20, y1: pwrMinusY, x2: width - 20, y2: pwrMinusY, stroke: '#33d', 'stroke-width': 2 }));

  return g;
}

export function renderLedComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: `component led`, 'data-component-id': id });
  // LED body
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 12, fill: '#ff000030', stroke: '#cc0000', 'stroke-width': 2, class: 'led-body' }));
  // Anode label (+)
  const aLabel = svgEl('text', { x: -4, y: -16, fill: '#666', 'font-size': 10 });
  aLabel.textContent = '+';
  g.appendChild(aLabel);
  // Pin markers
  g.appendChild(svgEl('circle', { cx: -6, cy: 14, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:anode` }));
  g.appendChild(svgEl('circle', { cx: 6, cy: 14, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:cathode` }));
  return g;
}

export function renderRgbLedComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component rgb-led', 'data-component-id': id });
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 14, fill: '#ffffff20', stroke: '#999', 'stroke-width': 2, class: 'rgb-led-body' }));
  const label = svgEl('text', { x: 0, y: 4, 'text-anchor': 'middle', fill: '#666', 'font-size': 8 });
  label.textContent = 'RGB';
  g.appendChild(label);
  // 4 pin markers: common(+), R, G, B
  const pinNames = ['common', 'red', 'green', 'blue'];
  const pinLabels = ['+', 'R', 'G', 'B'];
  pinNames.forEach((name, i) => {
    const px = (i - 1.5) * 10;
    g.appendChild(svgEl('circle', { cx: px, cy: 18, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:${name}` }));
    const t = svgEl('text', { x: px, y: 28, 'text-anchor': 'middle', fill: '#888', 'font-size': 7 });
    t.textContent = pinLabels[i];
    g.appendChild(t);
  });
  return g;
}

export function renderResistorComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component resistor', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -16, y: -5, width: 32, height: 10, rx: 2, fill: '#d4b896', stroke: '#8b7355', 'stroke-width': 1 }));
  // Color bands (220 ohm: red, red, brown)
  g.appendChild(svgEl('rect', { x: -10, y: -5, width: 3, height: 10, fill: '#cc0000' }));
  g.appendChild(svgEl('rect', { x: -4, y: -5, width: 3, height: 10, fill: '#cc0000' }));
  g.appendChild(svgEl('rect', { x: 2, y: -5, width: 3, height: 10, fill: '#8b4513' }));
  // Pins
  g.appendChild(svgEl('circle', { cx: -20, cy: 0, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1` }));
  g.appendChild(svgEl('circle', { cx: 20, cy: 0, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2` }));
  return g;
}

export function renderPushButtonComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component push-button', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -12, y: -12, width: 24, height: 24, rx: 3, fill: '#555', stroke: '#333', 'stroke-width': 1 }));
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 6, fill: '#888', stroke: '#666', class: 'button-cap' }));
  // 4 pins
  g.appendChild(svgEl('circle', { cx: -12, cy: -12, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1a` }));
  g.appendChild(svgEl('circle', { cx: 12, cy: -12, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1b` }));
  g.appendChild(svgEl('circle', { cx: -12, cy: 12, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2a` }));
  g.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2b` }));
  return g;
}

export function renderUltrasonicComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component ultrasonic', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -24, y: -14, width: 48, height: 28, rx: 3, fill: '#2277bb', stroke: '#1a5c8a', 'stroke-width': 1 }));
  // Transducer circles
  g.appendChild(svgEl('circle', { cx: -8, cy: 0, r: 8, fill: '#ccc', stroke: '#999' }));
  g.appendChild(svgEl('circle', { cx: 8, cy: 0, r: 8, fill: '#ccc', stroke: '#999' }));
  const label = svgEl('text', { x: 0, y: -18, 'text-anchor': 'middle', fill: '#666', 'font-size': 7 });
  label.textContent = 'HC-SR04';
  g.appendChild(label);
  // 4 pins
  const pinNames = ['vcc', 'trig', 'echo', 'gnd'];
  pinNames.forEach((name, i) => {
    const px = (i - 1.5) * 12;
    g.appendChild(svgEl('circle', { cx: px, cy: 18, r: 2, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:${name}` }));
    const t = svgEl('text', { x: px, y: 28, 'text-anchor': 'middle', fill: '#888', 'font-size': 6 });
    t.textContent = name;
    g.appendChild(t);
  });
  return g;
}

export function renderWire(x1, y1, x2, y2, color = '#22cc22') {
  return svgEl('line', {
    x1, y1, x2, y2,
    stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round',
    class: 'wire',
  });
}

export function renderSmokeEffect(x, y) {
  const g = svgEl('g', { class: 'smoke-effect', transform: `translate(${x},${y})` });
  // Animated smoke puffs
  for (let i = 0; i < 5; i++) {
    const puff = svgEl('circle', {
      cx: (Math.random() - 0.5) * 20,
      cy: -Math.random() * 15,
      r: 3 + Math.random() * 5,
      fill: '#66666688',
      class: 'smoke-puff',
    });
    g.appendChild(puff);
  }
  return g;
}
```

**Step 2: Create the main renderer**

Create `src/circuit/renderer.js`:

```javascript
import {
  renderArduinoBoard, renderBreadboard, renderLedComponent,
  renderRgbLedComponent, renderResistorComponent, renderPushButtonComponent,
  renderUltrasonicComponent, renderWire, renderSmokeEffect,
} from './svg-components.js';

export class CircuitRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.components = new Map();
    this.wires = [];
    this.mode = 'schematic'; // or 'breadboard'
    this.dragState = null;

    this._initSvg();
  }

  _initSvg() {
    this.svg.setAttribute('viewBox', '0 0 800 600');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';

    // Layers
    this.boardLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.wireLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.componentLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.effectLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    this.svg.appendChild(this.boardLayer);
    this.svg.appendChild(this.wireLayer);
    this.svg.appendChild(this.componentLayer);
    this.svg.appendChild(this.effectLayer);

    // Render static boards
    this.boardLayer.appendChild(renderArduinoBoard(20, 10));
    this.boardLayer.appendChild(renderBreadboard(20, 200));
  }

  addComponent(type, id, x, y) {
    const renderers = {
      led: renderLedComponent,
      'rgb-led': renderRgbLedComponent,
      resistor: renderResistorComponent,
      'push-button': renderPushButtonComponent,
      'ultrasonic-sensor': renderUltrasonicComponent,
    };

    const renderFn = renderers[type];
    if (!renderFn) return null;

    const el = renderFn(x, y, id);
    this.componentLayer.appendChild(el);
    this.components.set(id, { el, type, x, y });
    this._makeDraggable(el, id);
    return el;
  }

  removeComponent(id) {
    const comp = this.components.get(id);
    if (comp) {
      comp.el.remove();
      this.components.delete(id);
    }
  }

  addWire(x1, y1, x2, y2, color) {
    const wire = renderWire(x1, y1, x2, y2, color);
    this.wireLayer.appendChild(wire);
    this.wires.push(wire);
    return wire;
  }

  updateLed(id, brightness, burnedOut) {
    const comp = this.components.get(id);
    if (!comp) return;
    const body = comp.el.querySelector('.led-body');
    if (!body) return;

    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
      body.setAttribute('stroke', '#555');
      // Show smoke
      const smoke = renderSmokeEffect(0, 0);
      comp.el.appendChild(smoke);
      setTimeout(() => smoke.remove(), 2000);
    } else if (brightness > 0) {
      body.setAttribute('fill', `rgba(255, 0, 0, ${0.3 + brightness * 0.7})`);
      body.setAttribute('filter', 'url(#glow)');
    } else {
      body.setAttribute('fill', '#ff000030');
      body.removeAttribute('filter');
    }
  }

  updateRgbLed(id, color, burnedOut) {
    const comp = this.components.get(id);
    if (!comp) return;
    const body = comp.el.querySelector('.rgb-led-body');
    if (!body) return;

    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
      const smoke = renderSmokeEffect(0, 0);
      comp.el.appendChild(smoke);
      setTimeout(() => smoke.remove(), 2000);
    } else {
      const { r, g, b } = color;
      const brightness = Math.max(r, g, b) / 255;
      body.setAttribute('fill', `rgba(${r}, ${g}, ${b}, ${0.2 + brightness * 0.8})`);
      if (brightness > 0.1) {
        body.setAttribute('filter', 'url(#glow)');
      } else {
        body.removeAttribute('filter');
      }
    }
  }

  _makeDraggable(el, id) {
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const comp = this.components.get(id);
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      this.dragState = { id, offsetX: svgPt.x - comp.x, offsetY: svgPt.y - comp.y };
      el.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      const comp = this.components.get(this.dragState.id);
      comp.x = svgPt.x - this.dragState.offsetX;
      comp.y = svgPt.y - this.dragState.offsetY;
      comp.el.setAttribute('transform', `translate(${comp.x},${comp.y})`);
    });

    this.svg.addEventListener('mouseup', () => {
      if (this.dragState) {
        const comp = this.components.get(this.dragState.id);
        if (comp) comp.el.style.cursor = 'grab';
        this.dragState = null;
      }
    });
  }

  clear() {
    while (this.componentLayer.firstChild) this.componentLayer.firstChild.remove();
    while (this.wireLayer.firstChild) this.wireLayer.firstChild.remove();
    while (this.effectLayer.firstChild) this.effectLayer.firstChild.remove();
    this.components.clear();
    this.wires = [];
  }
}
```

**Step 3: Add SVG glow filter to index.html**

Add inside the `<svg id="circuit-canvas">` element:

```html
<defs>
  <filter id="glow">
    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
```

**Step 4: Wire renderer into main.js**

Add to `src/main.js`:

```javascript
import { CircuitRenderer } from './circuit/renderer.js';

const renderer = new CircuitRenderer(document.getElementById('circuit-canvas'));
```

**Step 5: Verify visually - Arduino board and breadboard render in circuit panel**

Open browser and confirm you see the Arduino board and breadboard rendered as SVG.

**Step 6: Commit**

```bash
git add src/circuit/renderer.js src/circuit/svg-components.js index.html src/main.js
git commit -m "feat: add SVG circuit renderer with Arduino board and breadboard"
```

---

### Task 10: Component Palette & Drag-to-Place

**Files:**
- Create: `src/ui/component-palette.js`
- Modify: `src/main.js`

**Step 1: Create component palette**

Create `src/ui/component-palette.js`:

```javascript
const PALETTE_ITEMS = [
  { type: 'led', label: 'LED', color: '#cc3333' },
  { type: 'rgb-led', label: 'RGB LED', color: '#9933cc' },
  { type: 'resistor', label: '220\u03A9', color: '#b8956a' },
  { type: 'push-button', label: 'Button', color: '#666' },
  { type: 'ultrasonic-sensor', label: 'HC-SR04', color: '#2277bb' },
];

export function createComponentPalette(containerElement, onAddComponent) {
  let nextId = 1;

  PALETTE_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'palette-item';
    btn.textContent = item.label;
    btn.style.cssText = `
      padding: 4px 10px; border-radius: 4px; border: 1px solid #aaa;
      background: ${item.color}22; color: #333; cursor: grab; font-size: 12px;
    `;
    btn.addEventListener('click', () => {
      const id = `${item.type}-${nextId++}`;
      // Place at a default position; user will drag to final position
      onAddComponent(item.type, id, 400, 350);
    });
    containerElement.appendChild(btn);
  });
}
```

**Step 2: Wire into main.js**

Add to main.js:

```javascript
import { createComponentPalette } from './ui/component-palette.js';

createComponentPalette(document.getElementById('component-palette'), (type, id, x, y) => {
  renderer.addComponent(type, id, x, y);
});
```

**Step 3: Verify - click palette items, components appear and are draggable**

Open browser, click "LED" in palette, confirm LED appears on breadboard area and can be dragged.

**Step 4: Commit**

```bash
git add src/ui/component-palette.js src/main.js
git commit -m "feat: add component palette with click-to-place"
```

---

### Task 11: Wiring System

**Files:**
- Create: `src/circuit/wiring.js`
- Modify: `src/circuit/renderer.js`
- Modify: `src/main.js`

**Step 1: Create wiring interaction handler**

Create `src/circuit/wiring.js`:

```javascript
const WIRE_COLORS = ['#22cc22', '#cc2222', '#2222cc', '#cccc22', '#cc8822', '#22cccc', '#cc22cc', '#888888'];

export class WiringSystem {
  constructor(svgElement, renderer, connectionGraph) {
    this.svg = svgElement;
    this.renderer = renderer;
    this.graph = connectionGraph;
    this.wireInProgress = null;
    this.wires = [];
    this.colorIndex = 0;
    this._setupListeners();
  }

  _setupListeners() {
    this.svg.addEventListener('click', (e) => {
      const pinEl = e.target.closest('[data-pin]');
      if (!pinEl) return;

      const pinId = pinEl.getAttribute('data-pin');
      const rect = this.svg.getBoundingClientRect();
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());

      if (!this.wireInProgress) {
        // Start wire
        this.wireInProgress = { pinId, x: svgPt.x, y: svgPt.y };
        pinEl.setAttribute('fill', '#ffcc00');
      } else {
        // Complete wire
        const color = WIRE_COLORS[this.colorIndex % WIRE_COLORS.length];
        this.colorIndex++;

        const wire = this.renderer.addWire(
          this.wireInProgress.x, this.wireInProgress.y,
          svgPt.x, svgPt.y, color
        );

        this.graph.addWire(this.wireInProgress.pinId, pinId);
        this.wires.push({
          el: wire,
          from: this.wireInProgress.pinId,
          to: pinId,
        });

        this.wireInProgress = null;
      }
    });

    // Cancel wire on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.wireInProgress) {
        this.wireInProgress = null;
      }
    });
  }

  clear() {
    this.wires.forEach((w) => w.el.remove());
    this.wires = [];
    this.graph.clear();
    this.wireInProgress = null;
    this.colorIndex = 0;
  }
}
```

**Step 2: Wire into main.js**

```javascript
import { ConnectionGraph } from './circuit/connection-graph.js';
import { WiringSystem } from './circuit/wiring.js';

const connectionGraph = new ConnectionGraph();
const wiring = new WiringSystem(
  document.getElementById('circuit-canvas'),
  renderer,
  connectionGraph
);
```

**Step 3: Verify - click a pin, then click another pin, wire appears**

Open browser. Click an Arduino pin, then click a breadboard hole. A colored wire should appear connecting them.

**Step 4: Commit**

```bash
git add src/circuit/wiring.js src/main.js
git commit -m "feat: add click-to-wire system for connecting pins"
```

---

### Task 12: Circuit Validation & Smoke Effect

**Files:**
- Create: `src/circuit/validator.js`
- Create: `tests/validator.test.js`

**Step 1: Write failing tests**

Create `tests/validator.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { validateCircuit } from '../src/circuit/validator.js';
import { ConnectionGraph } from '../src/circuit/connection-graph.js';

describe('validateCircuit', () => {
  it('returns error when LED has no resistor in series', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'component:led1:anode');
    graph.addWire('component:led1:cathode', 'arduino:GND');

    const components = [{ id: 'led1', type: 'led' }];
    const result = validateCircuit(components, graph);

    expect(result.errors).toContainEqual(
      expect.objectContaining({ componentId: 'led1', type: 'no-resistor' })
    );
  });

  it('passes when LED has a resistor in series', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'component:r1:pin1');
    graph.addWire('component:r1:pin2', 'component:led1:anode');
    graph.addWire('component:led1:cathode', 'arduino:GND');

    const components = [
      { id: 'led1', type: 'led' },
      { id: 'r1', type: 'resistor' },
    ];
    const result = validateCircuit(components, graph);
    expect(result.errors.filter((e) => e.componentId === 'led1' && e.type === 'no-resistor')).toHaveLength(0);
  });

  it('warns when component pin is unconnected', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:pin13', 'component:led1:anode');
    // cathode not connected

    const components = [{ id: 'led1', type: 'led' }];
    const result = validateCircuit(components, graph);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ componentId: 'led1', type: 'unconnected-pin' })
    );
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/validator.test.js
```

**Step 3: Implement validator**

Create `src/circuit/validator.js`:

```javascript
export function validateCircuit(components, connectionGraph) {
  const errors = [];
  const warnings = [];

  for (const comp of components) {
    if (comp.type === 'led') {
      // Check anode and cathode are connected
      const anodeNode = `component:${comp.id}:anode`;
      const cathodeNode = `component:${comp.id}:cathode`;
      const anodeConnected = connectionGraph.getConnectedNodes(anodeNode);
      const cathodeConnected = connectionGraph.getConnectedNodes(cathodeNode);

      if (anodeConnected.length === 0) {
        warnings.push({ componentId: comp.id, type: 'unconnected-pin', pin: 'anode', message: `${comp.id}: anode is not connected` });
      }
      if (cathodeConnected.length === 0) {
        warnings.push({ componentId: comp.id, type: 'unconnected-pin', pin: 'cathode', message: `${comp.id}: cathode is not connected` });
      }

      // Check if there's a resistor in the path
      const allConnected = [...anodeConnected, ...cathodeConnected];
      const hasResistor = allConnected.some((node) => node.includes(':resistor') || node.includes(':r'));
      if (!hasResistor && anodeConnected.length > 0 && cathodeConnected.length > 0) {
        errors.push({ componentId: comp.id, type: 'no-resistor', message: `${comp.id} has no resistor - it would burn out!` });
      }
    }

    if (comp.type === 'rgb-led') {
      const pinNames = ['common', 'red', 'green', 'blue'];
      for (const pin of pinNames) {
        const node = `component:${comp.id}:${pin}`;
        const connected = connectionGraph.getConnectedNodes(node);
        if (connected.length === 0) {
          warnings.push({ componentId: comp.id, type: 'unconnected-pin', pin, message: `${comp.id}: ${pin} is not connected` });
        }
      }
      // Check resistors on R/G/B channels
      for (const pin of ['red', 'green', 'blue']) {
        const node = `component:${comp.id}:${pin}`;
        const connected = connectionGraph.getConnectedNodes(node);
        const hasResistor = connected.some((n) => n.includes(':resistor') || n.includes(':r'));
        if (!hasResistor && connected.length > 0) {
          errors.push({ componentId: comp.id, type: 'no-resistor', pin, message: `${comp.id} ${pin} channel has no resistor - it would burn out!` });
        }
      }
    }

    if (comp.type === 'ultrasonic-sensor') {
      for (const pin of ['vcc', 'trig', 'echo', 'gnd']) {
        const node = `component:${comp.id}:${pin}`;
        const connected = connectionGraph.getConnectedNodes(node);
        if (connected.length === 0) {
          warnings.push({ componentId: comp.id, type: 'unconnected-pin', pin, message: `${comp.id}: ${pin} is not connected` });
        }
      }
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/validator.test.js
```

Expected: All PASS.

**Step 5: Add smoke/spark CSS animation to style.css**

Add to `src/style.css`:

```css
@keyframes smoke-rise {
  0% { opacity: 0.8; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-30px) scale(2); }
}
.smoke-puff {
  animation: smoke-rise 1.5s ease-out forwards;
}
@keyframes spark {
  0% { opacity: 1; }
  50% { opacity: 0.2; }
  100% { opacity: 0; }
}
```

**Step 6: Commit**

```bash
git add src/circuit/validator.js tests/validator.test.js src/style.css
git commit -m "feat: add circuit validator with smoke effect for missing resistors"
```

---

### Task 13: Sample Projects & Project Loader

**Files:**
- Create: `src/projects/led-blink.js`
- Create: `src/projects/button-led.js`
- Create: `src/projects/rgb-multicolor.js`
- Create: `src/projects/ultrasonic-distance-color.js`
- Create: `src/projects/index.js`
- Modify: `src/main.js`

**Step 1: Create project definitions**

Create `src/projects/led-blink.js`:

```javascript
export const ledBlink = {
  name: 'LED Blink',
  description: 'Blink an LED on and off every second',
  code: `#define ledPin 13

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 350, y: 280 },
    { type: 'led', id: 'led1', x: 400, y: 320 },
  ],
  wires: [
    { from: 'arduino:pin13', to: 'component:r1:pin1', color: '#22cc22' },
    { from: 'component:r1:pin2', to: 'component:led1:anode', color: '#22cc22' },
    { from: 'component:led1:cathode', to: 'arduino:GND', color: '#222222' },
  ],
};
```

Create `src/projects/button-led.js`:

```javascript
export const buttonLed = {
  name: 'Button-Controlled LED',
  description: 'LED lights when button is pressed (circuit only, no code needed)',
  code: `// This project uses the Arduino as power supply only.
// The LED is controlled directly by the push button circuit.
// No code is needed - just connect 5V through the button,
// resistor, and LED to GND.

void setup() {
  // Nothing to configure - Arduino is just providing power
}

void loop() {
  // Nothing to do - the circuit handles everything
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 350, y: 280 },
    { type: 'push-button', id: 'btn1', x: 300, y: 320 },
    { type: 'led', id: 'led1', x: 400, y: 320 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:btn1:pin1a', color: '#cc2222' },
    { from: 'component:btn1:pin2a', to: 'component:r1:pin1', color: '#cccc22' },
    { from: 'component:r1:pin2', to: 'component:led1:anode', color: '#22cc22' },
    { from: 'component:led1:cathode', to: 'arduino:GND', color: '#222222' },
  ],
};
```

Create `src/projects/rgb-multicolor.js`:

```javascript
export const rgbMulticolor = {
  name: 'RGB LED Multicolor',
  description: 'RGB LED displays random colors every 500ms',
  code: `int ledPinR = 11;
int ledPinG = 10;
int ledPinB = 9;

void setup() {
  pinMode(ledPinR, OUTPUT);
  pinMode(ledPinG, OUTPUT);
  pinMode(ledPinB, OUTPUT);
}

void loop() {
  analogWrite(ledPinR, random(256));
  analogWrite(ledPinG, random(256));
  analogWrite(ledPinB, random(256));
  delay(500);
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 300, y: 280 },
    { type: 'resistor', id: 'r2', x: 350, y: 280 },
    { type: 'resistor', id: 'r3', x: 400, y: 280 },
    { type: 'rgb-led', id: 'rgb1', x: 350, y: 340 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:rgb1:common', color: '#cc2222' },
    { from: 'arduino:pin11', to: 'component:r1:pin1', color: '#cc2222' },
    { from: 'component:r1:pin2', to: 'component:rgb1:red', color: '#cc2222' },
    { from: 'arduino:pin10', to: 'component:r2:pin1', color: '#22cc22' },
    { from: 'component:r2:pin2', to: 'component:rgb1:green', color: '#22cc22' },
    { from: 'arduino:pin9', to: 'component:r3:pin1', color: '#2222cc' },
    { from: 'component:r3:pin2', to: 'component:rgb1:blue', color: '#2222cc' },
  ],
};
```

Create `src/projects/ultrasonic-distance-color.js`:

```javascript
export const ultrasonicDistanceColor = {
  name: 'Ultrasonic Distance-to-Color',
  description: 'RGB LED changes color based on distance: green=far, yellow=medium, red=close',
  code: `#define trigPin 12
#define echoPin 11
#define MAX_DISTANCE 200

int ledPinR = 3;
int ledPinG = 5;
int ledPinB = 6;

float timeOut = MAX_DISTANCE * 60;
int soundVelocity = 340;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(ledPinR, OUTPUT);
  pinMode(ledPinG, OUTPUT);
  pinMode(ledPinB, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  float distance = getSonar();
  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  if (distance < 30) {
    // Close - Red
    setColor(0, 255, 255);
  } else if (distance < 100) {
    // Medium - Yellow
    setColor(0, 0, 255);
  } else {
    // Far - Green
    setColor(255, 0, 255);
  }
  delay(200);
}

float getSonar() {
  unsigned long pingTime;
  float distance;
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  pingTime = pulseIn(echoPin, HIGH, timeOut);
  distance = (float)pingTime * soundVelocity / 2 / 10000;
  return distance;
}

void setColor(int red, int green, int blue) {
  analogWrite(ledPinR, red);
  analogWrite(ledPinG, green);
  analogWrite(ledPinB, blue);
}`,
  components: [
    { type: 'ultrasonic-sensor', id: 'us1', x: 200, y: 280 },
    { type: 'resistor', id: 'r1', x: 400, y: 280 },
    { type: 'resistor', id: 'r2', x: 450, y: 280 },
    { type: 'resistor', id: 'r3', x: 500, y: 280 },
    { type: 'rgb-led', id: 'rgb1', x: 450, y: 340 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:us1:vcc', color: '#cc2222' },
    { from: 'arduino:pin12', to: 'component:us1:trig', color: '#22cc22' },
    { from: 'arduino:pin11', to: 'component:us1:echo', color: '#cccc22' },
    { from: 'component:us1:gnd', to: 'arduino:GND', color: '#222222' },
    { from: 'arduino:5V', to: 'component:rgb1:common', color: '#cc2222' },
    { from: 'arduino:pin3', to: 'component:r1:pin1', color: '#cc2222' },
    { from: 'component:r1:pin2', to: 'component:rgb1:red', color: '#cc2222' },
    { from: 'arduino:pin5', to: 'component:r2:pin1', color: '#22cc22' },
    { from: 'component:r2:pin2', to: 'component:rgb1:green', color: '#22cc22' },
    { from: 'arduino:pin6', to: 'component:r3:pin1', color: '#2222cc' },
    { from: 'component:r3:pin2', to: 'component:rgb1:blue', color: '#2222cc' },
  ],
};
```

Create `src/projects/index.js`:

```javascript
import { ledBlink } from './led-blink.js';
import { buttonLed } from './button-led.js';
import { rgbMulticolor } from './rgb-multicolor.js';
import { ultrasonicDistanceColor } from './ultrasonic-distance-color.js';

export const projects = [
  ledBlink,
  buttonLed,
  rgbMulticolor,
  ultrasonicDistanceColor,
];
```

**Step 2: Add project loading to main.js**

Update the example select dropdown and add loading logic:

```javascript
import { projects } from './projects/index.js';

// Populate dropdown
const exampleSelect = document.getElementById('example-select');
projects.forEach((project, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = project.name;
  exampleSelect.appendChild(opt);
});

exampleSelect.addEventListener('change', (e) => {
  const index = parseInt(e.target.value, 10);
  if (isNaN(index)) return;
  loadProject(projects[index]);
});

function loadProject(project) {
  // Stop any running code
  if (executor) executor.stop();
  btnRun.disabled = false;
  btnStop.disabled = true;

  // Set code
  editor.setCode(project.code);

  // Clear and rebuild circuit
  renderer.clear();
  wiring.clear();

  // Place components
  project.components.forEach((comp) => {
    renderer.addComponent(comp.type, comp.id, comp.x, comp.y);
  });

  // Add wires
  project.wires.forEach((wire) => {
    // For now, use approximate positions; Task 15 will refine pin position lookup
    renderer.addWire(wire.fromX || 100, wire.fromY || 100, wire.toX || 200, wire.toY || 200, wire.color);
    connectionGraph.addWire(wire.from, wire.to);
  });
}
```

**Step 3: Verify - select an example from dropdown, code and components load**

**Step 4: Commit**

```bash
git add src/projects/ src/main.js
git commit -m "feat: add four sample projects with project loader"
```

---

### Task 14: Integration - Connect Execution to Circuit Visualization

**Files:**
- Create: `src/simulator/circuit-bridge.js`
- Modify: `src/main.js`

This task connects the executor's pin state changes to the visual components on the circuit.

**Step 1: Create bridge module**

Create `src/simulator/circuit-bridge.js`:

```javascript
export class CircuitBridge {
  constructor(runtime, renderer, connectionGraph, componentModels) {
    this.runtime = runtime;
    this.renderer = renderer;
    this.graph = connectionGraph;
    this.models = componentModels; // Map<id, componentModel>

    this.runtime.on('pinChange', (pin, value, mode) => {
      this._onPinChange(pin, value);
    });
  }

  _onPinChange(pin, value) {
    const pinNode = `arduino:pin${pin}`;

    for (const [id, model] of this.models) {
      if (model.type === 'led') {
        const anodeConnected = this.graph.getConnectedNodes(`component:${id}:anode`);
        const cathodeConnected = this.graph.getConnectedNodes(`component:${id}:cathode`);

        // Check if this pin drives the LED
        if (anodeConnected.includes(pinNode) || cathodeConnected.some((n) => n.includes(`pin${pin}`))) {
          const hasResistor = [...anodeConnected, ...cathodeConnected].some((n) => n.includes('resistor') || n.includes(':r'));
          model.update({ anode: value, cathode: 0 }, { hasResistor });
          this.renderer.updateLed(id, model.brightness, model.burnedOut);
        }
      }

      if (model.type === 'rgb-led') {
        const pinMap = { red: null, green: null, blue: null };
        let needsUpdate = false;

        for (const channel of ['red', 'green', 'blue']) {
          const channelConnected = this.graph.getConnectedNodes(`component:${id}:${channel}`);
          for (const node of channelConnected) {
            const match = node.match(/arduino:pin(\d+)/);
            if (match) {
              pinMap[channel] = this.runtime.getPinState(parseInt(match[1], 10)) || 0;
              if (parseInt(match[1], 10) === pin) needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          const commonConnected = this.graph.getConnectedNodes(`component:${id}:common`);
          const hasResistors = ['red', 'green', 'blue'].every((ch) => {
            const connected = this.graph.getConnectedNodes(`component:${id}:${ch}`);
            return connected.some((n) => n.includes('resistor') || n.includes(':r'));
          });

          model.update({
            common: commonConnected.some((n) => n.includes('5V')) ? 1 : 0,
            red: pinMap.red || 0,
            green: pinMap.green || 0,
            blue: pinMap.blue || 0,
          }, { hasResistors });

          this.renderer.updateRgbLed(id, model.color, model.burnedOut);
        }
      }
    }
  }
}
```

**Step 2: Wire bridge into main.js**

Update the `btnRun` click handler to create the bridge after starting execution:

```javascript
import { CircuitBridge } from './simulator/circuit-bridge.js';
// Also import component model classes
import { LED, RgbLed } from './circuit/components/index.js';

// Track component models
const componentModels = new Map();

// Update loadProject to also create models:
function loadProject(project) {
  // ... existing code ...
  componentModels.clear();
  project.components.forEach((comp) => {
    // Create model instances
    if (comp.type === 'led') componentModels.set(comp.id, new LED(comp.id));
    if (comp.type === 'rgb-led') componentModels.set(comp.id, new RgbLed(comp.id));
    // ... etc
  });
}

// Update run handler:
btnRun.addEventListener('click', async () => {
  // ... existing setup ...
  const bridge = new CircuitBridge(runtime, renderer, connectionGraph, componentModels);
  // ... existing execution start ...
});
```

**Step 3: Verify end-to-end**

Load "LED Blink" example, click Run. The LED on the circuit should visually blink on and off every second.

Load "RGB Multicolor" example, click Run. The RGB LED should change colors randomly.

**Step 4: Commit**

```bash
git add src/simulator/circuit-bridge.js src/main.js
git commit -m "feat: bridge executor pin changes to circuit visualization"
```

---

### Task 15: Polish & Integration Testing

**Files:**
- Create: `tests/e2e/basic.test.js`
- Create: `playwright.config.js`
- Modify: `package.json`

**Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: Create Playwright config**

Create `playwright.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
```

**Step 3: Write E2E tests**

Create `tests/e2e/basic.test.js`:

```javascript
import { test, expect } from '@playwright/test';

test('page loads with all panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#code-editor')).toBeVisible();
  await expect(page.locator('#circuit-canvas')).toBeVisible();
  await expect(page.locator('#serial-monitor')).toBeVisible();
});

test('code editor accepts input', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.cm-editor');
  await expect(editor).toBeVisible();
});

test('loading an example populates code and circuit', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#example-select', '0'); // LED Blink
  // Code editor should contain LED blink code
  const editorText = await page.locator('.cm-content').textContent();
  expect(editorText).toContain('ledPin');
});

test('run button starts execution', async ({ page }) => {
  await page.goto('/');
  // Load serial-output-producing example
  await page.selectOption('#example-select', '3'); // Ultrasonic distance
  await page.click('#btn-run');
  // Wait for serial output
  await expect(page.locator('#serial-output')).toContainText('Distance:', { timeout: 5000 });
  await page.click('#btn-stop');
});

test('distance slider updates value display', async ({ page }) => {
  await page.goto('/');
  const slider = page.locator('#distance-slider');
  await slider.fill('50');
  await expect(page.locator('#distance-value')).toHaveText('50');
});
```

**Step 4: Add test scripts to package.json**

```json
"test:e2e": "npx playwright test",
"test:all": "vitest run && npx playwright test"
```

**Step 5: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All PASS.

**Step 6: Run all tests**

```bash
npm run test:all
```

Expected: All unit + E2E tests PASS.

**Step 7: Commit**

```bash
git add tests/e2e/ playwright.config.js package.json package-lock.json
git commit -m "feat: add Playwright E2E tests"
```

---

### Task 16: Build Configuration & Single-File Bundle

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json`

**Step 1: Configure Vite for production build**

Create/update `vite.config.js`:

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000, // Inline small assets
  },
});
```

**Step 2: Add single-file bundle script**

Install vite-plugin-singlefile:

```bash
npm install -D vite-plugin-singlefile
```

Create `vite.config.singlefile.js`:

```javascript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-single',
  },
});
```

Add to package.json scripts:

```json
"bundle": "vite build --config vite.config.singlefile.js"
```

**Step 3: Build and verify**

```bash
npm run build
npm run bundle
ls -la dist/
ls -la dist-single/
```

Expected: `dist/` has index.html + JS/CSS files. `dist-single/` has a single `index.html`.

**Step 4: Test the single-file bundle works**

```bash
npx serve dist-single
```

Open in browser, verify the app works from the single file.

**Step 5: Commit**

```bash
git add vite.config.js vite.config.singlefile.js package.json package-lock.json
git commit -m "feat: add production build and single-file bundle configuration"
```

---

### Summary of Tasks

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project scaffolding (Vite + layout) | None |
| 2 | Code editor (CodeMirror) | Task 1 |
| 3 | Arduino transpiler | Task 1 |
| 4 | Arduino API compatibility layer | Task 1 |
| 5 | Code executor | Tasks 3, 4 |
| 6 | Serial monitor + Run/Stop wiring | Tasks 2, 5 |
| 7 | Breadboard model + connection graph | Task 1 |
| 8 | Component models | Task 1 |
| 9 | SVG circuit renderer | Tasks 7, 8 |
| 10 | Component palette | Task 9 |
| 11 | Wiring system | Tasks 7, 9 |
| 12 | Circuit validator + smoke effect | Tasks 7, 8 |
| 13 | Sample projects + loader | Tasks 2, 9, 11 |
| 14 | Circuit bridge (execution -> visuals) | Tasks 5, 8, 9, 11 |
| 15 | E2E testing with Playwright | All above |
| 16 | Build configuration + single-file bundle | All above |

**Parallelizable groups:**
- Tasks 2, 3, 4, 7, 8 can all be done in parallel after Task 1
- Tasks 5, 9, 12 can be parallelized after their deps
- Tasks 6, 10, 11, 13 form a middle tier
- Tasks 14, 15, 16 are the final integration tier
