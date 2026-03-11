/**
 * Breadboard Renderer
 *
 * Takes a layout result from BreadboardLayout.compute() and renders SVG
 * elements (component visuals, row-group highlights, jumper wires) onto
 * a container <g> element inside the breadboard SVG area.
 *
 * Breadboard coordinate system (relative to the breadboard group at 20,200):
 *   holeSpacing = 16, hole x = col * 16 + 10
 *   Power rail + at y=12, power rail - at y=28
 *   Top rows a-e at y = 48, 64, 80, 96, 112
 *   Center gap at y = 118-138
 *   Bottom rows f-j at y = 144, 160, 176, 192, 208
 */

import { svgEl } from './svg-components.js';

const HOLE_SPACING = 16;

// Y-coordinates for row groups
const TOP_ROW_YS = [48, 64, 80, 96, 112]; // rows a-e
const BOT_ROW_YS = [144, 160, 176, 192, 208]; // rows f-j
const ROW_E_Y = 112;
const ROW_F_Y = 144;
const GAP_CENTER_Y = 128; // midpoint between row e (112) and row f (144)
const POWER_PLUS_Y = 12;
const POWER_MINUS_Y = 28;
const ARDUINO_WIRE_Y = -180; // Arduino board is above breadboard (at SVG y≈10, breadboard at y=200)

/** Convert a breadboard column number to an x pixel coordinate. */
function colToX(col) {
  return col * HOLE_SPACING + 10;
}

/** Get the y coordinate for a row group's component pin row (e or f, closest to gap). */
function rowGroupY(rowGroup) {
  return rowGroup === 'top' ? ROW_E_Y : ROW_F_Y;
}

/** Get the y coordinate for a wire landing in a row group (row d or g, near the gap). */
function wireRowY(rowGroup) {
  return rowGroup === 'top' ? TOP_ROW_YS[3] : BOT_ROW_YS[1]; // row d or row g
}

/** Get the y for a wire entering the breadboard from above (first row in group). */
function wireEntryRowY(rowGroup) {
  return rowGroup === 'top' ? TOP_ROW_YS[0] : BOT_ROW_YS[0]; // row a or row f
}

/** Get y for a power rail type. */
function railY(railType) {
  return railType === '+' ? POWER_PLUS_Y : POWER_MINUS_Y;
}

// ---------------------------------------------------------------------------
// Component rendering helpers
// ---------------------------------------------------------------------------

