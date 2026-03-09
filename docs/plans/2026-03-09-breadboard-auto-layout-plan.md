# Breadboard Auto-Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only breadboard view that auto-lays out schematic components onto a realistic breadboard with signal-flow ordering, row highlighting, and proper gap-straddling.

**Architecture:** A new `BreadboardLayout` class takes the connection graph, component list, and wire list, traces signal-flow chains via BFS from Arduino pins, assigns breadboard column positions, then renders simplified component representations with legs in specific holes. The renderer's `setMode('breadboard')` hides schematic components/wires and shows the breadboard overlay instead. Switching back to schematic reverses it.

**Tech Stack:** Vanilla JS, SVG rendering (same as existing circuit renderer)

---

### Task 1: Breadboard Layout Engine — Column Assignment

**Files:**
- Create: `src/circuit/breadboard-layout.js`
- Test: `tests/breadboard-layout.test.js`

**Context:** The layout engine is the core algorithm. It takes the connection graph edges and component list, traces chains from Arduino pins through the circuit, and assigns each component a breadboard column. This task handles ONLY the data/assignment logic, no rendering.

The breadboard has 30 columns. Components straddle the center gap (one leg in row e, one in row f). Multi-pin components span adjacent columns.

Component pin mappings for column span:
- `resistor` — 2 pins, 1 column (pin1 in row e, pin2 in row f, same column)
- `led` — 2 pins, 1 column (anode in row e, cathode in row f)
- `push-button` — 4 pins, 2 columns (pin1a/pin2a in col N, pin1b/pin2b in col N+1)
- `rgb-led` — 4 pins, 4 columns (common, red, green, blue each get their own column)
- `ultrasonic-sensor` — 4 pins, 4 columns (vcc, trig, echo, gnd)

**Step 1: Write the failing tests**

```javascript
// tests/breadboard-layout.test.js
import { describe, it, expect } from 'vitest';
import { BreadboardLayout } from '../src/circuit/breadboard-layout.js';

describe('BreadboardLayout', () => {
  it('assigns columns to a simple LED circuit', () => {
    // pin13 -> resistor -> LED -> GND
    const components = [
      { type: 'resistor', id: 'r1' },
      { type: 'led', id: 'led1' },
    ];
    const wires = [
      { from: 'arduino:pin13', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    const layout = new BreadboardLayout(components, wires);
    const result = layout.compute();

    // Should have placements for both components
    expect(result.placements.has('r1')).toBe(true);
    expect(result.placements.has('led1')).toBe(true);

    // Resistor should be before LED (signal flow order)
    const r1Col = result.placements.get('r1').startCol;
    const led1Col = result.placements.get('led1').startCol;
    expect(r1Col).toBeLessThan(led1Col);
  });

  it('assigns columns to multi-pin components', () => {
    const components = [
      { type: 'resistor', id: 'r1' },
      { type: 'resistor', id: 'r2' },
      { type: 'resistor', id: 'r3' },
      { type: 'rgb-led', id: 'rgb1' },
    ];
    const wires = [
      { from: 'arduino:pin11', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:rgb1:red' },
      { from: 'arduino:pin10', to: 'component:r2:pin1' },
      { from: 'component:r2:pin2', to: 'component:rgb1:green' },
      { from: 'arduino:pin9', to: 'component:r3:pin1' },
      { from: 'component:r3:pin2', to: 'component:rgb1:blue' },
      { from: 'arduino:5V', to: 'component:rgb1:common' },
    ];

    const layout = new BreadboardLayout(components, wires);
    const result = layout.compute();

    // RGB LED should span 4 columns
    const rgb = result.placements.get('rgb1');
    expect(rgb.colSpan).toBe(4);
  });

  it('generates jumper wires from Arduino pins to breadboard', () => {
    const components = [
      { type: 'resistor', id: 'r1' },
      { type: 'led', id: 'led1' },
    ];
    const wires = [
      { from: 'arduino:pin13', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    const layout = new BreadboardLayout(components, wires);
    const result = layout.compute();

    // Should have jumper wires for pin13->resistor and LED->GND
    expect(result.jumperWires.length).toBeGreaterThanOrEqual(2);
    // One from Arduino pin13 to the resistor's row
    const pin13Jumper = result.jumperWires.find(w => w.from === 'arduino:pin13');
    expect(pin13Jumper).toBeDefined();
  });

  it('detects shared rows that need no wire', () => {
    // When r1:pin2 connects to led1:anode, and they end up in the same
    // breadboard row-group, no jumper wire is needed between them
    const components = [
      { type: 'resistor', id: 'r1' },
      { type: 'led', id: 'led1' },
    ];
    const wires = [
      { from: 'arduino:pin13', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    const layout = new BreadboardLayout(components, wires);
    const result = layout.compute();

    // r1:pin2 is in row f, led1:anode is in row e of its column
    // These are in DIFFERENT row groups, so a jumper IS needed
    // OR the layout places them so pin2 (row f) connects to anode (row e)
    // in adjacent columns via the same row group
    // The key: no jumper needed between components whose pins share a row group
    expect(result.jumperWires).toBeDefined();
  });

  it('handles button circuit with power rails', () => {
    const components = [
      { type: 'push-button', id: 'btn1' },
      { type: 'resistor', id: 'r1' },
      { type: 'led', id: 'led1' },
    ];
    const wires = [
      { from: 'arduino:5V', to: 'component:btn1:pin1a' },
      { from: 'component:btn1:pin2a', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    const layout = new BreadboardLayout(components, wires);
    const result = layout.compute();

    expect(result.placements.has('btn1')).toBe(true);
    // Button should have power rail wire
    const powerWire = result.jumperWires.find(w => w.from === 'arduino:5V' || w.railType === '+');
    expect(powerWire).toBeDefined();
    // GND should have ground rail wire
    const gndWire = result.jumperWires.find(w => w.from === 'arduino:GND' || w.railType === '-');
    expect(gndWire).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/breadboard-layout.test.js`
