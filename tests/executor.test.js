import { describe, it, expect, beforeEach } from 'vitest';
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

  it('reports compilation errors', async () => {
    await expect(executor.loadAndRunSetup('this is not valid {')).rejects.toThrow();
  });
});
