const WIRE_COLORS = ['#22cc22', '#cc2222', '#2222cc', '#cccc22', '#cc8822', '#22cccc', '#cc22cc', '#888888'];

export class WiringSystem {
  constructor(svgElement, renderer, connectionGraph) {
    this.svg = svgElement;
    this.renderer = renderer;
    this.graph = connectionGraph;
    this.wireInProgress = null;
    this.wires = [];
    this.colorIndex = 0;
    this._previewLine = null;
    this._currentSnapTarget = null;
    this._setupListeners();
  }

  _setupListeners() {
    this.svg.addEventListener('click', (e) => {
      const pinEl = e.target.closest('[data-pin]');
      if (!pinEl) {
        // Click on empty space cancels wire in progress
        this._cancelWire();
        return;
      }

      const pinId = pinEl.getAttribute('data-pin');

      if (!this.wireInProgress) {
        // Start wire
        const pos = this._getPinCenter(pinEl);
        if (!pos) return;
        this.wireInProgress = { pinId, x: pos.x, y: pos.y, el: pinEl };

        // Find the visible pin-marker for this pin
        const marker = this._getMarkerForPin(pinEl);
        if (marker) {
          marker.classList.add('pin-wire-source');
          marker.setAttribute('r', '8');
          marker.setAttribute('fill', '#ffcc00');
        }

        // Add wiring-active class and highlight available targets
        this.svg.classList.add('wiring-active');
        this._highlightAvailableTargets(pinId);
      } else {
        // Complete wire
        if (pinId === this.wireInProgress.pinId) return; // Can't wire to self

        const pos = this._getPinCenter(pinEl);
        if (!pos) return;

        const color = WIRE_COLORS[this.colorIndex % WIRE_COLORS.length];
        this.colorIndex++;

        const wire = this.renderer.addWire(
          this.wireInProgress.x, this.wireInProgress.y,
          pos.x, pos.y, color
        );

        this.graph.addWire(this.wireInProgress.pinId, pinId);
        this.wires.push({
          el: wire,
          from: this.wireInProgress.pinId,
          to: pinId,
        });

        // Reset start pin visual
        this._resetWiringVisuals();
        this._removePreview();
        this.wireInProgress = null;
      }
    });

    // Live preview line while placing wire
    this.svg.addEventListener('mousemove', (e) => {
      if (!this.wireInProgress) return;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse());

      // Snap-to-pin
      let endX = svgPt.x;
      let endY = svgPt.y;

      const nearest = this._findNearestPin(svgPt.x, svgPt.y, 20);

      // Clear previous snap target
      if (this._currentSnapTarget) {
        this._currentSnapTarget.classList.remove('pin-snap-target');
        // Restore to available-target state if it had it
        if (this._currentSnapTarget.classList.contains('pin-available-target')) {
          this._currentSnapTarget.setAttribute('r', '5');
          this._currentSnapTarget.setAttribute('fill', '#88cc88');
        } else {
          this._currentSnapTarget.setAttribute('r', '5');
          this._currentSnapTarget.setAttribute('fill', '#888');
        }
        this._currentSnapTarget = null;
      }

      if (nearest && nearest.pinId !== this.wireInProgress.pinId) {
        endX = nearest.x;
        endY = nearest.y;
        nearest.el.classList.add('pin-snap-target');
        nearest.el.setAttribute('r', '8');
        nearest.el.setAttribute('fill', '#00cc66');
        this._currentSnapTarget = nearest.el;
      }

      this._updatePreview(this.wireInProgress.x, this.wireInProgress.y, endX, endY);
    });

