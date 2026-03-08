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
    graph.addWire('breadboard:e1', 'breadboard:f1');
    graph.addBreadboardNets(['breadboard:a1', 'breadboard:e1']);
    graph.addBreadboardNets(['breadboard:f1', 'breadboard:j1']);
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
