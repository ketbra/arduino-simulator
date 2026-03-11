/**
 * Breadboard Layout Engine — Column Assignment
 *
 * Takes a component list and wire list, traces signal-flow chains via BFS
 * from Arduino pins, and assigns each component a breadboard column.
 *
 * Breadboard model:
 *   - 30 columns (1–30)
 *   - Rows a–e (top half) are connected per column
 *   - Rows f–j (bottom half) are connected per column
 *   - Power rail + and power rail − run horizontally
 *   - Components straddle the center gap (row e top, row f bottom)
 */

// How many breadboard columns each component type occupies, and pin layout
const COMPONENT_SPECS = {
  resistor: {
    colSpan: 1,
    // pin1 in row e (top), pin2 in row f (bottom) — straddles gap
    pins: [
      { name: 'pin1', rowGroup: 'top', colOffset: 0 },
      { name: 'pin2', rowGroup: 'bot', colOffset: 0 },
    ],
  },
  led: {
    colSpan: 1,
    // anode in row e (top), cathode in row f (bottom) — straddles gap
    pins: [
      { name: 'anode', rowGroup: 'top', colOffset: 0 },
      { name: 'cathode', rowGroup: 'bot', colOffset: 0 },
    ],
  },
  'push-button': {
    colSpan: 2,
    // Straddles gap across 2 columns
    // pin1a/pin2a in col N (top/bot), pin1b/pin2b in col N+1 (top/bot)
    pins: [
      { name: 'pin1a', rowGroup: 'top', colOffset: 0 },
      { name: 'pin2a', rowGroup: 'bot', colOffset: 0 },
      { name: 'pin1b', rowGroup: 'top', colOffset: 1 },
      { name: 'pin2b', rowGroup: 'bot', colOffset: 1 },
    ],
  },
  'rgb-led': {
    colSpan: 4,
    // All pins in row e (top) — they need wires from above
    pins: [
      { name: 'common', rowGroup: 'top', colOffset: 0 },
      { name: 'red', rowGroup: 'top', colOffset: 1 },
      { name: 'green', rowGroup: 'top', colOffset: 2 },
      { name: 'blue', rowGroup: 'top', colOffset: 3 },
    ],
  },
  'ultrasonic-sensor': {
    colSpan: 4,
    // All pins in row e (top)
    pins: [
      { name: 'vcc', rowGroup: 'top', colOffset: 0 },
      { name: 'trig', rowGroup: 'top', colOffset: 1 },
      { name: 'echo', rowGroup: 'top', colOffset: 2 },
      { name: 'gnd', rowGroup: 'top', colOffset: 3 },
    ],
  },
};

// Arduino power pins
const POWER_PINS = new Set(['arduino:5V', 'arduino:3.3V', 'arduino:GND']);

// Gap between placed components (in columns)
const COMPONENT_GAP = 1;

// Starting column for first component
const START_COL = 2;

/**
 * Parse a pin ID into its parts.
 * e.g. "component:r1:pin1" → { domain: 'component', id: 'r1', pin: 'pin1' }
 *      "arduino:pin13"     → { domain: 'arduino', id: null, pin: 'pin13' }
 */
function parsePinId(pinId) {
  const parts = pinId.split(':');
  if (parts[0] === 'arduino') {
    return { domain: 'arduino', id: null, pin: parts[1] };
  }
  return { domain: parts[0], id: parts[1], pin: parts[2] };
}

/**
 * Check if a pin ID is an Arduino GPIO pin (not power/ground).
 */
function isArduinoGpio(pinId) {
  return pinId.startsWith('arduino:') && !POWER_PINS.has(pinId);
}

/**
 * Check if a pin ID is an Arduino power pin.
 */
function isArduinoPower(pinId) {
  return POWER_PINS.has(pinId);
}

/**
 * Determine what rail type a power pin connects to.
 */
function getRailType(pinId) {
  if (pinId === 'arduino:5V' || pinId === 'arduino:3.3V') return '+';
  if (pinId === 'arduino:GND') return '-';
  return null;
}

/**
 * Build adjacency map from wires and internal component connections.
 *
 * Internal connections for push-button: pin1a ↔ pin1b, pin2a ↔ pin2b
 * (these are connected internally when the button is pressed, but for
 * layout purposes we model the physical pin pairs that are always connected)
 */
