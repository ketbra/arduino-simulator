export class ConnectionGraph {
  constructor() {
    this.edges = new Map();
    this.internalEdges = new Set();
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

  addInternalWire(nodeA, nodeB) {
    this.addWire(nodeA, nodeB);
    this.internalEdges.add(`${nodeA}|${nodeB}`);
    this.internalEdges.add(`${nodeB}|${nodeA}`);
  }

  isInternalEdge(nodeA, nodeB) {
    return this.internalEdges.has(`${nodeA}|${nodeB}`);
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

  findPath(startNode, endNodes) {
    const endSet = new Set(Array.isArray(endNodes) ? endNodes : [endNodes]);
    const visited = new Set();
    const parent = new Map();
    const queue = [startNode];
    visited.add(startNode);

    while (queue.length > 0) {
      const node = queue.shift();
      if (endSet.has(node)) {
        // Reconstruct path
        const path = [];
        let current = node;
        while (current !== undefined) {
          path.unshift(current);
          current = parent.get(current);
        }
        return path;
      }
      const neighbors = this.edges.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            parent.set(neighbor, node);
            queue.push(neighbor);
          }
        }
      }
    }
    return null;
  }

  findPathExcludingInternal(startNode, endNodes) {
    const endSet = new Set(Array.isArray(endNodes) ? endNodes : [endNodes]);
    const visited = new Set();
    const parent = new Map();
    const queue = [startNode];
    visited.add(startNode);

    while (queue.length > 0) {
      const node = queue.shift();
      if (endSet.has(node)) {
        const path = [];
        let current = node;
        while (current !== undefined) {
          path.unshift(current);
          current = parent.get(current);
        }
        return path;
      }
      const neighbors = this.edges.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && !this.isInternalEdge(node, neighbor)) {
            visited.add(neighbor);
            parent.set(neighbor, node);
            queue.push(neighbor);
          }
        }
      }
    }
    return null;
  }

  clear() {
    this.edges.clear();
    this.internalEdges.clear();
  }
}