Expected: FAIL — module not found

**Step 3: Implement the layout engine**

```javascript
// src/circuit/breadboard-layout.js

// Breadboard geometry constants
const COLS = 30;
const ROW_LABELS_TOP = ['a', 'b', 'c', 'd', 'e']; // top half (connected)
const ROW_LABELS_BOT = ['f', 'g', 'h', 'i', 'j']; // bottom half (connected)

// How many columns each component type needs
const COL_SPANS = {
  resistor: 1,
  led: 1,
  'push-button': 2,
  'rgb-led': 4,
  'ultrasonic-sensor': 4,
};

// Pin-to-row assignments for each component type when straddling the gap.
// Each pin gets a { rowHalf: 'top'|'bot', colOffset: N } within the component's column span.
// 'top' means row e (last row of top half), 'bot' means row f (first row of bottom half).
const PIN_ASSIGNMENTS = {
  resistor: {
    pin1: { rowHalf: 'top', colOffset: 0 },    // row e
    pin2: { rowHalf: 'bot', colOffset: 0 },     // row f
  },
  led: {
    anode: { rowHalf: 'top', colOffset: 0 },    // row e
    cathode: { rowHalf: 'bot', colOffset: 0 },  // row f
  },
  'push-button': {
    pin1a: { rowHalf: 'top', colOffset: 0 },    // row e, col N
    pin1b: { rowHalf: 'top', colOffset: 1 },    // row e, col N+1
    pin2a: { rowHalf: 'bot', colOffset: 0 },    // row f, col N
    pin2b: { rowHalf: 'bot', colOffset: 1 },    // row f, col N+1
  },
  'rgb-led': {
    common: { rowHalf: 'top', colOffset: 0 },
    red:    { rowHalf: 'top', colOffset: 1 },
    green:  { rowHalf: 'top', colOffset: 2 },
    blue:   { rowHalf: 'top', colOffset: 3 },
  },
  'ultrasonic-sensor': {
    vcc:  { rowHalf: 'top', colOffset: 0 },
    trig: { rowHalf: 'top', colOffset: 1 },
    echo: { rowHalf: 'top', colOffset: 2 },
    gnd:  { rowHalf: 'top', colOffset: 3 },
  },
};

const POWER_PINS = new Set(['arduino:5V', 'arduino:3V3']);
const GND_PINS = new Set(['arduino:GND', 'arduino:GND2']);

export class BreadboardLayout {
  constructor(components, wires) {
    this.components = components; // [{ type, id }]
    this.wires = wires;           // [{ from, to }]
    this.componentMap = new Map(); // id -> { type, id }
    for (const c of components) {
      this.componentMap.set(c.id, c);
    }
  }

  compute() {
    // Build adjacency for pin nodes
    const adj = new Map();
    const addEdge = (a, b) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    };
    for (const w of this.wires) {
      addEdge(w.from, w.to);
    }
    // Add internal resistor connections
    for (const c of this.components) {
      if (c.type === 'resistor') {
        addEdge(`component:${c.id}:pin1`, `component:${c.id}:pin2`);
      }
    }

    // Find Arduino GPIO pins used
    const arduinoPins = [];
    for (const node of adj.keys()) {
      if (/^arduino:pin\d+$/.test(node)) arduinoPins.push(node);
    }
    // Also find power/gnd connections
    const powerNodes = [];
    const gndNodes = [];
    for (const node of adj.keys()) {
      if (POWER_PINS.has(node)) powerNodes.push(node);
      if (GND_PINS.has(node)) gndNodes.push(node);
    }

    // BFS from each Arduino pin to find component chains in signal-flow order
    const visited = new Set();
    const chains = []; // Array of arrays of component IDs in order

    // Sort arduino pins descending so pin13 goes first (leftmost on board)
    const startNodes = [...arduinoPins.sort((a, b) => {
      const numA = parseInt(a.match(/\d+$/)[0]);
      const numB = parseInt(b.match(/\d+$/)[0]);
      return numB - numA;
    }), ...powerNodes];

    for (const start of startNodes) {
      const chain = [];
      const queue = [start];
      const bfsVisited = new Set([start]);

      while (queue.length > 0) {
        const node = queue.shift();
        // If this is a component pin, record the component
        const compMatch = node.match(/^component:([^:]+):/);
        if (compMatch) {
          const compId = compMatch[1];
          if (!visited.has(compId)) {
            visited.add(compId);
            chain.push(compId);
          }
        }
        for (const neighbor of (adj.get(node) || [])) {
          if (!bfsVisited.has(neighbor)) {
            bfsVisited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      if (chain.length > 0) chains.push(chain);
    }

    // Assign columns: each chain starts at nextCol, components placed sequentially
    const placements = new Map(); // id -> { startCol, colSpan, type }
    let nextCol = 3; // Start a few columns in from the left edge
    const COL_GAP = 2; // Gap between components

    for (const chain of chains) {
      for (const compId of chain) {
        if (placements.has(compId)) continue; // Already placed from another chain
        const comp = this.componentMap.get(compId);
        if (!comp) continue;
        const span = COL_SPANS[comp.type] || 1;
        if (nextCol + span > COLS) nextCol = 3; // Wrap (shouldn't happen for small circuits)
        placements.set(compId, {
          startCol: nextCol,
          colSpan: span,
          type: comp.type,
        });
        nextCol += span + COL_GAP;
      }
    }

    // Generate jumper wires
    const jumperWires = [];
    const getPinHole = (pinId) => {
      const compMatch = pinId.match(/^component:([^:]+):(.+)$/);
      if (!compMatch) return null;
      const [, compId, pinName] = compMatch;
      const placement = placements.get(compId);
      if (!placement) return null;
      const comp = this.componentMap.get(compId);
      if (!comp) return null;
      const pinAssign = PIN_ASSIGNMENTS[comp.type]?.[pinName];
      if (!pinAssign) return null;
      const col = placement.startCol + pinAssign.colOffset;
      const row = pinAssign.rowHalf; // 'top' or 'bot'
      return { col, row, compId, pinName };
    };

    for (const wire of this.wires) {
      const fromIsArduino = wire.from.startsWith('arduino:');
      const toIsArduino = wire.to.startsWith('arduino:');

      if (fromIsArduino || toIsArduino) {
        const arduinoPin = fromIsArduino ? wire.from : wire.to;
        const compPin = fromIsArduino ? wire.to : wire.from;
        const hole = getPinHole(compPin);
        if (!hole) continue;

        if (POWER_PINS.has(arduinoPin)) {
          jumperWires.push({
            from: arduinoPin,
            toHole: hole,
            railType: '+',
            color: wire.color || '#cc2222',
          });
        } else if (GND_PINS.has(arduinoPin)) {
          jumperWires.push({
            from: arduinoPin,
            toHole: hole,
            railType: '-',
            color: wire.color || '#222222',
          });
        } else {
          // GPIO pin
          jumperWires.push({
            from: arduinoPin,
            toHole: hole,
            color: wire.color || '#22cc22',
          });
        }
      } else {
        // Component-to-component wire
        const fromHole = getPinHole(wire.from);
        const toHole = getPinHole(wire.to);
        if (!fromHole || !toHole) continue;

        // Check if they share a row group (same column, or same row half + same column range)
        const sameRowGroup =
          (fromHole.row === toHole.row && fromHole.col === toHole.col);

        if (!sameRowGroup) {
          jumperWires.push({
            fromHole,
            toHole,
            color: wire.color || '#888888',
          });
        }
        // If same row group: implicit connection via breadboard, no wire needed
      }
    }

    // Build highlight set: which holes have component legs
    const occupiedHoles = [];
    for (const [compId, placement] of placements) {
      const comp = this.componentMap.get(compId);
      const pins = PIN_ASSIGNMENTS[comp.type];
      if (!pins) continue;
      for (const [pinName, assign] of Object.entries(pins)) {
        const col = placement.startCol + assign.colOffset;
        occupiedHoles.push({ col, row: assign.rowHalf, compId, pinName });
      }
    }

    return { placements, jumperWires, occupiedHoles };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/breadboard-layout.test.js`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/circuit/breadboard-layout.js tests/breadboard-layout.test.js
