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

    const components = [{ id: 'led1', type: 'led' }];
    const result = validateCircuit(components, graph);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ componentId: 'led1', type: 'unconnected-pin' })
    );
  });

  it('checks RGB LED channels for resistors', () => {
    const graph = new ConnectionGraph();
    graph.addWire('arduino:5V', 'component:rgb1:common');
    graph.addWire('arduino:pin11', 'component:rgb1:red');
    graph.addWire('arduino:pin10', 'component:rgb1:green');
    graph.addWire('arduino:pin9', 'component:rgb1:blue');

    const components = [{ id: 'rgb1', type: 'rgb-led' }];
    const result = validateCircuit(components, graph);
    expect(result.errors.filter((e) => e.type === 'no-resistor')).toHaveLength(3);
  });
});
