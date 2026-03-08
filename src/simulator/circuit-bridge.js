export class CircuitBridge {
  constructor(runtime, renderer, connectionGraph, componentModels) {
    this.runtime = runtime;
    this.renderer = renderer;
    this.graph = connectionGraph;
    this.models = componentModels; // Map<id, componentModel>

    this.runtime.on('pinChange', (pin, value, mode) => {
      this._onPinChange(pin, value);
    });
  }

  _onPinChange(pin, value) {
    const pinNode = `arduino:pin${pin}`;

    for (const [id, model] of this.models) {
      if (model.type === 'led') {
        const anodeConnected = this.graph.getConnectedNodes(`component:${id}:anode`);
        const cathodeConnected = this.graph.getConnectedNodes(`component:${id}:cathode`);

        // Check if this pin drives the LED
        if (anodeConnected.includes(pinNode) || cathodeConnected.includes(pinNode)) {
          const hasResistor = [...anodeConnected, ...cathodeConnected].some((n) => n.includes('resistor') || /^component:r\d+:/.test(n));
          model.update({ anode: value, cathode: 0 }, { hasResistor });
          this.renderer.updateLed(id, model.brightness, model.burnedOut);
        }
      }

      if (model.type === 'rgb-led') {
        const pinMap = { red: null, green: null, blue: null };
        let needsUpdate = false;

        for (const channel of ['red', 'green', 'blue']) {
          const channelConnected = this.graph.getConnectedNodes(`component:${id}:${channel}`);
          for (const node of channelConnected) {
            const match = node.match(/arduino:pin(\d+)/);
            if (match) {
              const pinNum = parseInt(match[1], 10);
              pinMap[channel] = this.runtime.getPinState(pinNum) || 0;
              if (pinNum === pin) needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          const commonConnected = this.graph.getConnectedNodes(`component:${id}:common`);
          const hasResistors = ['red', 'green', 'blue'].every((ch) => {
            const connected = this.graph.getConnectedNodes(`component:${id}:${ch}`);
            return connected.some((n) => n.includes('resistor') || /^component:r\d+:/.test(n));
          });

          model.update({
            common: commonConnected.some((n) => n.includes('5V')) ? 1 : 0,
            red: pinMap.red || 0,
            green: pinMap.green || 0,
            blue: pinMap.blue || 0,
          }, { hasResistors });

          this.renderer.updateRgbLed(id, model.color, model.burnedOut);
        }
      }
    }
  }
}