git commit -m "feat: add breadboard layout engine with signal-flow column assignment"
```

---

### Task 2: Breadboard Renderer — Draw Components on the Breadboard

**Files:**
- Create: `src/circuit/breadboard-renderer.js`
- Modify: `src/circuit/svg-components.js` (import `svgEl` helper or export it)
- Test: `tests/breadboard-renderer.test.js`

**Context:** This task renders the breadboard layout result as SVG elements overlaid on the existing breadboard. It draws simplified component representations at their assigned holes, jumper wires, and row-group highlights. Uses the same SVG namespace helpers as `svg-components.js`.

The existing `renderBreadboard(x, y)` in `svg-components.js` creates the board at position (20, 200) with these coordinates:
- `holeSpacing = 16`, holes start at `col * 16 + 10` for x
- Power rail + at y=12, power rail - at y=28
- Top rows a-e at y = 48, 64, 80, 96, 112 (row e = 112)
- Gap at y=98
- Bottom rows f-j at y = 118, 134, 150, 166, 182 (row f = 118)

**Step 1: Write failing tests**

```javascript
// tests/breadboard-renderer.test.js
import { describe, it, expect } from 'vitest';
import { BreadboardRenderer } from '../src/circuit/breadboard-renderer.js';

// Minimal DOM stubs for SVG
function createMockSvgElement() {
  const children = [];
  return {
    tagName: 'g',
    children,
    appendChild(child) { children.push(child); return child; },
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    style: {},
  };
}

