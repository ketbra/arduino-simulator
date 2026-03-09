const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function addPinTitle(el, text) {
  const title = document.createElementNS(NS, 'title');
  title.textContent = text;
  el.appendChild(title);
}

function addPinWithHitArea(parent, attrs, tooltip) {
  // Hit area first (drawn behind)
  const hitArea = svgEl('circle', {
    cx: attrs.cx, cy: attrs.cy, r: 14,
    fill: 'transparent', 'pointer-events': 'all',
    class: 'pin-hitarea', 'data-pin': attrs['data-pin'],
  });
  addPinTitle(hitArea, tooltip);
  parent.appendChild(hitArea);

  // Visible pin marker on top
  const pin = svgEl('circle', attrs);
  addPinTitle(pin, tooltip);
  parent.appendChild(pin);

  // JS hover fallback for hit area -> sibling pin marker
  hitArea.addEventListener('mouseenter', () => {
    pin.setAttribute('r', '7');
    pin.setAttribute('fill', '#ffcc00');
  });
  hitArea.addEventListener('mouseleave', () => {
    // Only reset if not in special wiring state
    if (!pin.classList.contains('pin-wire-source') &&
        !pin.classList.contains('pin-available-target') &&
        !pin.classList.contains('pin-snap-target')) {
      pin.setAttribute('r', '5');
      pin.setAttribute('fill', '#888');
    }
  });
  pin.addEventListener('mouseenter', () => {
    pin.setAttribute('r', '7');
    pin.setAttribute('fill', '#ffcc00');
  });
  pin.addEventListener('mouseleave', () => {
    if (!pin.classList.contains('pin-wire-source') &&
        !pin.classList.contains('pin-available-target') &&
        !pin.classList.contains('pin-snap-target')) {
      pin.setAttribute('r', '5');
      pin.setAttribute('fill', '#888');
    }
  });

  return pin;
}

export function renderArduinoBoard(x, y) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'arduino-board' });

  // Board body
  g.appendChild(svgEl('rect', { width: 260, height: 160, rx: 8, fill: '#1a1a2e', stroke: '#333', 'stroke-width': 2 }));

  // Label
  const label = svgEl('text', { x: 130, y: 85, 'text-anchor': 'middle', fill: '#888', 'font-size': 14, 'font-family': 'monospace' });
  label.textContent = 'Arduino Uno';
  g.appendChild(label);

  // Digital pins 0-13 across the top
  const digitalPins = [0,1,2,3,4,5,6,7,8,9,10,11,12,13];
  digitalPins.forEach((pin, i) => {
    const px = 20 + i * 17;
    const pinG = svgEl('g', { class: `pin digital-pin pin-${pin}`, 'data-pin': `arduino:pin${pin}` });

    // Hit area rect (larger, behind visible rect)
    const hitRect = svgEl('rect', {
      x: px - 8, y: -16, width: 28, height: 32, rx: 2,
      fill: 'transparent', 'pointer-events': 'all',
      class: 'pin-hitarea',
    });
    addPinTitle(hitRect, `Digital Pin ${pin}`);
    pinG.appendChild(hitRect);

    const visibleRect = svgEl('rect', { x: px, y: -8, width: 12, height: 16, rx: 2, fill: '#c0a030', stroke: '#887020' });
    addPinTitle(visibleRect, `Digital Pin ${pin}`);
    pinG.appendChild(visibleRect);

    const txt = svgEl('text', { x: px + 6, y: -14, 'text-anchor': 'middle', fill: '#aaa', 'font-size': 8 });
    txt.textContent = pin;
    pinG.appendChild(txt);

    // JS hover fallback
    hitRect.addEventListener('mouseenter', () => {
      visibleRect.setAttribute('fill', '#e0c040');
    });
    hitRect.addEventListener('mouseleave', () => {
      visibleRect.setAttribute('fill', '#c0a030');
    });

    g.appendChild(pinG);
  });

  // Power pins across the bottom
  const powerPinNames = { 'GND': 'GND', 'GND2': 'GND2', '5V': '5V', '3.3V': '3.3V' };
  const powerPins = [
    { name: 'GND', id: 'arduino:GND', x: 20, fill: '#333' },
    { name: 'GND2', id: 'arduino:GND2', x: 50, fill: '#333' },
    { name: '5V', id: 'arduino:5V', x: 80, fill: '#c03030' },
    { name: '3.3V', id: 'arduino:3V3', x: 116, fill: '#c06030' },
  ];
  powerPins.forEach((p) => {
    const pinG = svgEl('g', { class: 'pin power-pin', 'data-pin': p.id });

    // Hit area rect (larger, behind visible rect)
    const hitRect = svgEl('rect', {
      x: p.x - 8, y: 144, width: 44, height: 32, rx: 2,
      fill: 'transparent', 'pointer-events': 'all',
      class: 'pin-hitarea',
    });
    addPinTitle(hitRect, p.name);
    pinG.appendChild(hitRect);

    const visibleRect = svgEl('rect', { x: p.x, y: 152, width: 28, height: 16, rx: 2, fill: p.fill, stroke: '#666' });
    addPinTitle(visibleRect, p.name);
    pinG.appendChild(visibleRect);

    const txt = svgEl('text', { x: p.x + 14, y: 175, 'text-anchor': 'middle', fill: '#aaa', 'font-size': 7 });
    txt.textContent = p.name;
    pinG.appendChild(txt);

    // JS hover fallback
    const origFill = p.fill;
    hitRect.addEventListener('mouseenter', () => {
      visibleRect.setAttribute('fill', '#e0c040');
    });
    hitRect.addEventListener('mouseleave', () => {
      visibleRect.setAttribute('fill', origFill);
    });

    g.appendChild(pinG);
  });

  return g;
}

