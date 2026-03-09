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

  // Check LEDs connected to static power rails (5V/3.3V + GND)
  evaluateStaticConnections() {
    const POWER_NODES = ['arduino:5V', 'arduino:3V3'];
    const GND_NODES = ['arduino:GND', 'arduino:GND2'];

    for (const [id, model] of this.models) {
      if (model.type === 'led') {
        const anodeConnected = this.graph.getConnectedNodes(`component:${id}:anode`);
        const cathodeConnected = this.graph.getConnectedNodes(`component:${id}:cathode`);

        const anodeHasPower = anodeConnected.some((n) => POWER_NODES.includes(n));
        const cathodeHasGnd = cathodeConnected.some((n) => GND_NODES.includes(n));
        // Also handle reversed wiring
        const anodeHasGnd = anodeConnected.some((n) => GND_NODES.includes(n));
        const cathodeHasPower = cathodeConnected.some((n) => POWER_NODES.includes(n));

        const hasCompletePowerCircuit = (anodeHasPower && cathodeHasGnd) || (anodeHasGnd && cathodeHasPower);
        if (hasCompletePowerCircuit) {
          const hasResistor = [...anodeConnected, ...cathodeConnected].some((n) => /^component:(r\d+|resistor-\d+):/.test(n));
          const voltage = (anodeHasPower && cathodeHasGnd) ? 1 : -1;
          model.update({ anode: voltage > 0 ? 1 : 0, cathode: voltage > 0 ? 0 : 1 }, { hasResistor });
          this.renderer.updateLed(id, model.brightness, model.burnedOut);
        }
      }
    }
  }

  _onPinChange(pin, value) {
    const pinNode = `arduino:pin${pin}`;

    for (const [id, model] of this.models) {
      if (model.type === 'led') {
        const anodeConnected = this.graph.getConnectedNodes(`component:${id}:anode`);
        const cathodeConnected = this.graph.getConnectedNodes(`component:${id}:cathode`);
        const allConnected = [...anodeConnected, ...cathodeConnected];

        // Check if the changed pin drives this LED
        if (allConnected.includes(pinNode)) {
          const hasResistor = allConnected.some((n) => /^component:(r\d+|resistor-\d+):/.test(n));
          model.update({ anode: value, cathode: 0 }, { hasResistor });
          this.renderer.updateLed(id, model.brightness, model.burnedOut);
        } else if (!model.burnedOut && model.brightness > 0) {
          // Pin changed but LED not connected to it — check if LED lost its driver
          const hasAnyDriver = allConnected.some((n) => /^arduino:pin\d+$/.test(n));
          if (!hasAnyDriver) {
            model.brightness = 0;
            this.renderer.updateLed(id, model.brightness, model.burnedOut);
          }
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
          // Only check resistors on channels that are actually connected to a pin
          const hasResistors = ['red', 'green', 'blue'].every((ch) => {
            const connected = this.graph.getConnectedNodes(`component:${id}:${ch}`);
            const isActive = connected.some((n) => /^arduino:pin\d+$/.test(n));
            if (!isActive) return true; // unconnected channel is fine
            return connected.some((n) => /^component:(r\d+|resistor-\d+):/.test(n));
          });

          // Scale pin values to 0-255 range for the RGB model (common-anode)
          // null = unconnected channel → 255 (HIGH = OFF for common-anode)
          // Digital 0/1 → 0/255, analogWrite 0-255 passed through
          const scale = (v) => v == null ? 255 : (v <= 1 ? v * 255 : v);
          model.update({
            common: commonConnected.some((n) => n.includes('5V')) ? 1 : 0,
            red: scale(pinMap.red),
            green: scale(pinMap.green),
            blue: scale(pinMap.blue),
          }, { hasResistors });

          this.renderer.updateRgbLed(id, model.color, model.burnedOut);
        }
      }
    }
  }
}
