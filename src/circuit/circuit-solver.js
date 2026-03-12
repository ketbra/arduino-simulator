export const LED_FORWARD_VOLTAGE = 2.0;
export const LED_INTERNAL_RESISTANCE = 25;
export const DEFAULT_RESISTANCE = 220;
export const NOMINAL_LED_CURRENT = 0.020;
export const MAX_LED_CURRENT = 0.030;
export const SUPPLY_VOLTAGES = { '5V': 5.0, '3V3': 3.3 };

const POWER_NODES = ['arduino:5V', 'arduino:3V3'];
const GND_NODES = ['arduino:GND', 'arduino:GND2'];

function getNodeComponentInfo(node, componentModels) {
  const match = node.match(/^component:([^:]+):(.+)$/);
  if (!match) return null;
  const [, id, pin] = match;
  const model = componentModels.get(id);
  if (!model) return null;
  return { id, pin, model };
}

function collectPathComponents(path, componentModels) {
  const resistors = [];
  const leds = [];
  const seen = new Set();

  for (const node of path) {
    const info = getNodeComponentInfo(node, componentModels);
    if (!info || seen.has(info.id)) continue;
    seen.add(info.id);
    if (info.model.type === 'resistor') {
      resistors.push({ id: info.id, ohms: info.model.ohms });
    } else if (info.model.type === 'led') {
      leds.push({ id: info.id, pin: info.pin });
    }
  }
  return { resistors, leds };
}

function getSupplyVoltage(node) {
  if (node === 'arduino:5V') return 5.0;
  if (node === 'arduino:3V3') return 3.3;
  // GPIO pin voltages are passed via powerSources
  return null;
}

export function solveCircuit(graph, componentModels, powerSources, groundNodes) {
  const results = new Map();
  const gndNodes = groundNodes || GND_NODES;

  for (const [id, model] of componentModels) {
    if (model.type === 'led') {
      results.set(id, solveLed(id, model, graph, componentModels, powerSources, gndNodes));
    } else if (model.type === 'rgb-led') {
      results.set(id, solveRgbLed(id, model, graph, componentModels, powerSources, gndNodes));
    }
  }

  return results;
}

export function detectShortCircuits(graph, powerSources, groundNodes) {
  const gndNodes = groundNodes || GND_NODES;
  const powerMap = buildPowerMap(powerSources);
  const shorts = [];

  for (const [powerNode, voltage] of powerMap) {
    if (voltage <= 0) continue;
    const path = graph.findPathExcludingInternal(powerNode, gndNodes);
    if (path) {
      shorts.push({ path, powerNode, groundNode: path[path.length - 1] });
    }
  }

  return shorts;
}

function buildPowerMap(powerSources) {
  const powerMap = new Map();
  for (const ps of powerSources) {
    powerMap.set(ps.node, ps.voltage);
  }
  for (const pn of POWER_NODES) {
    if (!powerMap.has(pn)) {
      const v = getSupplyVoltage(pn);
      if (v !== null) powerMap.set(pn, v);
    }
  }
  return powerMap;
}

