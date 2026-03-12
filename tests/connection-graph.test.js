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

  describe('findPath', () => {
    it('finds a direct path between two nodes', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addWire('B', 'C');
      const path = graph.findPath('A', ['C']);
      expect(path).toEqual(['A', 'B', 'C']);
    });

    it('returns null when no path exists', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addWire('C', 'D');
      expect(graph.findPath('A', ['D'])).toBeNull();
    });

    it('finds path to any of multiple end nodes', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addWire('B', 'GND1');
      const path = graph.findPath('A', ['GND1', 'GND2']);
      expect(path).toEqual(['A', 'B', 'GND1']);
    });

    it('returns single-node path when start is an end node', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      const path = graph.findPath('A', ['A']);
      expect(path).toEqual(['A']);
    });

    it('finds path through a longer chain', () => {
      const graph = new ConnectionGraph();
      graph.addWire('5V', 'r1:pin1');
      graph.addWire('r1:pin1', 'r1:pin2');
      graph.addWire('r1:pin2', 'led:anode');
      graph.addWire('led:cathode', 'GND');
      // Need to connect anode to cathode through the graph for BFS
      // In real usage, internal LED pins aren't connected in the graph
      const path = graph.findPath('5V', ['r1:pin2']);
      expect(path).toEqual(['5V', 'r1:pin1', 'r1:pin2']);
    });

    it('accepts a single end node (not array)', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      const path = graph.findPath('A', 'B');
      expect(path).toEqual(['A', 'B']);
    });
  });
});
