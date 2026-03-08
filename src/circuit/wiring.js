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
        pinEl.setAttribute('fill', '#ffcc00');
        pinEl.setAttribute('r', '5');
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
        this.wireInProgress.el.setAttribute('fill', '#888');
        this.wireInProgress.el.setAttribute('r', '3');
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
      this._updatePreview(this.wireInProgress.x, this.wireInProgress.y, svgPt.x, svgPt.y);
    });

    // Cancel wire on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._cancelWire();
      }
    });
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
      this.wireInProgress.el.setAttribute('fill', '#888');
      this.wireInProgress.el.setAttribute('r', '3');
      this.wireInProgress = null;
      this._removePreview();
    }
  }

  clear() {
    this.wires.forEach((w) => w.el.remove());
    this.wires = [];
    this.graph.clear();
    this.wireInProgress = null;
    this._removePreview();
    this.colorIndex = 0;
  }
}
