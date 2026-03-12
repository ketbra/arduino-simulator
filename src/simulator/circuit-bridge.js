import { solveCircuit } from '../circuit/circuit-solver.js';

const GND_NODES = ['arduino:GND', 'arduino:GND2'];

export class CircuitBridge {
  constructor(runtime, renderer, connectionGraph, componentModels, bbRenderer) {
    this.runtime = runtime;
    this.renderer = renderer;
    this.bbRenderer = bbRenderer || null;
    this.graph = connectionGraph;
    this.models = componentModels; // Map<id, componentModel>

    this.runtime.on('pinChange', (pin, value, mode) => {
      this._onPinChange(pin, value);
    });
  }

  _updateLed(id, brightness, burnedOut) {
    this.renderer.updateLed(id, brightness, burnedOut);
    if (this.bbRenderer) this.bbRenderer.updateLed(id, brightness, burnedOut);
  }

  _updateRgbLed(id, color, burnedOut) {
    this.renderer.updateRgbLed(id, color, burnedOut);
    if (this.bbRenderer) this.bbRenderer.updateRgbLed(id, color, burnedOut);
  }

  evaluateStaticConnections() {
    const powerSources = [
      { node: 'arduino:5V', voltage: 5.0 },
      { node: 'arduino:3V3', voltage: 3.3 },
    ];
    this._solveAndApply(powerSources);
  }

  _onPinChange(pin, value) {
    // Build power sources including GPIO pins
    const powerSources = [
      { node: 'arduino:5V', voltage: 5.0 },
      { node: 'arduino:3V3', voltage: 3.3 },
    ];

    // Add all active GPIO pins as power sources
    for (let p = 0; p <= 13; p++) {
      const state = this.runtime.getPinState(p);
      if (state !== undefined && state !== null) {
        // Digital: 0 or 1 → 0V or 5V. PWM: 0-255 → 0-5V
        const voltage = state <= 1 ? state * 5.0 : (state / 255) * 5.0;
        powerSources.push({ node: `arduino:pin${p}`, voltage });
      }
    }

    this._solveAndApply(powerSources);
  }

  _solveAndApply(powerSources) {
    const results = solveCircuit(this.graph, this.models, powerSources, GND_NODES);

    for (const [id, result] of results) {
      const model = this.models.get(id);
      if (!model) continue;
      if (model.type === 'led') {
        model.brightness = result.brightness;
        model.burnedOut = result.burnedOut;
        this._updateLed(id, model.brightness, model.burnedOut);
      } else if (model.type === 'rgb-led') {
        model.color = result.color;
        model.burnedOut = result.burnedOut;
        this._updateRgbLed(id, model.color, model.burnedOut);
      }
    }
  }
}
