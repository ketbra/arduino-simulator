export class RgbLed {
  constructor(id) {
    this.id = id;
    this.type = 'rgb-led';
    this.pins = ['common', 'red', 'green', 'blue'];
    this.color = { r: 0, g: 0, b: 0 };
    this.burnedOut = false;
  }

  update(pinValues, context) {
    if (this.burnedOut) return;
    if ((pinValues.common || 0) > 0 && !context.hasResistors) {
      this.burnedOut = true;
      this.color = { r: 0, g: 0, b: 0 };
      return;
    }
    this.color = {
      r: 255 - (pinValues.red || 0),
      g: 255 - (pinValues.green || 0),
      b: 255 - (pinValues.blue || 0),
    };
  }

  reset() {
    this.color = { r: 0, g: 0, b: 0 };
    this.burnedOut = false;
  }
}