function solveLed(id, model, graph, componentModels, powerSources, gndNodes) {
  const anodeNode = `component:${id}:anode`;
  const cathodeNode = `component:${id}:cathode`;

  const powerMap = buildPowerMap(powerSources);
  const allPowerNodes = [...powerMap.keys()];

  // Find path from any power source to any ground through this LED
  // With internal connections (anode↔cathode), BFS can traverse through LEDs
  const pathToPower = graph.findPath(anodeNode, allPowerNodes);
  if (!pathToPower) return { brightness: 0, burnedOut: false };

  const pathToGnd = graph.findPath(cathodeNode, gndNodes);
  if (!pathToGnd) return { brightness: 0, burnedOut: false };

  // Polarity check: the path from anode to power should NOT go through cathode.
  // If it does, that means power is on the cathode side → reversed LED.
  const anodePowerPathGoesThruCathode = pathToPower.includes(cathodeNode);
  const cathodeGndPathGoesThruAnode = pathToGnd.includes(anodeNode);

  if (anodePowerPathGoesThruCathode || cathodeGndPathGoesThruAnode) {
    // Power is on cathode side or GND is on anode side → reversed
    return { brightness: 0, burnedOut: false, reversed: true };
  }

  // Get supply voltage from the power node we reached
  const powerNode = pathToPower[pathToPower.length - 1];
  const supplyVoltage = powerMap.get(powerNode) || 0;

  if (supplyVoltage <= 0) return { brightness: 0, burnedOut: false };

  // Combine both path segments for component analysis
  const fullPath = [...pathToPower, ...pathToGnd];
  const { resistors, leds } = collectPathComponents(fullPath, componentModels);

  // Count LEDs on this path (including the one we're solving for)
  const ledCount = Math.max(leds.length, 1);
  const totalForwardVoltage = ledCount * LED_FORWARD_VOLTAGE;
  const availableVoltage = supplyVoltage - totalForwardVoltage;

  if (availableVoltage <= 0) {
    return { brightness: 0, burnedOut: false };
  }

  const totalResistance = resistors.length > 0
    ? resistors.reduce((sum, r) => sum + r.ohms, 0)
    : LED_INTERNAL_RESISTANCE;

  const current = availableVoltage / totalResistance;

  if (current > MAX_LED_CURRENT && resistors.length === 0) {
    return { brightness: 0, burnedOut: true };
  }

  const brightness = Math.min(current / NOMINAL_LED_CURRENT, 1);
  return { brightness, burnedOut: false };
}

function solveRgbLed(id, model, graph, componentModels, powerSources, gndNodes) {
  const commonNode = `component:${id}:common`;

  // Check if common is connected to 5V (common-anode configuration)
  const commonConnected = graph.getConnectedNodes(commonNode);
  const commonHas5V = commonConnected.some(n => n === 'arduino:5V');

  if (!commonHas5V) {
    return { color: { r: 0, g: 0, b: 0 }, burnedOut: false };
  }

  const color = { r: 0, g: 0, b: 0 };
  let anyBurnout = false;

  for (const channel of ['red', 'green', 'blue']) {
    const channelNode = `component:${id}:${channel}`;
    const channelConnected = graph.getConnectedNodes(channelNode);

    // Find which GPIO pin drives this channel
    let pinVoltage = null;
    for (const ps of powerSources) {
      if (channelConnected.includes(ps.node)) {
        pinVoltage = ps.voltage;
        break;
      }
    }

    // Also check if channel is connected to GND directly (for testing)
    if (pinVoltage === null) {
      const hasGnd = channelConnected.some(n => gndNodes.includes(n));
      if (hasGnd) pinVoltage = 0;
    }

    if (pinVoltage === null) {
      // Channel not connected to anything driving it
      color[channel[0]] = 0;
      continue;
    }

    // Common-anode: current flows from 5V through LED to pin
    // Voltage across LED = 5V - pinVoltage - LED_FORWARD_VOLTAGE
    const vAcross = 5.0 - pinVoltage - LED_FORWARD_VOLTAGE;

    if (vAcross <= 0) {
      color[channel[0]] = 0;
      continue;
    }

    // Find resistors on this channel's path (deduplicate by component ID)
    const channelResistors = [];
    const seenResistors = new Set();
    for (const node of channelConnected) {
      const info = getNodeComponentInfo(node, componentModels);
      if (info && info.model.type === 'resistor' && !seenResistors.has(info.id)) {
        seenResistors.add(info.id);
        channelResistors.push(info.model.ohms);
      }
    }

    const totalR = channelResistors.length > 0
      ? channelResistors.reduce((sum, r) => sum + r, 0)
      : LED_INTERNAL_RESISTANCE;

    const current = vAcross / totalR;

    if (current > MAX_LED_CURRENT && channelResistors.length === 0) {
      anyBurnout = true;
      continue;
    }

    const brightness = Math.min(current / NOMINAL_LED_CURRENT, 1);
    color[channel[0]] = Math.round(brightness * 255);
  }

  return { color, burnedOut: anyBurnout };
}