export function renderBreadboard(x, y) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'breadboard' });

  const cols = 30;
  const holeSpacing = 16;
  const rowLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  const width = (cols + 2) * holeSpacing;
  const height = 220;
  g.appendChild(svgEl('rect', { width, height, rx: 6, fill: '#f0efe8', stroke: '#ccc', 'stroke-width': 1 }));

  // Center gap
  const gapY = 98;
  g.appendChild(svgEl('rect', { x: 10, y: gapY, width: width - 20, height: 10, rx: 2, fill: '#ddd' }));

  // Power rails (top + and -, bottom + and -)
  [{ y: 12, label: '+', color: '#d33', railId: 'power+' }, { y: 28, label: '-', color: '#33d', railId: 'power-' }].forEach((rail) => {
    g.appendChild(svgEl('line', { x1: 20, y1: rail.y, x2: width - 20, y2: rail.y, stroke: rail.color, 'stroke-width': 1.5, opacity: 0.5 }));
    for (let col = 1; col <= cols; col++) {
      const hx = col * holeSpacing + 10;
      g.appendChild(svgEl('circle', {
        cx: hx, cy: rail.y, r: 3.5,
        fill: '#666', stroke: '#555', 'stroke-width': 0.5,
        class: 'breadboard-hole', 'data-pin': `breadboard:${rail.railId}:${col}`,
      }));
    }
  });

  // Main holes
  rowLabels.forEach((row, ri) => {
    const baseY = ri < 5 ? 48 + ri * holeSpacing : 118 + (ri - 5) * holeSpacing;
    for (let col = 1; col <= cols; col++) {
      const hx = col * holeSpacing + 10;
      g.appendChild(svgEl('circle', {
        cx: hx, cy: baseY, r: 3.5,
        fill: '#666', stroke: '#555', 'stroke-width': 0.5,
        class: 'breadboard-hole', 'data-pin': `breadboard:${row}${col}`,
      }));
    }

    // Row labels
    if (ri === 0 || ri === 5) {
      const labelText = svgEl('text', { x: 6, y: baseY + 3, fill: '#999', 'font-size': 7 });
      labelText.textContent = row;
      g.appendChild(labelText);
    }
  });

  return g;
}

export function renderLedComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component led', 'data-component-id': id });
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 12, fill: '#ff000030', stroke: '#cc0000', 'stroke-width': 2, class: 'led-body' }));
  const aLabel = svgEl('text', { x: -4, y: -16, fill: '#666', 'font-size': 10 });
  aLabel.textContent = '+';
  g.appendChild(aLabel);
  addPinWithHitArea(g, { cx: -6, cy: 16, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:anode` }, 'LED anode (+)');
  addPinWithHitArea(g, { cx: 6, cy: 16, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:cathode` }, 'LED cathode (-)');
  const aText = svgEl('text', { x: -6, y: 28, 'text-anchor': 'middle', fill: '#888', 'font-size': 6 });
  aText.textContent = '+';
  g.appendChild(aText);
  const cText = svgEl('text', { x: 6, y: 28, 'text-anchor': 'middle', fill: '#888', 'font-size': 6 });
  cText.textContent = '-';
  g.appendChild(cText);
  return g;
}

