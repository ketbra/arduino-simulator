import { describe, it, expect, vi } from 'vitest';
import { CircuitBridge } from '../src/simulator/circuit-bridge.js';

function createMockRuntime() {
  const listeners = {};
  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    emit(event, ...args) {
      for (const fn of listeners[event] || []) fn(...args);
    },
    getPinState: vi.fn().mockReturnValue(0),
  };
}

function createMockRenderer() {
  return {
    updateLed: vi.fn(),
    updateRgbLed: vi.fn(),
  };
}

function createMockGraph(mapping) {
  return {
    getConnectedNodes(node) {
      return mapping[node] || [];
    },
  };
}

describe('CircuitBridge', () => {
  it('calls renderer.updateLed when a pin connected to an LED changes', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = createMockGraph({
      'component:led1:anode': ['component:r1:pin2', 'arduino:pin13'],
      'component:led1:cathode': ['bus:gnd'],
    });

    const ledModel = {
      type: 'led',
      brightness: 0,
      burnedOut: false,
      update(pinValues, context) {
        if (context.hasResistor) {
          this.brightness = pinValues.anode > 0 ? 1 : 0;
        }
      },
    };

    const models = new Map([['led1', ledModel]]);
    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 13, 1, 'OUTPUT');

    expect(renderer.updateLed).toHaveBeenCalledWith('led1', 1, false);
  });

  it('does not call renderer.updateLed when an unrelated pin changes', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = createMockGraph({
      'component:led1:anode': ['arduino:pin13'],
      'component:led1:cathode': ['bus:gnd'],
    });

    const ledModel = {
      type: 'led',
      brightness: 0,
      burnedOut: false,
      update() {},
    };

    const models = new Map([['led1', ledModel]]);
    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 7, 1, 'OUTPUT');

    expect(renderer.updateLed).not.toHaveBeenCalled();
  });

  it('calls renderer.updateRgbLed when a pin connected to an RGB LED changes', () => {
    const runtime = createMockRuntime();
    runtime.getPinState.mockImplementation((pin) => {
      if (pin === 9) return 100;
      if (pin === 10) return 0;
      if (pin === 11) return 0;
      return 0;
    });

    const renderer = createMockRenderer();
    const graph = createMockGraph({
      'component:rgb1:red': ['arduino:pin9', 'component:r1:pin1'],
      'component:rgb1:green': ['arduino:pin10', 'component:r2:pin1'],
      'component:rgb1:blue': ['arduino:pin11', 'component:r3:pin1'],
      'component:rgb1:common': ['bus:5V'],
    });

    const rgbModel = {
      type: 'rgb-led',
      color: { r: 0, g: 0, b: 0 },
      burnedOut: false,
      update(pinValues, context) {
        this.color = {
          r: 255 - (pinValues.red || 0),
          g: 255 - (pinValues.green || 0),
          b: 255 - (pinValues.blue || 0),
        };
      },
    };

    const models = new Map([['rgb1', rgbModel]]);
    new CircuitBridge(runtime, renderer, graph, models);

    // Pin 9 is the red channel
    runtime.emit('pinChange', 9, 100, 'OUTPUT');

    expect(renderer.updateRgbLed).toHaveBeenCalledWith(
      'rgb1',
      { r: 155, g: 255, b: 255 },
      false,
    );
  });

  it('detects burned out LED without resistor', () => {
    const runtime = createMockRuntime();
    const renderer = createMockRenderer();
    const graph = createMockGraph({
      'component:led1:anode': ['arduino:pin13'],
      'component:led1:cathode': ['bus:gnd'],
    });

    const ledModel = {
      type: 'led',
      brightness: 0,
      burnedOut: false,
      update(pinValues, context) {
        if (!context.hasResistor && pinValues.anode > 0) {
          this.burnedOut = true;
          this.brightness = 0;
        }
      },
    };

    const models = new Map([['led1', ledModel]]);
    new CircuitBridge(runtime, renderer, graph, models);

    runtime.emit('pinChange', 13, 1, 'OUTPUT');

    expect(renderer.updateLed).toHaveBeenCalledWith('led1', 0, true);
  });
});