describe('BreadboardRenderer', () => {
  it('creates SVG elements for placed components', () => {
    const container = createMockSvgElement();
    const bbRenderer = new BreadboardRenderer(container);

    const layoutResult = {
      placements: new Map([
        ['r1', { startCol: 3, colSpan: 1, type: 'resistor' }],
        ['led1', { startCol: 6, colSpan: 1, type: 'led' }],
      ]),
      jumperWires: [],
      occupiedHoles: [
        { col: 3, row: 'top', compId: 'r1', pinName: 'pin1' },
        { col: 3, row: 'bot', compId: 'r1', pinName: 'pin2' },
        { col: 6, row: 'top', compId: 'led1', pinName: 'anode' },
        { col: 6, row: 'bot', compId: 'led1', pinName: 'cathode' },
      ],
    };

    bbRenderer.render(layoutResult);

    // Should have created child elements (components + highlights)
    expect(container.children.length).toBeGreaterThan(0);
  });

  it('clears previous render before new one', () => {
    const container = createMockSvgElement();
    const bbRenderer = new BreadboardRenderer(container);

    const layoutResult = {
      placements: new Map([['r1', { startCol: 3, colSpan: 1, type: 'resistor' }]]),
      jumperWires: [],
      occupiedHoles: [],
    };

    bbRenderer.render(layoutResult);
    const firstCount = container.children.length;
    bbRenderer.render(layoutResult);
    // Should not double-up elements
    expect(container.children.length).toBe(firstCount);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/breadboard-renderer.test.js`
Expected: FAIL — module not found

**Step 3: Export svgEl from svg-components.js**

In `src/circuit/svg-components.js`, the `svgEl` helper is currently a local function. Export it so the breadboard renderer can reuse it:

Find (around line 1-8 of svg-components.js):
```javascript
function svgEl(tag, attrs = {}) {
```

Change to:
```javascript
export function svgEl(tag, attrs = {}) {
```

**Step 4: Implement the breadboard renderer**

```javascript
// src/circuit/breadboard-renderer.js
import { svgEl } from './svg-components.js';

// Breadboard geometry (must match renderBreadboard in svg-components.js)
// The breadboard is rendered at translate(20, 200)
const BB_X = 20;
const BB_Y = 200;
const HOLE_SPACING = 16;
const POWER_PLUS_Y = 12;
const POWER_MINUS_Y = 28;
const ROW_E_Y = 112;  // last row of top half (48 + 4*16)
const ROW_F_Y = 118;  // first row of bottom half

// Row y-coordinates for highlighting
const TOP_ROWS_Y = [48, 64, 80, 96, 112];   // a, b, c, d, e
const BOT_ROWS_Y = [118, 134, 150, 166, 182]; // f, g, h, i, j

function holeX(col) {
  return col * HOLE_SPACING + 10;
}

function rowY(rowHalf) {
  return rowHalf === 'top' ? ROW_E_Y : ROW_F_Y;
}

// Component visual renderers (simplified for breadboard)
const COMP_RENDERERS = {
  resistor(placement) {
    const cx = holeX(placement.startCol);
    const g = svgEl('g', { class: 'bb-component bb-resistor' });
    // Vertical resistor body straddling the gap
    g.appendChild(svgEl('rect', {
      x: cx - 5, y: ROW_E_Y - 2, width: 10, height: ROW_F_Y - ROW_E_Y + 4,
      rx: 2, fill: '#d4b896', stroke: '#8b7355', 'stroke-width': 1,
    }));
    // Color bands
    g.appendChild(svgEl('rect', { x: cx - 5, y: ROW_E_Y + 1, width: 10, height: 2, fill: '#cc0000' }));
    g.appendChild(svgEl('rect', { x: cx - 5, y: ROW_E_Y + 4, width: 10, height: 2, fill: '#cc0000' }));
    // Pin dots
    g.appendChild(svgEl('circle', { cx, cy: ROW_E_Y, r: 2, fill: '#666' }));
    g.appendChild(svgEl('circle', { cx, cy: ROW_F_Y, r: 2, fill: '#666' }));
    return g;
  },

  led(placement) {
    const cx = holeX(placement.startCol);
    const midY = (ROW_E_Y + ROW_F_Y) / 2;
    const g = svgEl('g', { class: 'bb-component bb-led', 'data-bb-component': placement.id });
    g.appendChild(svgEl('circle', {
      cx, cy: midY, r: 6,
      fill: '#ff000030', stroke: '#cc0000', 'stroke-width': 1.5,
      class: 'bb-led-body',
    }));
    // Legs
    g.appendChild(svgEl('line', { x1: cx, y1: midY - 6, x2: cx, y2: ROW_E_Y, stroke: '#888', 'stroke-width': 1 }));
    g.appendChild(svgEl('line', { x1: cx, y1: midY + 6, x2: cx, y2: ROW_F_Y, stroke: '#888', 'stroke-width': 1 }));
    // Labels
    const aLabel = svgEl('text', { x: cx + 8, y: ROW_E_Y + 3, fill: '#888', 'font-size': 6 });
    aLabel.textContent = '+';
    g.appendChild(aLabel);
    const cLabel = svgEl('text', { x: cx + 8, y: ROW_F_Y + 3, fill: '#888', 'font-size': 6 });
    cLabel.textContent = '−';
    g.appendChild(cLabel);
    return g;
  },

  'push-button'(placement) {
    const cx1 = holeX(placement.startCol);
    const cx2 = holeX(placement.startCol + 1);
    const midX = (cx1 + cx2) / 2;
    const midY = (ROW_E_Y + ROW_F_Y) / 2;
    const g = svgEl('g', { class: 'bb-component bb-button' });
    g.appendChild(svgEl('rect', {
      x: cx1 - 4, y: ROW_E_Y - 2, width: cx2 - cx1 + 8, height: ROW_F_Y - ROW_E_Y + 4,
      rx: 2, fill: '#555', stroke: '#333', 'stroke-width': 1,
    }));
    g.appendChild(svgEl('circle', { cx: midX, cy: midY, r: 4, fill: '#888' }));
    // Pin dots
    g.appendChild(svgEl('circle', { cx: cx1, cy: ROW_E_Y, r: 2, fill: '#666' }));
    g.appendChild(svgEl('circle', { cx: cx2, cy: ROW_E_Y, r: 2, fill: '#666' }));
    g.appendChild(svgEl('circle', { cx: cx1, cy: ROW_F_Y, r: 2, fill: '#666' }));
    g.appendChild(svgEl('circle', { cx: cx2, cy: ROW_F_Y, r: 2, fill: '#666' }));
    return g;
  },

  'rgb-led'(placement) {
    const cx0 = holeX(placement.startCol);
    const cx3 = holeX(placement.startCol + 3);
    const midX = (cx0 + cx3) / 2;
    const midY = (ROW_E_Y + ROW_F_Y) / 2;
    const g = svgEl('g', { class: 'bb-component bb-rgb-led', 'data-bb-component': placement.id });
    g.appendChild(svgEl('circle', {
      cx: midX, cy: midY, r: 8,
      fill: '#ffffff20', stroke: '#999', 'stroke-width': 1.5,
      class: 'bb-rgb-led-body',
    }));
    const label = svgEl('text', { x: midX, y: midY + 3, 'text-anchor': 'middle', fill: '#666', 'font-size': 6 });
    label.textContent = 'RGB';
    g.appendChild(label);
    // Legs
    const pinLabels = ['+', 'R', 'G', 'B'];
    for (let i = 0; i < 4; i++) {
      const cx = holeX(placement.startCol + i);
      g.appendChild(svgEl('line', { x1: cx, y1: ROW_E_Y, x2: cx, y2: midY - 8, stroke: '#888', 'stroke-width': 1 }));
      const t = svgEl('text', { x: cx, y: ROW_E_Y - 3, 'text-anchor': 'middle', fill: '#888', 'font-size': 5 });
      t.textContent = pinLabels[i];
      g.appendChild(t);
    }
    return g;
  },

  'ultrasonic-sensor'(placement) {
    const cx0 = holeX(placement.startCol);
    const cx3 = holeX(placement.startCol + 3);
    const midX = (cx0 + cx3) / 2;
    const g = svgEl('g', { class: 'bb-component bb-ultrasonic' });
    g.appendChild(svgEl('rect', {
      x: cx0 - 6, y: ROW_E_Y - 16, width: cx3 - cx0 + 12, height: 16,
      rx: 2, fill: '#2277bb', stroke: '#1a5c8a', 'stroke-width': 1,
    }));
    // "Eyes"
    const eyeOffset = (cx3 - cx0) / 4;
    g.appendChild(svgEl('circle', { cx: midX - eyeOffset, cy: ROW_E_Y - 8, r: 5, fill: '#ccc', stroke: '#999' }));
    g.appendChild(svgEl('circle', { cx: midX + eyeOffset, cy: ROW_E_Y - 8, r: 5, fill: '#ccc', stroke: '#999' }));
    const label = svgEl('text', { x: midX, y: ROW_E_Y - 18, 'text-anchor': 'middle', fill: '#666', 'font-size': 5 });
    label.textContent = 'HC-SR04';
    g.appendChild(label);
    // Legs
    const pinLabels = ['V', 'T', 'E', 'G'];
    for (let i = 0; i < 4; i++) {
      const cx = holeX(placement.startCol + i);
      g.appendChild(svgEl('line', { x1: cx, y1: ROW_E_Y, x2: cx, y2: ROW_E_Y, stroke: '#888', 'stroke-width': 1 }));
      g.appendChild(svgEl('circle', { cx, cy: ROW_E_Y, r: 2, fill: '#666' }));
    }
    return g;
  },
};

export class BreadboardRenderer {
  constructor(svgContainer) {
    this.container = svgContainer;
    this.overlayGroup = null;
  }

  render(layoutResult) {
    // Clear previous overlay
    this.clear();

    this.overlayGroup = svgEl('g', { class: 'breadboard-overlay' });

    // 1. Draw row-group highlights for occupied holes
    this._drawHighlights(layoutResult.occupiedHoles);

    // 2. Draw components
    for (const [compId, placement] of layoutResult.placements) {
      const renderFn = COMP_RENDERERS[placement.type];
      if (renderFn) {
        const compEl = renderFn({ ...placement, id: compId });
        this.overlayGroup.appendChild(compEl);
      }
    }

    // 3. Draw jumper wires
    this._drawJumperWires(layoutResult.jumperWires);

    this.container.appendChild(this.overlayGroup);
  }

  _drawHighlights(occupiedHoles) {
    const highlighted = new Set();
    for (const hole of occupiedHoles) {
      const key = `${hole.row}:${hole.col}`;
      if (highlighted.has(key)) continue;
      highlighted.add(key);

      const rowsY = hole.row === 'top' ? TOP_ROWS_Y : BOT_ROWS_Y;
      const cx = holeX(hole.col);
      for (const ry of rowsY) {
        this.overlayGroup.appendChild(svgEl('circle', {
          cx, cy: ry, r: 5,
          fill: '#ffee0033', stroke: '#ddcc0044', 'stroke-width': 0.5,
          class: 'bb-highlight',
        }));
      }
    }
  }

  _drawJumperWires(jumperWires) {
    for (const wire of jumperWires) {
      if (wire.railType) {
        // Power/GND rail to component
        const cx = holeX(wire.toHole.col);
        const compY = rowY(wire.toHole.row);
        const railY = wire.railType === '+' ? POWER_PLUS_Y : POWER_MINUS_Y;
        this.overlayGroup.appendChild(svgEl('line', {
          x1: cx, y1: railY, x2: cx, y2: compY,
          stroke: wire.color || '#888', 'stroke-width': 1.5, 'stroke-linecap': 'round',
          class: 'bb-wire',
        }));
      } else if (wire.toHole && wire.from) {
        // Arduino GPIO pin to component — draw from top of breadboard
        const cx = holeX(wire.toHole.col);
        const compY = rowY(wire.toHole.row);
        // Wire comes from above the breadboard (Arduino area)
        this.overlayGroup.appendChild(svgEl('line', {
          x1: cx, y1: 0, x2: cx, y2: compY,
          stroke: wire.color || '#22cc22', 'stroke-width': 1.5, 'stroke-linecap': 'round',
          class: 'bb-wire bb-wire-arduino',
        }));
      } else if (wire.fromHole && wire.toHole) {
        // Component-to-component jumper
        const x1 = holeX(wire.fromHole.col);
        const y1 = rowY(wire.fromHole.row);
        const x2 = holeX(wire.toHole.col);
        const y2 = rowY(wire.toHole.row);
        this.overlayGroup.appendChild(svgEl('line', {
          x1, y1, x2, y2,
          stroke: wire.color || '#888888', 'stroke-width': 1.5, 'stroke-linecap': 'round',
          class: 'bb-wire',
        }));
      }
    }
  }

  clear() {
    if (this.overlayGroup) {
      this.overlayGroup.remove();
      this.overlayGroup = null;
    }
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/breadboard-renderer.test.js`
Expected: PASS

Note: The test uses a mock SVG container. The `svgEl` import may fail in the test environment since it uses `document.createElementNS`. If so, mock it:

Add to the top of the test file:
```javascript
import { vi } from 'vitest';
// Mock document.createElementNS for Node environment
if (typeof document === 'undefined') {
  globalThis.document = {
    createElementNS: vi.fn(() => ({
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      children: [],
      style: {},
      textContent: '',
    })),
  };
}
```

**Step 6: Commit**

```bash
git add src/circuit/breadboard-renderer.js src/circuit/svg-components.js tests/breadboard-renderer.test.js
git commit -m "feat: add breadboard renderer with component visuals and jumper wires"
```

---

### Task 3: Integrate Breadboard View into Mode Switching

**Files:**
- Modify: `src/circuit/renderer.js`
- Modify: `src/main.js`

**Context:** Wire up the breadboard layout engine and renderer to the Schematic/Breadboard toggle buttons. When switching to breadboard mode:
1. Hide schematic components and wires
2. Compute the breadboard layout from current components + wires
3. Render the breadboard overlay
4. Disable drag, wire editing, and component palette

When switching back to schematic:
1. Remove the breadboard overlay
2. Show schematic components and wires
3. Re-enable editing

**Step 1: Modify renderer.js to support overlay layers**

In `src/circuit/renderer.js`, update `setMode` to hide/show the component and wire layers:

```javascript
// In _initSvg(), after creating layers, add:
this.breadboardOverlayLayer = document.createElementNS(NS, 'g');
this.svg.appendChild(this.breadboardOverlayLayer);

// Replace setMode:
setMode(mode) {
  this.mode = mode;
  if (mode === 'schematic') {
    this.breadboard.style.display = 'none';
    this.componentLayer.style.display = '';
    this.wireLayer.style.display = '';
    this.breadboardOverlayLayer.style.display = 'none';
  } else {
    this.breadboard.style.display = '';
    this.componentLayer.style.display = 'none';
    this.wireLayer.style.display = 'none';
    this.breadboardOverlayLayer.style.display = '';
  }
}
```

**Step 2: Modify main.js to compute and render breadboard layout on toggle**

```javascript
// At the top of main.js, add imports:
import { BreadboardLayout } from './circuit/breadboard-layout.js';
import { BreadboardRenderer } from './circuit/breadboard-renderer.js';

// After renderer is created (around line 31):
const bbRenderer = new BreadboardRenderer(renderer.breadboardOverlayLayer);

// Replace the btnBreadboard click handler:
btnBreadboard.addEventListener('click', () => {
  // Gather current components and wires
  const components = [];
  for (const [id, comp] of renderer.components) {
    components.push({ type: comp.type, id });
  }
  const wires = [];
  for (const wire of renderer.wires) {
    wires.push({
      from: wire.dataset.fromPin || '',
      to: wire.dataset.toPin || '',
      color: wire.getAttribute('stroke'),
    });
  }

  // Compute and render layout
  const layout = new BreadboardLayout(components, wires);
  const result = layout.compute();
  bbRenderer.render(result);

  renderer.setMode('breadboard');
  btnBreadboard.classList.add('active');
  btnSchematic.classList.remove('active');
});

// Update the btnSchematic handler:
btnSchematic.addEventListener('click', () => {
  bbRenderer.clear();
  renderer.setMode('schematic');
  btnSchematic.classList.add('active');
  btnBreadboard.classList.remove('active');
});
```

**Step 3: Disable editing in breadboard mode**

In the wiring system click handler in `wiring.js`, add a mode check. The simplest approach: the main.js breadboard handler sets a flag.

In `src/main.js`, add near the top:
```javascript
let breadboardMode = false;
```

In the btnBreadboard handler, add:
```javascript
breadboardMode = true;
```

In the btnSchematic handler, add:
```javascript
breadboardMode = false;
```

In the component palette callback, add an early return:
```javascript
createComponentPalette(..., (type, id, x, y) => {
  if (breadboardMode) return;
  // ... existing code
});
```

In the wiring system, pass the mode check. Simplest: set `wiring.enabled = false` in breadboard mode:

In `src/circuit/wiring.js`, at the start of the click handler:
```javascript
if (this.enabled === false) return;
```

In `src/main.js`:
```javascript
// In breadboard handler:
wiring.enabled = false;
// In schematic handler:
wiring.enabled = true;
```

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/circuit/renderer.js src/main.js src/circuit/wiring.js
git commit -m "feat: integrate breadboard auto-layout into mode switching"
```

---

### Task 4: Polish and Visual Tuning

**Files:**
- Modify: `src/circuit/breadboard-renderer.js` (adjust coordinates)
- Modify: `src/style.css` (breadboard overlay styles)
- Modify: `src/circuit/breadboard-layout.js` (edge cases)

**Context:** Test with all 4 sample projects and manually-added components. Fix any coordinate issues, add CSS transitions, handle edge cases like empty circuits.

**Step 1: Add CSS for breadboard overlay**

In `src/style.css`, add:
```css
/* Breadboard overlay */
.bb-highlight {
  pointer-events: none;
  transition: opacity 0.2s;
}

.bb-wire {
  pointer-events: none;
}

.bb-component {
  pointer-events: none;
}

/* Dim component palette in breadboard mode */
.breadboard-mode .palette-item {
  opacity: 0.4;
  pointer-events: none;
}
```

**Step 2: Add `breadboard-mode` class to body in breadboard mode**

In `src/main.js`, in the breadboard handler:
```javascript
document.body.classList.add('breadboard-mode');
```
In the schematic handler:
```javascript
document.body.classList.remove('breadboard-mode');
```

**Step 3: Handle empty circuit edge case**

In `src/circuit/breadboard-layout.js`, at the start of `compute()`:
```javascript
if (this.components.length === 0) {
  return { placements: new Map(), jumperWires: [], occupiedHoles: [] };
}
```

**Step 4: Test with all sample projects**

Run: `npx vite dev`
- Load LED Blink → click Breadboard → verify resistor and LED appear on breadboard with wires
- Load Button LED → verify button, resistor, LED with power rail connections
- Load RGB Multicolor → verify 3 resistors and RGB LED with multiple jumper wires
- Load Ultrasonic Distance → verify all components laid out
- Switch back to Schematic → verify normal editing works

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/circuit/breadboard-renderer.js src/circuit/breadboard-layout.js src/style.css src/main.js
git commit -m "feat: polish breadboard view with CSS, edge cases, and visual tuning"
```
