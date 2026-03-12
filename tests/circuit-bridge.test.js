import { describe, it, expect, vi } from 'vitest';
import { CircuitBridge } from '../src/simulator/circuit-bridge.js';
import { ConnectionGraph } from '../src/circuit/connection-graph.js';
import { LED } from '../src/circuit/components/led.js';
import { Resistor } from '../src/circuit/components/resistor.js';
import { RgbLed } from '../src/circuit/components/rgb-led.js';

function createMockRuntime() {
  const listeners = {};
  const pinStates = {};
  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    emit(event, ...args) {
      if (event === 'pinChange') pinStates[args[0]] = args[1];
      for (const fn of listeners[event] || []) fn(...args);
    },
    getPinState(pin) {
      return pinStates[pin] !== undefined ? pinStates[pin] : undefined;
    },
  };
}

function createMockRenderer() {
  return {
    updateLed: vi.fn(),
    updateRgbLed: vi.fn(),
  };
}

describe('CircuitBridge', () => {
  it('calls renderer.updateLed when a pin connected to an LED changes', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = new ConnectionGraph();
    const models = new Map();

    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    // Build circuit: pin13 → r1 → led1 → GND
    graph.addWire('arduino:pin13', 'component:r1:pin1');
    graph.addWire('component:r1:pin1', 'component:r1:pin2');
    graph.addWire('component:r1:pin2', 'component:led1:anode');
    graph.addWire('component:led1:anode', 'component:led1:cathode');
    graph.addWire('component:led1:cathode', 'arduino:GND');

    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 13, 1, 'OUTPUT');

    // Should be called with physics-based brightness: (5-2)/220/0.020 ≈ 0.682
    expect(renderer.updateLed).toHaveBeenCalled();
    const [id, brightness, burnedOut] = renderer.updateLed.mock.calls[0];
    expect(id).toBe('led1');
    expect(brightness).toBeCloseTo(0.682, 2);
    expect(burnedOut).toBe(false);
  });

  it('does not light LED when an unrelated pin changes', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = new ConnectionGraph();
    const models = new Map();

    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    graph.addWire('arduino:pin13', 'component:r1:pin1');
    graph.addWire('component:r1:pin1', 'component:r1:pin2');
    graph.addWire('component:r1:pin2', 'component:led1:anode');
    graph.addWire('component:led1:anode', 'component:led1:cathode');
    graph.addWire('component:led1:cathode', 'arduino:GND');

    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 7, 1, 'OUTPUT');

    // LED should be called but with 0 brightness (pin7 doesn't drive it)
    expect(renderer.updateLed).toHaveBeenCalledWith('led1', 0, false);
  });

  it('calls renderer.updateRgbLed when a pin connected to an RGB LED changes', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = new ConnectionGraph();
    const models = new Map();

    models.set('rgb1', new RgbLed('rgb1'));
    models.set('r1', new Resistor('r1', 220));
    models.set('r2', new Resistor('r2', 220));
    models.set('r3', new Resistor('r3', 220));

    // Common-anode: 5V on common, channels sink through resistors to GPIO pins
    graph.addWire('arduino:5V', 'component:rgb1:common');
    graph.addWire('component:rgb1:red', 'component:r1:pin1');
    graph.addWire('component:r1:pin1', 'component:r1:pin2');
    graph.addWire('component:r1:pin2', 'arduino:pin9');
    graph.addWire('component:rgb1:green', 'component:r2:pin1');
    graph.addWire('component:r2:pin1', 'component:r2:pin2');
    graph.addWire('component:r2:pin2', 'arduino:pin10');
    graph.addWire('component:rgb1:blue', 'component:r3:pin1');
    graph.addWire('component:r3:pin1', 'component:r3:pin2');
    graph.addWire('component:r3:pin2', 'arduino:pin11');

    new CircuitBridge(runtime, renderer, graph, models);

    // Pin 9 LOW → max red (common-anode: low = bright)
    runtime.emit('pinChange', 9, 0, 'OUTPUT');

    expect(renderer.updateRgbLed).toHaveBeenCalled();
    const [id, color, burnedOut] = renderer.updateRgbLed.mock.calls[0];
    expect(id).toBe('rgb1');
    expect(burnedOut).toBe(false);
    // Red channel: (5-0-2)/220 = 3/220 → brightness 0.682 → ~174
    expect(color.r).toBeGreaterThan(150);
  });

  it('detects burned out LED without resistor', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = new ConnectionGraph();
    const models = new Map();

    models.set('led1', new LED('led1'));

    graph.addWire('arduino:pin13', 'component:led1:anode');
    graph.addWire('component:led1:anode', 'component:led1:cathode');
    graph.addWire('component:led1:cathode', 'arduino:GND');

    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 13, 1, 'OUTPUT');

    expect(renderer.updateLed).toHaveBeenCalledWith('led1', 0, true);
  });
});
