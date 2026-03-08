export class ConnectionGraph {
  constructor() {
    this.edges = new Map();
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