export function renderRgbLedComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component rgb-led', 'data-component-id': id });
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 14, fill: '#ffffff20', stroke: '#999', 'stroke-width': 2, class: 'rgb-led-body' }));
  const label = svgEl('text', { x: 0, y: 4, 'text-anchor': 'middle', fill: '#666', 'font-size': 8 });
  label.textContent = 'RGB';
  g.appendChild(label);
  const pinNames = ['common', 'red', 'green', 'blue'];
  const pinLabels = ['+', 'R', 'G', 'B'];
  const pinTooltips = ['Common Anode (+)', 'Red', 'Green', 'Blue'];
  pinNames.forEach((name, i) => {
    const px = (i - 1.5) * 10;
    addPinWithHitArea(g, { cx: px, cy: 18, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:${name}` }, pinTooltips[i]);
    const t = svgEl('text', { x: px, y: 30, 'text-anchor': 'middle', fill: '#888', 'font-size': 7 });
    t.textContent = pinLabels[i];
    g.appendChild(t);
  });
  return g;
}

export function renderResistorComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component resistor', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -16, y: -5, width: 32, height: 10, rx: 2, fill: '#d4b896', stroke: '#8b7355', 'stroke-width': 1 }));
  g.appendChild(svgEl('rect', { x: -10, y: -5, width: 3, height: 10, fill: '#cc0000' }));
  g.appendChild(svgEl('rect', { x: -4, y: -5, width: 3, height: 10, fill: '#cc0000' }));
  g.appendChild(svgEl('rect', { x: 2, y: -5, width: 3, height: 10, fill: '#8b4513' }));
  addPinWithHitArea(g, { cx: -22, cy: 0, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1` }, 'Resistor Pin 1');
  addPinWithHitArea(g, { cx: 22, cy: 0, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2` }, 'Resistor Pin 2');
  return g;
}

export function renderPushButtonComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component push-button', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, rx: 3, fill: '#555', stroke: '#333', 'stroke-width': 1 }));
  const cap = svgEl('circle', { cx: 0, cy: 0, r: 7, fill: '#888', stroke: '#666', class: 'button-cap' });
  cap.style.cursor = 'pointer';
  g.appendChild(cap);
  addPinWithHitArea(g, { cx: -14, cy: -14, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1a` }, 'Button Pin 1A');
  addPinWithHitArea(g, { cx: 14, cy: -14, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin1b` }, 'Button Pin 1B');
  addPinWithHitArea(g, { cx: -14, cy: 14, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2a` }, 'Button Pin 2A');
  addPinWithHitArea(g, { cx: 14, cy: 14, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:pin2b` }, 'Button Pin 2B');

  let pressed = false;
  cap.addEventListener('click', (e) => {
    e.stopPropagation();
    pressed = !pressed;
    cap.setAttribute('fill', pressed ? '#aaa' : '#888');
    cap.setAttribute('r', pressed ? 6 : 7);
    g.dispatchEvent(new CustomEvent('buttonToggle', { detail: { id, pressed }, bubbles: true }));
  });
  return g;
}

export function renderUltrasonicComponent(x, y, id) {
  const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'component ultrasonic', 'data-component-id': id });
  g.appendChild(svgEl('rect', { x: -28, y: -16, width: 56, height: 32, rx: 3, fill: '#2277bb', stroke: '#1a5c8a', 'stroke-width': 1 }));
  g.appendChild(svgEl('circle', { cx: -10, cy: 0, r: 9, fill: '#ccc', stroke: '#999' }));
  g.appendChild(svgEl('circle', { cx: 10, cy: 0, r: 9, fill: '#ccc', stroke: '#999' }));
  const label = svgEl('text', { x: 0, y: -20, 'text-anchor': 'middle', fill: '#666', 'font-size': 7 });
  label.textContent = 'HC-SR04';
  g.appendChild(label);
  const pinNames = ['vcc', 'trig', 'echo', 'gnd'];
  const pinTooltips = ['VCC (+5V)', 'Trigger', 'Echo', 'GND'];
  pinNames.forEach((name, i) => {
    const px = (i - 1.5) * 14;
    addPinWithHitArea(g, { cx: px, cy: 20, r: 5, fill: '#888', class: 'pin-marker', 'data-pin': `component:${id}:${name}` }, pinTooltips[i]);
    const t = svgEl('text', { x: px, y: 32, 'text-anchor': 'middle', fill: '#888', 'font-size': 6 });
    t.textContent = name;
    g.appendChild(t);
  });
  return g;
}

export function renderWire(x1, y1, x2, y2, color = '#22cc22') {
  return svgEl('line', {
    x1, y1, x2, y2,
    stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round',
    class: 'wire',
  });
}

export function renderSmokeEffect(x, y) {
  const g = svgEl('g', { class: 'smoke-effect', transform: `translate(${x},${y})` });
  for (let i = 0; i < 6; i++) {
    const puff = svgEl('circle', {
      cx: (Math.random() - 0.5) * 20,
      cy: -Math.random() * 15,
      r: 3 + Math.random() * 5,
      fill: '#66666688',
      class: 'smoke-puff',
    });
    g.appendChild(puff);
  }
  return g;
}
