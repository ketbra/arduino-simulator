export class LED {
  constructor(id) {
    this.id = id;
    this.type = 'led';
    this.pins = ['anode', 'cathode'];
    this.brightness = 0;
    this.burnedOut = false;
  }

  update(pinValues, context) {
    if (this.burnedOut) return;
    const voltage = (pinValues.anode || 0) - (pinValues.cathode || 0);
    if (voltage > 0 && !context.hasResistor) {
      this.burnedOut = true;
      this.brightness = 0;
      return;
    }
    this.brightness = voltage > 0 ? Math.min(voltage, 1) : 0;
  }

  reset() {
    this.brightness = 0;
    this.burnedOut = false;
  }
}