function renderBBResistor(g, placement) {
  const cx = colToX(placement.startCol);
  const compG = svgEl('g', { class: 'bb-resistor', 'data-bb-component': placement.compId });

  // Vertical body straddling the gap
  const bodyW = 10;
  const bodyTop = GAP_CENTER_Y - 12;
  const bodyH = 24;
  compG.appendChild(svgEl('rect', {
    x: cx - bodyW / 2, y: bodyTop, width: bodyW, height: bodyH,
    rx: 3, fill: '#d4b896', stroke: '#8b7355', 'stroke-width': 1,
  }));

  // Color bands
  const bandColors = ['#cc0000', '#cc0000', '#8b4513'];
  bandColors.forEach((color, i) => {
    const by = bodyTop + 4 + i * 7;
    compG.appendChild(svgEl('rect', {
      x: cx - bodyW / 2, y: by, width: bodyW, height: 3, fill: color,
    }));
  });

  // Legs from body to pin holes
  compG.appendChild(svgEl('line', {
    x1: cx, y1: bodyTop, x2: cx, y2: ROW_E_Y,
    stroke: '#888', 'stroke-width': 1,
  }));
  compG.appendChild(svgEl('line', {
    x1: cx, y1: bodyTop + bodyH, x2: cx, y2: ROW_F_Y,
    stroke: '#888', 'stroke-width': 1,
  }));

  // Pin dots
  compG.appendChild(svgEl('circle', { cx, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  compG.appendChild(svgEl('circle', { cx, cy: ROW_F_Y, r: 2.5, fill: '#555' }));

  g.appendChild(compG);
}

function renderBBLed(g, placement) {
  const cx = colToX(placement.startCol);
  const compG = svgEl('g', { class: 'bb-led', 'data-bb-component': placement.compId });

  // LED body circle at gap center
  const ledR = 10;
  compG.appendChild(svgEl('circle', {
    cx, cy: GAP_CENTER_Y, r: ledR,
    fill: '#ff000040', stroke: '#cc0000', 'stroke-width': 1.5,
    class: 'bb-led-body', 'data-bb-component': placement.compId,
  }));

  // Legs to row e and row f
  compG.appendChild(svgEl('line', {
    x1: cx, y1: GAP_CENTER_Y - ledR, x2: cx, y2: ROW_E_Y,
    stroke: '#888', 'stroke-width': 1,
  }));
  compG.appendChild(svgEl('line', {
    x1: cx, y1: GAP_CENTER_Y + ledR, x2: cx, y2: ROW_F_Y,
    stroke: '#888', 'stroke-width': 1,
  }));

  // +/- labels
  const plusLabel = svgEl('text', {
    x: cx - 6, y: ROW_E_Y - 3, 'text-anchor': 'middle',
    fill: '#888', 'font-size': 6,
  });
  plusLabel.textContent = '+';
  compG.appendChild(plusLabel);

  const minusLabel = svgEl('text', {
    x: cx + 6, y: ROW_F_Y + 8, 'text-anchor': 'middle',
    fill: '#888', 'font-size': 6,
  });
  minusLabel.textContent = '-';
  compG.appendChild(minusLabel);

  // Pin dots
  compG.appendChild(svgEl('circle', { cx, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  compG.appendChild(svgEl('circle', { cx, cy: ROW_F_Y, r: 2.5, fill: '#555' }));

  g.appendChild(compG);
}

function renderBBPushButton(g, placement) {
  const x1 = colToX(placement.startCol);
  const x2 = colToX(placement.startCol + 1);
  const midX = (x1 + x2) / 2;
  const compG = svgEl('g', { class: 'bb-push-button', 'data-bb-component': placement.compId });

  // Body rect spanning 2 columns across gap
  compG.appendChild(svgEl('rect', {
    x: x1 - 5, y: ROW_E_Y - 2, width: x2 - x1 + 10, height: ROW_F_Y - ROW_E_Y + 4,
    rx: 3, fill: '#555', stroke: '#333', 'stroke-width': 1,
  }));

  // Button cap circle
  compG.appendChild(svgEl('circle', {
    cx: midX, cy: GAP_CENTER_Y, r: 6,
    fill: '#999', stroke: '#777', 'stroke-width': 0.5,
  }));

  // Pin dots at 4 corners
  compG.appendChild(svgEl('circle', { cx: x1, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  compG.appendChild(svgEl('circle', { cx: x2, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  compG.appendChild(svgEl('circle', { cx: x1, cy: ROW_F_Y, r: 2.5, fill: '#555' }));
  compG.appendChild(svgEl('circle', { cx: x2, cy: ROW_F_Y, r: 2.5, fill: '#555' }));

  g.appendChild(compG);
}

function renderBBRgbLed(g, placement) {
  const xs = [0, 1, 2, 3].map((i) => colToX(placement.startCol + i));
  const midX = (xs[0] + xs[3]) / 2;
  const compG = svgEl('g', { class: 'bb-rgb-led', 'data-bb-component': placement.compId });

  // Body circle centered over columns
  compG.appendChild(svgEl('circle', {
    cx: midX, cy: GAP_CENTER_Y, r: 14,
    fill: '#ffffff20', stroke: '#999', 'stroke-width': 1.5,
    class: 'bb-rgb-led-body', 'data-bb-component': placement.compId,
  }));

  // Legs up to row e
  const pinLabels = ['+', 'R', 'G', 'B'];
  xs.forEach((px, i) => {
    compG.appendChild(svgEl('line', {
      x1: px, y1: GAP_CENTER_Y - 14, x2: px, y2: ROW_E_Y,
      stroke: '#888', 'stroke-width': 1,
    }));
    const label = svgEl('text', {
      x: px, y: ROW_E_Y - 3, 'text-anchor': 'middle',
      fill: '#888', 'font-size': 6,
    });
    label.textContent = pinLabels[i];
    compG.appendChild(label);

    // Pin dots
    compG.appendChild(svgEl('circle', { cx: px, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  });

  g.appendChild(compG);
}

function renderBBUltrasonic(g, placement) {
  const xs = [0, 1, 2, 3].map((i) => colToX(placement.startCol + i));
  const midX = (xs[0] + xs[3]) / 2;
  const bodyTop = ROW_E_Y - 30;
  const compG = svgEl('g', { class: 'bb-ultrasonic', 'data-bb-component': placement.compId });

  // Body rect above row e
  compG.appendChild(svgEl('rect', {
    x: xs[0] - 6, y: bodyTop, width: xs[3] - xs[0] + 12, height: 26,
    rx: 2, fill: '#2277bb', stroke: '#1a5c8a', 'stroke-width': 1,
  }));

  // "Eyes" (ultrasonic transducers)
  compG.appendChild(svgEl('circle', {
    cx: midX - 8, cy: bodyTop + 13, r: 6,
    fill: '#ccc', stroke: '#999', 'stroke-width': 0.5,
  }));
  compG.appendChild(svgEl('circle', {
    cx: midX + 8, cy: bodyTop + 13, r: 6,
    fill: '#ccc', stroke: '#999', 'stroke-width': 0.5,
  }));

  // Pin legs going into row e
  const pinLabels = ['VCC', 'TRIG', 'ECHO', 'GND'];
  xs.forEach((px, i) => {
    compG.appendChild(svgEl('line', {
      x1: px, y1: bodyTop + 26, x2: px, y2: ROW_E_Y,
      stroke: '#888', 'stroke-width': 1,
    }));
    const label = svgEl('text', {
      x: px, y: bodyTop - 2, 'text-anchor': 'middle',
      fill: '#666', 'font-size': 5,
    });
    label.textContent = pinLabels[i];
    compG.appendChild(label);

    // Pin dots
    compG.appendChild(svgEl('circle', { cx: px, cy: ROW_E_Y, r: 2.5, fill: '#555' }));
  });

  g.appendChild(compG);
}

// Component renderer dispatch table
const COMPONENT_RENDERERS = {
  resistor: renderBBResistor,
  led: renderBBLed,
  'push-button': renderBBPushButton,
  'rgb-led': renderBBRgbLed,
  'ultrasonic-sensor': renderBBUltrasonic,
};

// ---------------------------------------------------------------------------
// Row-group highlights
// ---------------------------------------------------------------------------

function renderRowHighlights(g, occupiedHoles) {
  const seen = new Set();

  for (const hole of occupiedHoles) {
    const key = `${hole.col}:${hole.row}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const x = colToX(hole.col);
    const ys = hole.row === 'top' ? TOP_ROW_YS : BOT_ROW_YS;

    for (const y of ys) {
      g.appendChild(svgEl('circle', {
        cx: x, cy: y, r: 5,
        fill: '#ffee0033', stroke: '#ddcc0044', 'stroke-width': 1,
        class: 'bb-highlight',
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Jumper wires
// ---------------------------------------------------------------------------

// Wire routing Y levels
const GPIO_BUS_Y = -208;        // Above Arduino board — for wires going past the left edge
const BODY_ROUTE_Y = -110;      // Mid-body of Arduino — for wires routing through the board
const POWER_BUS_Y = -10;        // Below Arduino power pins, above breadboard
const GPIO_PIN_THRESHOLD_Y = -100; // Pins with y < this are top-edge GPIO pins

// Arduino board boundaries in overlay coords (board at SVG 270,10; overlay at 20,200)
const ARDUINO_LEFT_X = 250;

// Spacing between parallel wires in a bundle
const WIRE_BUNDLE_SPACING = 4;

/**
 * Create a routed polyline wire from an Arduino pin to a breadboard hole.
 *
 * GPIO pins route one of two ways:
 *   - Target past left edge of Arduino: UP over the top, LEFT, DOWN (avoids board)
 *   - Target under the Arduino: DOWN through the body, LEFT on the dark part, DOWN
 *
 * Power pins route with a short L-shape just above the breadboard.
 *
 * @param {number} busOffset - Y offset within the wire bundle (0 for first wire)
 */
function createRoutedWire(g, pinPos, targetX, targetY, color, fromPin, busOffset) {
  const points = [];

  if (Math.abs(pinPos.x - targetX) < 2) {
    // Straight vertical wire — no horizontal routing needed
    points.push(`${pinPos.x},${pinPos.y}`, `${targetX},${targetY}`);
  } else if (pinPos.y < GPIO_PIN_THRESHOLD_Y) {
    if (targetX < ARDUINO_LEFT_X) {
      // Target is past the left edge — route OVER the top of the Arduino
      const busY = GPIO_BUS_Y + (busOffset || 0);
      points.push(
        `${pinPos.x},${pinPos.y}`,
        `${pinPos.x},${busY}`,
        `${targetX},${busY}`,
        `${targetX},${targetY}`
      );
    } else {
      // Target is under/right of the Arduino — route DOWN through the body
      const busY = BODY_ROUTE_Y + (busOffset || 0);
      points.push(
        `${pinPos.x},${pinPos.y}`,
        `${pinPos.x},${busY}`,
        `${targetX},${busY}`,
        `${targetX},${targetY}`
      );
    }
  } else {
    // Bottom power pin — short L-shape just above the breadboard
    const busY = POWER_BUS_Y + (busOffset || 0);
    points.push(
      `${pinPos.x},${pinPos.y}`,
      `${pinPos.x},${busY}`,
      `${targetX},${busY}`,
      `${targetX},${targetY}`
    );
  }

  const attrs = {
    points: points.join(' '),
    fill: 'none',
    stroke: color,
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'bb-jumper',
  };
  if (fromPin) attrs['data-from-pin'] = fromPin;
  g.appendChild(svgEl('polyline', attrs));
}

function renderJumperWires(g, jumperWires, pinPositions) {
  // Pre-compute bus offsets so bundled wires are visually separated.
  // Group routed wires by which bus they use (over-top, through-body, power),
  // then sort by target X so outer wires get outer lanes.
  const overTopWires = [];    // GPIO wires going over the Arduino top
  const throughBodyWires = []; // GPIO wires routing through the Arduino body
  const powerBusWires = [];

  for (let i = 0; i < jumperWires.length; i++) {
    const wire = jumperWires[i];
    if (!wire.from || !pinPositions || !pinPositions[wire.from]) continue;
    const pinPos = pinPositions[wire.from];
    const toX = colToX(wire.toHole ? wire.toHole.col : 0);
    if (Math.abs(pinPos.x - toX) < 2) continue; // straight vertical, no bus

    if (pinPos.y < GPIO_PIN_THRESHOLD_Y) {
      if (toX < ARDUINO_LEFT_X) {
        overTopWires.push({ idx: i, targetX: toX });
      } else {
        throughBodyWires.push({ idx: i, targetX: toX });
      }
    } else if (wire.railType) {
      powerBusWires.push({ idx: i, targetX: toX });
    }
  }

  // Sort by target X so wires fan out neatly — leftmost wire at top of bundle
  overTopWires.sort((a, b) => a.targetX - b.targetX);
  throughBodyWires.sort((a, b) => a.targetX - b.targetX);
  powerBusWires.sort((a, b) => a.targetX - b.targetX);

  // Build offset map: wire index → bus Y offset
  const busOffsets = new Map();
  overTopWires.forEach((w, i) => {
    busOffsets.set(w.idx, i * WIRE_BUNDLE_SPACING);
  });
  throughBodyWires.forEach((w, i) => {
    busOffsets.set(w.idx, i * WIRE_BUNDLE_SPACING);
  });
  powerBusWires.forEach((w, i) => {
    busOffsets.set(w.idx, i * WIRE_BUNDLE_SPACING);
  });

  for (let i = 0; i < jumperWires.length; i++) {
    const wire = jumperWires[i];
    const toX = colToX(wire.toHole ? wire.toHole.col : 0);
    const color = wire.color || '#22cc22';
    const offset = busOffsets.get(i) || 0;

    // Arduino-to-breadboard wires stop at the first row (a or f) — shortest path.
    // Component-to-component wires use rows near the gap (d or g) to stay close to pins.
    const entryY = wire.toHole ? wireEntryRowY(wire.toHole.row) : 0;
    const compY = wire.toHole ? wireRowY(wire.toHole.row) : 0;

    if (wire.railType && wire.from && pinPositions && pinPositions[wire.from]) {
      // Power wire: Arduino pin → rail, then rail → first row in group
      const pinPos = pinPositions[wire.from];
      const ry = railY(wire.railType);
      createRoutedWire(g, pinPos, toX, ry, color, wire.from, offset);
      // Rail to first available row (vertical)
      g.appendChild(svgEl('line', {
        x1: toX, y1: ry, x2: toX, y2: entryY,
        stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
        class: 'bb-jumper',
      }));
    } else if (wire.railType) {
      // Power rail wire (no pin position): vertical from rail to first row
      const attrs = {
        x1: toX, y1: railY(wire.railType), x2: toX, y2: entryY,
        stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
        class: 'bb-jumper',
      };
      if (wire.from) attrs['data-from-pin'] = wire.from;
      g.appendChild(svgEl('line', attrs));
    } else if (wire.from && wire.toHole && pinPositions && pinPositions[wire.from]) {
      // Arduino GPIO → first row in group (routed L-shape)
      createRoutedWire(g, pinPositions[wire.from], toX, entryY, color, wire.from, offset);
    } else if (wire.from && wire.toHole) {
      // Fallback: straight down to first row
      g.appendChild(svgEl('line', {
        x1: toX, y1: ARDUINO_WIRE_Y, x2: toX, y2: entryY,
        stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
        class: 'bb-jumper', 'data-from-pin': wire.from,
      }));
    } else if (wire.fromHole && wire.toHole) {
      // Component-to-component wire (use wire rows near gap to stay close to pins)
      const fromX = colToX(wire.fromHole.col);
      const fromY = wireRowY(wire.fromHole.row);
      g.appendChild(svgEl('line', {
        x1: fromX, y1: fromY, x2: toX, y2: compY,
        stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
        class: 'bb-jumper',
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wire crossing arches
// ---------------------------------------------------------------------------

/**
 * Extract line segments from wire elements (line and polyline).
 * Returns array of { x1, y1, x2, y2, el }.
 */
function extractSegments(wireLayer) {
  const segments = [];
  for (const el of wireLayer.children) {
    if (el.tagName === 'line') {
      segments.push({
        x1: parseFloat(el.getAttribute('x1')),
        y1: parseFloat(el.getAttribute('y1')),
        x2: parseFloat(el.getAttribute('x2')),
        y2: parseFloat(el.getAttribute('y2')),
        el,
      });
    } else if (el.tagName === 'polyline') {
      const pts = el.getAttribute('points').split(/\s+/).map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
      for (let i = 0; i < pts.length - 1; i++) {
        segments.push({
          x1: pts[i].x, y1: pts[i].y,
          x2: pts[i + 1].x, y2: pts[i + 1].y,
          el,
        });
      }
    }
  }
  return segments;
}

/**
 * Find intersections between roughly-vertical and roughly-horizontal segments.
 */
function findCrossings(segments) {
  const crossings = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (segments[i].el === segments[j].el) continue; // same wire
      const a = segments[i];
      const b = segments[j];

      // Check vertical-horizontal crossings
      const aVertical = Math.abs(a.x1 - a.x2) < 1 && Math.abs(a.y1 - a.y2) > 5;
      const bHorizontal = Math.abs(b.y1 - b.y2) < 1 && Math.abs(b.x1 - b.x2) > 5;
      const aHorizontal = Math.abs(a.y1 - a.y2) < 1 && Math.abs(a.x1 - a.x2) > 5;
      const bVertical = Math.abs(b.x1 - b.x2) < 1 && Math.abs(b.y1 - b.y2) > 5;

      if (aVertical && bHorizontal) {
        const vx = a.x1;
        const hy = b.y1;
        const minY = Math.min(a.y1, a.y2);
        const maxY = Math.max(a.y1, a.y2);
        const minX = Math.min(b.x1, b.x2);
        const maxX = Math.max(b.x1, b.x2);
        if (vx > minX + 2 && vx < maxX - 2 && hy > minY + 2 && hy < maxY - 2) {
          crossings.push({ x: vx, y: hy, vertSeg: a, horzSeg: b });
        }
      } else if (bVertical && aHorizontal) {
        const vx = b.x1;
        const hy = a.y1;
        const minY = Math.min(b.y1, b.y2);
        const maxY = Math.max(b.y1, b.y2);
        const minX = Math.min(a.x1, a.x2);
        const maxX = Math.max(a.x1, a.x2);
        if (vx > minX + 2 && vx < maxX - 2 && hy > minY + 2 && hy < maxY - 2) {
          crossings.push({ x: vx, y: hy, vertSeg: b, horzSeg: a });
        }
      }
    }
  }
  return crossings;
}

/**
 * Render small arches at wire crossing points.
 * The horizontal wire gets a small semicircular bump over the vertical wire.
 */
function renderCrossingArches(g, wireLayer) {
  const segments = extractSegments(wireLayer);
  const crossings = findCrossings(segments);
  const archR = 8;

  for (const { x, y } of crossings) {
    // Small semicircular arch on the horizontal wire
    const arch = svgEl('path', {
      d: `M ${x - archR} ${y} A ${archR} ${archR} 0 0 1 ${x + archR} ${y}`,
      fill: 'none',
      stroke: '#f0efe8', // breadboard background color to "cut" the vertical wire
      'stroke-width': 6,
    });
    g.appendChild(arch);

    // Draw the arch outline in a neutral color
    const archLine = svgEl('path', {
      d: `M ${x - archR} ${y} A ${archR} ${archR} 0 0 1 ${x + archR} ${y}`,
      fill: 'none',
      stroke: '#888',
      'stroke-width': 1.5,
    });
    g.appendChild(archLine);
  }
}

// ---------------------------------------------------------------------------

export class BreadboardRenderer {
  constructor(svgContainer) {
    this._container = svgContainer;
    this._overlay = null;
  }

  /**
   * Render a complete breadboard layout result.
   * Clears any previous overlay first.
   *
   * @param {Object} layoutResult - Output from BreadboardLayout.compute()
   *   { placements: Map, jumperWires: Array, occupiedHoles: Array }
   * @param {Object} [pinPositions] - Map of Arduino pin ID → {x, y} in overlay-relative coords
   */
  render(layoutResult, pinPositions) {
    this.clear();

    const overlay = svgEl('g', { class: 'bb-overlay' });

    // 1. Row-group highlights (behind everything)
    const highlightLayer = svgEl('g', { class: 'bb-highlights' });
    renderRowHighlights(highlightLayer, layoutResult.occupiedHoles);
    overlay.appendChild(highlightLayer);

    // 2. Jumper wires
    const wireLayer = svgEl('g', { class: 'bb-wires' });
    renderJumperWires(wireLayer, layoutResult.jumperWires, pinPositions);
    overlay.appendChild(wireLayer);

    // 2b. Wire crossing arches
    const archLayer = svgEl('g', { class: 'bb-arches' });
    renderCrossingArches(archLayer, wireLayer);
    overlay.appendChild(archLayer);

    // 3. Components
    const compLayer = svgEl('g', { class: 'bb-components' });
    for (const [compId, placement] of layoutResult.placements) {
      const renderFn = COMPONENT_RENDERERS[placement.type];
      if (renderFn) {
        renderFn(compLayer, { ...placement, compId });
      }
    }
    overlay.appendChild(compLayer);

    this._container.appendChild(overlay);
    this._overlay = overlay;
  }

  /** Update LED visual state (brightness/burnout) */
  updateLed(compId, brightness, burnedOut) {
    if (!this._overlay) return;
    const body = this._overlay.querySelector(`.bb-led-body[data-bb-component="${compId}"]`);
    if (!body) return;
    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
      body.setAttribute('stroke', '#555');
    } else if (brightness > 0) {
      body.setAttribute('fill', `rgba(255, 0, 0, ${0.3 + brightness * 0.7})`);
    } else {
      body.setAttribute('fill', '#ff000030');
    }
  }

  /** Update RGB LED visual state */
  updateRgbLed(compId, color, burnedOut) {
    if (!this._overlay) return;
    const body = this._overlay.querySelector(`.bb-rgb-led-body[data-bb-component="${compId}"]`);
    if (!body) return;
    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
    } else {
      const { r, g, b } = color;
      const brightness = Math.max(r, g, b) / 255;
      body.setAttribute('fill', `rgba(${r}, ${g}, ${b}, ${0.2 + brightness * 0.8})`);
    }
  }

  /** Remove the rendered overlay. */
  clear() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }
}
