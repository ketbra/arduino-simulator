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

  describe('addInternalWire', () => {
    it('creates a normal edge and records it as internal', () => {
      const graph = new ConnectionGraph();
      graph.addInternalWire('A', 'B');
      expect(graph.areConnected('A', 'B')).toBe(true);
      expect(graph.isInternalEdge('A', 'B')).toBe(true);
      expect(graph.isInternalEdge('B', 'A')).toBe(true);
    });

    it('regular addWire is not internal', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      expect(graph.isInternalEdge('A', 'B')).toBe(false);
    });
  });

  describe('findPathExcludingInternal', () => {
    it('finds path using only external edges', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addWire('B', 'C');
      const path = graph.findPathExcludingInternal('A', ['C']);
      expect(path).toEqual(['A', 'B', 'C']);
    });

    it('skips internal edges', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addInternalWire('B', 'C');
      graph.addWire('C', 'D');
      // Only path A→B→C→D exists, but B→C is internal, so no external-only path
      const path = graph.findPathExcludingInternal('A', ['D']);
      expect(path).toBeNull();
    });

    it('returns null when only path goes through internal edge', () => {
      const graph = new ConnectionGraph();
      graph.addWire('5V', 'component:r1:pin1');
      graph.addInternalWire('component:r1:pin1', 'component:r1:pin2');
      graph.addWire('component:r1:pin2', 'GND');
      const path = graph.findPathExcludingInternal('5V', ['GND']);
      expect(path).toBeNull();
    });

    it('finds path when alternative external route exists', () => {
      const graph = new ConnectionGraph();
      graph.addWire('A', 'B');
      graph.addInternalWire('B', 'C'); // internal
      graph.addWire('A', 'D');
      graph.addWire('D', 'C');
      const path = graph.findPathExcludingInternal('A', ['C']);
      expect(path).not.toBeNull();
      expect(path[0]).toBe('A');
      expect(path[path.length - 1]).toBe('C');
    });

    it('clear() clears internal edges', () => {
      const graph = new ConnectionGraph();
      graph.addInternalWire('A', 'B');
      graph.clear();
      expect(graph.isInternalEdge('A', 'B')).toBe(false);
      expect(graph.edges.size).toBe(0);
    });
  });
});
