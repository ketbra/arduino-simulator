export function validateCircuit(components, connectionGraph) {
  const errors = [];
  const warnings = [];

  for (const comp of components) {
    if (comp.type === 'led') {
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

      const allConnected = [...anodeConnected, ...cathodeConnected];
      const hasResistor = allConnected.some((node) => node.match(/component:r\w*:pin/));
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
      for (const pin of ['red', 'green', 'blue']) {
        const node = `component:${comp.id}:${pin}`;
        const connected = connectionGraph.getConnectedNodes(node);
        const hasResistor = connected.some((n) => n.match(/component:r\w*:pin/));
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
