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

    this._initSvg();
    this._initDragListeners();
  }

  _initSvg() {
    this.svg.setAttribute('viewBox', '0 0 800 600');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';

    const NS = 'http://www.w3.org/2000/svg';
    this.boardLayer = document.createElementNS(NS, 'g');
    this.wireLayer = document.createElementNS(NS, 'g');
    this.componentLayer = document.createElementNS(NS, 'g');
    this.effectLayer = document.createElementNS(NS, 'g');

    this.svg.appendChild(this.boardLayer);
    this.svg.appendChild(this.wireLayer);
    this.svg.appendChild(this.componentLayer);
    this.svg.appendChild(this.effectLayer);

    this.boardLayer.appendChild(renderArduinoBoard(270, 10));
    this.boardLayer.appendChild(renderBreadboard(20, 200));
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
    });

    this.svg.addEventListener('mouseup', () => {
      if (this.dragState) {
        const comp = this.components.get(this.dragState.id);
        if (comp) comp.el.style.cursor = 'grab';
        this.dragState = null;
      }
    });
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

  addWire(x1, y1, x2, y2, color) {
    const wire = renderWire(x1, y1, x2, y2, color);
    this.wireLayer.appendChild(wire);
    this.wires.push(wire);
    return wire;
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
      this.dragState = { id, offsetX: svgPt.x - comp.x, offsetY: svgPt.y - comp.y };
      el.style.cursor = 'grabbing';
    });
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