function buildAdjacency(components, wires) {
  const adj = new Map();

  function ensureNode(node) {
    if (!adj.has(node)) adj.set(node, new Set());
  }

  function addEdge(a, b) {
    ensureNode(a);
    ensureNode(b);
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  // Add wire edges
  for (const wire of wires) {
    addEdge(wire.from, wire.to);
  }

  // Add internal component connections
  for (const comp of components) {
    if (comp.type === 'push-button') {
      // pin1a and pin1b are always internally connected (same side)
      // pin2a and pin2b are always internally connected (same side)
      addEdge(`component:${comp.id}:pin1a`, `component:${comp.id}:pin1b`);
      addEdge(`component:${comp.id}:pin2a`, `component:${comp.id}:pin2b`);
    }
    // For other components, current flows through the component body,
    // so we model adjacency through all pins of the component
    for (let i = 0; i < comp.pins.length; i++) {
      for (let j = i + 1; j < comp.pins.length; j++) {
        addEdge(
          `component:${comp.id}:${comp.pins[i]}`,
          `component:${comp.id}:${comp.pins[j]}`
        );
      }
    }
  }

  return adj;
}

/**
 * BFS from seed pins to discover component ordering.
 * Returns components in BFS discovery order.
 */
function bfsComponentOrder(adj, seedPins, components) {
  const compMap = new Map();
  for (const comp of components) {
    compMap.set(comp.id, comp);
  }

  const visited = new Set();
  const orderedCompIds = [];
  const compSeen = new Set();

  // Collect and sort seed pins: GPIO pins sorted descending by number, then power pins
  const gpioPins = seedPins.filter(isArduinoGpio).sort((a, b) => {
    const numA = parseInt(a.replace('arduino:pin', ''), 10) || 0;
    const numB = parseInt(b.replace('arduino:pin', ''), 10) || 0;
    return numB - numA;
  });
  const powerPins = seedPins.filter(isArduinoPower);
  const sortedSeeds = [...gpioPins, ...powerPins];

  for (const seed of sortedSeeds) {
    if (visited.has(seed)) continue;

    const queue = [seed];
    visited.add(seed);

    while (queue.length > 0) {
      const node = queue.shift();
      const parsed = parsePinId(node);

      // If this is a component pin, record the component
      if (parsed.domain === 'component' && !compSeen.has(parsed.id)) {
        compSeen.add(parsed.id);
        if (compMap.has(parsed.id)) {
          orderedCompIds.push(parsed.id);
        }
      }

      const neighbors = adj.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  // Catch any components not reached by BFS (disconnected components)
  for (const comp of components) {
    if (!compSeen.has(comp.id)) {
      orderedCompIds.push(comp.id);
    }
  }

  return orderedCompIds;
}

/**
 * Assign columns to components left-to-right based on BFS order.
 */
function assignColumns(orderedCompIds, compMap) {
  // First pass: calculate total columns needed
  let totalCols = 0;
  const validComps = [];
  for (const compId of orderedCompIds) {
    const comp = compMap.get(compId);
    if (!comp) continue;
    const spec = COMPONENT_SPECS[comp.type];
    if (!spec) continue;
    validComps.push({ compId, comp, spec });
    totalCols += spec.colSpan;
  }
  totalCols += Math.max(0, validComps.length - 1) * COMPONENT_GAP;

  // Center components on the breadboard (30 columns)
  const startCol = Math.max(START_COL, Math.floor((30 - totalCols) / 2) + 1);

  const placements = new Map();
  let nextCol = startCol;

  for (const { compId, comp, spec } of validComps) {
    // Check we don't exceed 30 columns
    if (nextCol + spec.colSpan - 1 > 30) break;

    placements.set(compId, {
      startCol: nextCol,
      colSpan: spec.colSpan,
      type: comp.type,
    });

    nextCol += spec.colSpan + COMPONENT_GAP;
  }

  return placements;
}

/**
 * Get the breadboard hole info for a component pin given its placement.
 */
function getPinHole(compId, pinName, placements) {
  const placement = placements.get(compId);
  if (!placement) return null;

  const spec = COMPONENT_SPECS[placement.type];
  if (!spec) return null;

  const pinSpec = spec.pins.find((p) => p.name === pinName);
  if (!pinSpec) return null;

  // If the component is flipped, swap top↔bot row groups
  let rowGroup = pinSpec.rowGroup;
  if (placement.flipped) {
    rowGroup = rowGroup === 'top' ? 'bot' : 'top';
  }

  return {
    col: placement.startCol + pinSpec.colOffset,
    row: rowGroup,
    compId,
    pinName,
  };
}

/**
 * Generate jumper wires:
 * - Arduino GPIO → breadboard top-row hole
 * - Power rail connections (5V/3.3V → + rail, GND → - rail, then rail → component)
 * - Component-to-component wires (skip if same column+rowGroup = implicit connection)
 */
function generateJumperWires(wires, placements, components) {
  const jumperWires = [];
  const compMap = new Map();
  for (const comp of components) {
    compMap.set(comp.id, comp);
  }

  for (const wire of wires) {
    const fromParsed = parsePinId(wire.from);
    const toParsed = parsePinId(wire.to);

    // Arduino GPIO → component pin
    if (fromParsed.domain === 'arduino' && !isArduinoPower(wire.from)) {
      if (toParsed.domain === 'component') {
        const hole = getPinHole(toParsed.id, toParsed.pin, placements);
        if (hole) {
          jumperWires.push({
            from: wire.from,
            toHole: { col: hole.col, row: hole.row },
            color: wire.color || '#22cc22',
          });
        }
      }
    }
    // Component pin → Arduino GPIO (reverse direction)
    else if (toParsed.domain === 'arduino' && !isArduinoPower(wire.to)) {
      if (fromParsed.domain === 'component') {
        const hole = getPinHole(fromParsed.id, fromParsed.pin, placements);
        if (hole) {
          jumperWires.push({
            from: wire.to,
            toHole: { col: hole.col, row: hole.row },
            color: wire.color || '#22cc22',
          });
        }
      }
    }
    // Power pin → component pin
    else if (isArduinoPower(wire.from) && toParsed.domain === 'component') {
      const railType = getRailType(wire.from);
      const hole = getPinHole(toParsed.id, toParsed.pin, placements);
      if (hole) {
        jumperWires.push({
          from: wire.from,
          toHole: { col: hole.col, row: hole.row },
          railType,
          color: wire.color || (railType === '+' ? '#cc2222' : '#222222'),
        });
      }
    }
    // Component pin → power pin (reverse direction)
    else if (isArduinoPower(wire.to) && fromParsed.domain === 'component') {
      const railType = getRailType(wire.to);
      const hole = getPinHole(fromParsed.id, fromParsed.pin, placements);
      if (hole) {
        jumperWires.push({
          from: wire.to,
          toHole: { col: hole.col, row: hole.row },
          railType,
          color: wire.color || (railType === '+' ? '#cc2222' : '#222222'),
        });
      }
    }
    // Component pin → component pin
    else if (
      fromParsed.domain === 'component' &&
      toParsed.domain === 'component'
    ) {
      const fromHole = getPinHole(
        fromParsed.id,
        fromParsed.pin,
        placements
      );
      const toHole = getPinHole(toParsed.id, toParsed.pin, placements);
      if (fromHole && toHole) {
        // Skip if same column and same row-group (implicit breadboard connection)
        if (fromHole.col === toHole.col && fromHole.row === toHole.row) {
          continue;
        }
        jumperWires.push({
          fromHole: { col: fromHole.col, row: fromHole.row },
          toHole: { col: toHole.col, row: toHole.row },
          color: '#2222cc',
        });
      }
    }
  }

  return jumperWires;
}

/**
 * Build the list of occupied breadboard holes.
 */
function buildOccupiedHoles(placements) {
  const holes = [];

  for (const [compId, placement] of placements) {
    const spec = COMPONENT_SPECS[placement.type];
    if (!spec) continue;

    for (const pinSpec of spec.pins) {
      let rowGroup = pinSpec.rowGroup;
      if (placement.flipped) {
        rowGroup = rowGroup === 'top' ? 'bot' : 'top';
      }
      holes.push({
        col: placement.startCol + pinSpec.colOffset,
        row: rowGroup,
        compId,
        pinName: pinSpec.name,
      });
    }
  }

  return holes;
}

/**
 * Optimize pin orientations for 2-pin straddling components.
 * Flips a component (swaps top/bot row assignments) when doing so
 * keeps component-to-component wires within the same row group.
 *
 * For example: if resistor pin2 (bot) connects to LED anode (top),
 * flipping the LED makes both pins in 'bot', so they connect via
 * the breadboard's internal column wiring (or a short horizontal jumper).
 */
function optimizePinOrientations(placements, wires, compMap) {
  // Only optimize 2-pin straddling components (resistor, led)
  const flippable = new Set(['resistor', 'led']);

  // Get effective row group for a pin, accounting for flips
  function effectiveRow(pinSpec, placement) {
    const row = pinSpec.rowGroup;
    return placement.flipped ? (row === 'top' ? 'bot' : 'top') : row;
  }

  // Process each flippable component and compute a flip score.
  // Positive = flipping improves layout, negative = hurts.
  // Arduino connections (long wires from above) are weighted more heavily
  // than comp-to-comp (short cross-gap wires).
  for (const [compId, placement] of placements) {
    if (!flippable.has(placement.type)) continue;

    const spec = COMPONENT_SPECS[placement.type];
    if (!spec) continue;

    let flipScore = 0;

    for (const wire of wires) {
      const fromP = parsePinId(wire.from);
      const toP = parsePinId(wire.to);

      // Find which pin of this component is involved
      let myPinName = null;
      let otherEnd = null;
      if (fromP.domain === 'component' && fromP.id === compId) {
        myPinName = fromP.pin;
        otherEnd = wire.to;
      } else if (toP.domain === 'component' && toP.id === compId) {
        myPinName = toP.pin;
        otherEnd = wire.from;
      }
      if (!myPinName) continue;

      const pinSpec = spec.pins.find((p) => p.name === myPinName);
      if (!pinSpec) continue;

      const currentRow = effectiveRow(pinSpec, placement);
      const flippedRow = currentRow === 'top' ? 'bot' : 'top';

      const otherP = parsePinId(otherEnd);

      if (otherP.domain === 'arduino') {
        // Arduino connection: prefer 'top' (wires come from above, shorter path)
        // Weight ×2 because Arduino wires are much longer than cross-gap wires
        if (flippedRow === 'top' && currentRow === 'bot') flipScore += 2;
        if (flippedRow === 'bot' && currentRow === 'top') flipScore -= 2;
      } else if (otherP.domain === 'component') {
        // Comp-to-comp: prefer same row group as the other pin
        const otherPlacement = placements.get(otherP.id);
        if (!otherPlacement) continue;
        const otherSpec = COMPONENT_SPECS[otherPlacement.type];
        if (!otherSpec) continue;
        const otherPinSpec = otherSpec.pins.find((p) => p.name === otherP.pin);
        if (!otherPinSpec) continue;

        const otherRow = effectiveRow(otherPinSpec, otherPlacement);
        if (flippedRow === otherRow && currentRow !== otherRow) flipScore += 1;
        if (flippedRow !== otherRow && currentRow === otherRow) flipScore -= 1;
      }
    }

    if (flipScore > 0) {
      placement.flipped = true;
    }
  }
}

/**
 * Main entry point: compute breadboard layout for a circuit.
 *
 * @param {Array} components - Array of component objects (each has .id, .type, .pins)
 * @param {Array} wires - Array of { from, to } pin-ID pairs
 * @returns {{ placements: Map, jumperWires: Array, occupiedHoles: Array }}
 */
export function compute(components, wires) {
  // Edge case: empty circuit
  if (!components || components.length === 0) {
    return {
      placements: new Map(),
      jumperWires: [],
      occupiedHoles: [],
    };
  }

  // Build component lookup
  const compMap = new Map();
  for (const comp of components) {
    compMap.set(comp.id, comp);
  }

  // Step 1: Build adjacency from wires + internal connections
  const adj = buildAdjacency(components, wires);

  // Step 2: Find all Arduino pins present in wires (as BFS seeds)
  const arduinoPins = new Set();
  for (const wire of wires) {
    if (wire.from.startsWith('arduino:')) arduinoPins.add(wire.from);
    if (wire.to.startsWith('arduino:')) arduinoPins.add(wire.to);
  }

  // Step 3: BFS from Arduino pins to determine component order
  const orderedCompIds = bfsComponentOrder(
    adj,
    [...arduinoPins],
    components
  );

  // Step 4: Assign columns left-to-right
  const placements = assignColumns(orderedCompIds, compMap);

  // Step 4b: Optimize pin orientations (flip 2-pin components to reduce cross-group wires)
  optimizePinOrientations(placements, wires, compMap);

  // Step 5: Generate jumper wires
  const jumperWires = generateJumperWires(wires, placements, components);

  // Step 6: Build occupied holes
  const occupiedHoles = buildOccupiedHoles(placements);

  return { placements, jumperWires, occupiedHoles };
}

// Export internals for testing
export { COMPONENT_SPECS, parsePinId, getPinHole };