    // Cancel wire on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._cancelWire();
      }
    });
  }

  _getMarkerForPin(pinEl) {
    // If the element is already a pin-marker circle, return it
    if (pinEl.classList && pinEl.classList.contains('pin-marker')) return pinEl;
    // If it's a hit area, find the sibling marker
    if (pinEl.classList && pinEl.classList.contains('pin-hitarea')) {
      const dataPinId = pinEl.getAttribute('data-pin');
      const parent = pinEl.parentElement;
      if (parent) {
        return parent.querySelector(`.pin-marker[data-pin="${dataPinId}"]`);
      }
    }
    // For <g> elements (Arduino pins), return the rect inside
    if (pinEl.tagName === 'g') {
      return pinEl.querySelector('rect:not(.pin-hitarea)');
    }
    return pinEl;
  }

  _highlightAvailableTargets(sourcePin) {
    const markers = this.svg.querySelectorAll('.pin-marker[data-pin]');
    for (const marker of markers) {
      const pinId = marker.getAttribute('data-pin');
      if (pinId !== sourcePin) {
        marker.classList.add('pin-available-target');
      }
    }
  }

  _resetWiringVisuals() {
    // Remove wire source class
    const source = this.svg.querySelector('.pin-wire-source');
    if (source) {
      source.classList.remove('pin-wire-source');
      source.setAttribute('r', '5');
      source.setAttribute('fill', '#888');
    }

    // Remove available target classes
    const targets = this.svg.querySelectorAll('.pin-available-target');
    for (const t of targets) {
      t.classList.remove('pin-available-target');
      t.setAttribute('r', '5');
      t.setAttribute('fill', '#888');
    }

    // Remove snap target
    if (this._currentSnapTarget) {
      this._currentSnapTarget.classList.remove('pin-snap-target');
      this._currentSnapTarget.setAttribute('r', '5');
      this._currentSnapTarget.setAttribute('fill', '#888');
      this._currentSnapTarget = null;
    }

    // Remove wiring-active
    this.svg.classList.remove('wiring-active');
  }

  _findNearestPin(svgX, svgY, threshold = 20) {
    const pins = this.svg.querySelectorAll('[data-pin]');
    let closest = null;
    let minDist = threshold;
    for (const pin of pins) {
      if (pin.classList.contains('pin-hitarea')) continue; // skip hitareas, use markers
      const center = this._getPinCenter(pin);
      if (!center) continue;
      const dx = center.x - svgX;
      const dy = center.y - svgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = { el: pin, pinId: pin.getAttribute('data-pin'), ...center };
      }
    }
    return closest;
  }

  _getPinCenter(pinEl) {
    // Get the center of a pin element in SVG coordinates
    if (pinEl.tagName === 'circle') {
      // Walk up transforms
      let cx = parseFloat(pinEl.getAttribute('cx')) || 0;
      let cy = parseFloat(pinEl.getAttribute('cy')) || 0;

      let el = pinEl.parentElement;
      while (el && el !== this.svg) {
        const transform = el.getAttribute('transform');
        if (transform) {
          const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (match) {
            cx += parseFloat(match[1]);
            cy += parseFloat(match[2]);
          }
        }
        el = el.parentElement;
      }
      return { x: cx, y: cy };
    }

    if (pinEl.tagName === 'rect') {
      let cx = parseFloat(pinEl.getAttribute('x')) + parseFloat(pinEl.getAttribute('width')) / 2;
      let cy = parseFloat(pinEl.getAttribute('y')) + parseFloat(pinEl.getAttribute('height')) / 2;

      let el = pinEl.parentElement;
      while (el && el !== this.svg) {
        const transform = el.getAttribute('transform');
        if (transform) {
          const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (match) {
            cx += parseFloat(match[1]);
            cy += parseFloat(match[2]);
          }
        }
        el = el.parentElement;
      }
      return { x: cx, y: cy };
    }

    if (pinEl.tagName === 'g') {
      const rect = pinEl.querySelector('rect:not(.pin-hitarea)');
      if (!rect) return null;
      let cx = parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width')) / 2;
      let cy = parseFloat(rect.getAttribute('y')) + parseFloat(rect.getAttribute('height')) / 2;

      let el = pinEl;
      while (el && el !== this.svg) {
        const transform = el.getAttribute('transform');
        if (transform) {
          const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (match) {
            cx += parseFloat(match[1]);
            cy += parseFloat(match[2]);
          }
        }
        el = el.parentElement;
      }
      return { x: cx, y: cy };
    }

    return null;
  }

  _updatePreview(x1, y1, x2, y2) {
    if (!this._previewLine) {
      const NS = 'http://www.w3.org/2000/svg';
      this._previewLine = document.createElementNS(NS, 'line');
      this._previewLine.setAttribute('stroke', '#ffcc0088');
      this._previewLine.setAttribute('stroke-width', '2');
      this._previewLine.setAttribute('stroke-dasharray', '4,4');
      this._previewLine.style.pointerEvents = 'none';
      this.svg.appendChild(this._previewLine);
    }
    this._previewLine.setAttribute('x1', x1);
    this._previewLine.setAttribute('y1', y1);
    this._previewLine.setAttribute('x2', x2);
    this._previewLine.setAttribute('y2', y2);
  }

  _removePreview() {
    if (this._previewLine) {
      this._previewLine.remove();
      this._previewLine = null;
    }
  }

  _cancelWire() {
    if (this.wireInProgress) {
      this._resetWiringVisuals();
      this.wireInProgress = null;
      this._removePreview();
    }
  }

  removeWire(wireEl) {
    const idx = this.wires.findIndex((w) => w.el === wireEl);
    if (idx !== -1) {
      const w = this.wires[idx];
      this.graph.removeWire(w.from, w.to);
      this.wires.splice(idx, 1);
    }
  }

  removeWiresForComponent(componentId) {
    const prefix = `component:${componentId}:`;
    const toRemove = this.wires.filter(
      (w) => w.from.startsWith(prefix) || w.to.startsWith(prefix)
    );
    for (const w of toRemove) {
      this.graph.removeWire(w.from, w.to);
      const idx = this.wires.indexOf(w);
      if (idx !== -1) this.wires.splice(idx, 1);
    }
  }

  clear() {
    this.wires.forEach((w) => w.el.remove());
    this.wires = [];
    this.graph.clear();
    this.wireInProgress = null;
    this._removePreview();
    this._resetWiringVisuals();
    this.colorIndex = 0;
  }
}
