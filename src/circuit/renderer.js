import {
  renderArduinoBoard, renderBreadboard, renderLedComponent,
  renderRgbLedComponent, renderResistorComponent, renderPushButtonComponent,
  renderUltrasonicComponent, renderWire, renderSmokeEffect,
} from './svg-components.js';

export class CircuitRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.components = new Map();
    this.wires = [];
    this.dragState = null;
    this.selectedComponent = null;
    this.selectedWire = null;

    this._initSvg();
    this._initDragListeners();
    this._initSelectionListeners();
  }

  _initSvg() {
    this.svg.setAttribute('viewBox', '0 -20 800 620');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';

    const NS = 'http://www.w3.org/2000/svg';
    this.boardLayer = document.createElementNS(NS, 'g');
    this.wireLayer = document.createElementNS(NS, 'g');
    this.componentLayer = document.createElementNS(NS, 'g');
    this.effectLayer = document.createElementNS(NS, 'g');

    this.breadboardOverlayLayer = document.createElementNS(NS, 'g');
    this.breadboardOverlayLayer.setAttribute('transform', 'translate(20, 200)');

    this.svg.appendChild(this.boardLayer);
    this.svg.appendChild(this.wireLayer);
    this.svg.appendChild(this.componentLayer);
    this.svg.appendChild(this.effectLayer);
    this.svg.appendChild(this.breadboardOverlayLayer);

    this.arduinoBoard = renderArduinoBoard(270, 10);
    this.breadboard = renderBreadboard(20, 200);
    this.boardLayer.appendChild(this.arduinoBoard);
    this.boardLayer.appendChild(this.breadboard);

    // Default to schematic mode (hide breadboard and overlay)
    this.mode = 'schematic';
    this.breadboard.setAttribute('display', 'none');
    this.breadboardOverlayLayer.setAttribute('display', 'none');
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'schematic') {
      this.breadboard.setAttribute('display', 'none');
      this.componentLayer.removeAttribute('display');
      this.wireLayer.removeAttribute('display');
      this.breadboardOverlayLayer.setAttribute('display', 'none');
    } else {
      this.breadboard.removeAttribute('display');
      this.componentLayer.setAttribute('display', 'none');
      this.wireLayer.setAttribute('display', 'none');
      this.breadboardOverlayLayer.removeAttribute('display');
    }
  }

  _initDragListeners() {
    this.svg.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      const comp = this.components.get(this.dragState.id);
      comp.x = svgPt.x - this.dragState.offsetX;
      comp.y = svgPt.y - this.dragState.offsetY;
      comp.el.setAttribute('transform', `translate(${comp.x},${comp.y})`);
      if (this._onDragEnd) this._onDragEnd();
    });

    this.svg.addEventListener('mouseup', () => {
      if (this.dragState) {
        const comp = this.components.get(this.dragState.id);
        if (comp) {
          comp.el.style.cursor = 'grab';
          // Report drag end position for undo
          if (this._onDragComplete && this.dragState.startX !== undefined) {
            const moved = comp.x !== this.dragState.startX || comp.y !== this.dragState.startY;
            if (moved) {
              this._onDragComplete({
                id: this.dragState.id,
                fromX: this.dragState.startX,
                fromY: this.dragState.startY,
                toX: comp.x,
                toY: comp.y,
              });
            }
          }
        }
        this.dragState = null;
        // Refresh wire positions after drag
        if (this._onDragEnd) this._onDragEnd();
      }
    });
  }

  _initSelectionListeners() {
    // Click on empty SVG space deselects
    this.svg.addEventListener('click', (e) => {
      if (e.target === this.svg || e.target.closest('g') === this.boardLayer) {
        this.deselectAll();
      }
    });
  }

  selectComponent(id) {
    this.deselectAll();
    const comp = this.components.get(id);
    if (!comp) return;
    this.selectedComponent = id;
    comp.el.setAttribute('stroke', '#007acc');
    comp.el.setAttribute('stroke-width', '2');
  }

  selectWire(wireEl) {
    this.deselectAll();
    this.selectedWire = wireEl;
    wireEl.setAttribute('stroke-width', '4');
    wireEl.dataset.origStroke = wireEl.getAttribute('stroke') || '';
    wireEl.setAttribute('stroke', '#007acc');
  }

  deselectAll() {
    if (this.selectedComponent) {
      const comp = this.components.get(this.selectedComponent);
      if (comp) {
        comp.el.removeAttribute('stroke');
        comp.el.removeAttribute('stroke-width');
      }
      this.selectedComponent = null;
    }
    if (this.selectedWire) {
      if (this.selectedWire.dataset.origStroke) {
        this.selectedWire.setAttribute('stroke', this.selectedWire.dataset.origStroke);
      }
      this.selectedWire.setAttribute('stroke-width', '2');
      this.selectedWire = null;
    }
  }

  deleteComponent(id) {
    const comp = this.components.get(id);
    if (!comp) return null;
    const info = { type: comp.type, id, x: comp.x, y: comp.y };
    comp.el.remove();
    this.components.delete(id);
    if (this.selectedComponent === id) this.selectedComponent = null;
    // Find and remove all wires connected to this component
    const removedWires = [];
    const prefix = `component:${id}:`;
    const remaining = [];
    for (const wire of this.wires) {
      const fromPin = wire.dataset.fromPin || '';
      const toPin = wire.dataset.toPin || '';
      if (fromPin.startsWith(prefix) || toPin.startsWith(prefix)) {
        removedWires.push({ from: fromPin, to: toPin, color: wire.getAttribute('stroke') });
        wire.remove();
      } else {
        remaining.push(wire);
      }
    }
    this.wires = remaining;
    return { component: info, wires: removedWires };
  }

  deleteWire(wireEl) {
    const idx = this.wires.indexOf(wireEl);
    if (idx === -1) return null;
    const info = {
      from: wireEl.dataset.fromPin || '',
      to: wireEl.dataset.toPin || '',
      color: wireEl.getAttribute('stroke'),
    };
    wireEl.remove();
    this.wires.splice(idx, 1);
    if (this.selectedWire === wireEl) this.selectedWire = null;
    return info;
  }

  addComponent(type, id, x, y) {
    const renderers = {
      led: renderLedComponent,
      'rgb-led': renderRgbLedComponent,
      resistor: renderResistorComponent,
      'push-button': renderPushButtonComponent,
      'ultrasonic-sensor': renderUltrasonicComponent,
    };

    const renderFn = renderers[type];
    if (!renderFn) return null;

    const el = renderFn(x, y, id);
    this.componentLayer.appendChild(el);
    this.components.set(id, { el, type, x, y });
    this._makeDraggable(el, id);
    return el;
  }

  removeComponent(id) {
    const comp = this.components.get(id);
    if (comp) {
      comp.el.remove();
      this.components.delete(id);
    }
  }

  addWire(x1, y1, x2, y2, color, fromPin, toPin) {
    const wire = renderWire(x1, y1, x2, y2, color);
    if (fromPin) wire.dataset.fromPin = fromPin;
    if (toPin) wire.dataset.toPin = toPin;
    this.wireLayer.appendChild(wire);
    this.wires.push(wire);
    return wire;
  }

  // Recalculate wire positions based on current pin locations
  refreshWires(getPinCoordsFn) {
    for (const wire of this.wires) {
      const fromPin = wire.dataset.fromPin;
      const toPin = wire.dataset.toPin;
      if (fromPin && toPin) {
        const from = getPinCoordsFn(fromPin);
        const to = getPinCoordsFn(toPin);
        if (from && to) {
          wire.setAttribute('x1', from.x);
          wire.setAttribute('y1', from.y);
          wire.setAttribute('x2', to.x);
          wire.setAttribute('y2', to.y);
        }
      }
    }
  }

  updateLed(id, brightness, burnedOut) {
    const comp = this.components.get(id);
    if (!comp) return;
    const body = comp.el.querySelector('.led-body');
    if (!body) return;

    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
      body.setAttribute('stroke', '#555');
      const smoke = renderSmokeEffect(0, 0);
      comp.el.appendChild(smoke);
      setTimeout(() => smoke.remove(), 2000);
    } else if (brightness > 0) {
      body.setAttribute('fill', `rgba(255, 0, 0, ${0.3 + brightness * 0.7})`);
      body.setAttribute('filter', 'url(#glow)');
    } else {
      body.setAttribute('fill', '#ff000030');
      body.removeAttribute('filter');
    }
  }

  updateRgbLed(id, color, burnedOut) {
    const comp = this.components.get(id);
    if (!comp) return;
    const body = comp.el.querySelector('.rgb-led-body');
    if (!body) return;

    if (burnedOut) {
      body.setAttribute('fill', '#33333380');
      const smoke = renderSmokeEffect(0, 0);
      comp.el.appendChild(smoke);
      setTimeout(() => smoke.remove(), 2000);
    } else {
      const { r, g, b } = color;
      const brightness = Math.max(r, g, b) / 255;
      body.setAttribute('fill', `rgba(${r}, ${g}, ${b}, ${0.2 + brightness * 0.8})`);
      if (brightness > 0.1) {
        body.setAttribute('filter', 'url(#glow)');
      } else {
        body.removeAttribute('filter');
      }
    }
  }

  _makeDraggable(el, id) {
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('pin-marker')) return; // Don't drag when clicking pins
      e.preventDefault();
      e.stopPropagation();
      const comp = this.components.get(id);
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      this.dragState = {
        id,
        offsetX: svgPt.x - comp.x,
        offsetY: svgPt.y - comp.y,
        startX: comp.x,
        startY: comp.y,
      };
      el.style.cursor = 'grabbing';
      this.selectComponent(id);
    });
  }

  moveComponent(id, x, y) {
    const comp = this.components.get(id);
    if (!comp) return;
    comp.x = x;
    comp.y = y;
    comp.el.setAttribute('transform', `translate(${x},${y})`);
  }

  getPinPosition(pinId) {
    const pinEl = this.svg.querySelector(`[data-pin="${pinId}"]`);
    if (!pinEl) return null;
    const rect = pinEl.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    const pt = this.svg.createSVGPoint();
    pt.x = rect.x + rect.width / 2;
    pt.y = rect.y + rect.height / 2;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  clear() {
    while (this.componentLayer.firstChild) this.componentLayer.firstChild.remove();
    while (this.wireLayer.firstChild) this.wireLayer.firstChild.remove();
    while (this.effectLayer.firstChild) this.effectLayer.firstChild.remove();
    this.components.clear();
    this.wires = [];
  }
}
