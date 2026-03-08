export class PushButton {
  constructor(id) {
    this.id = id;
    this.type = 'push-button';
    this.pins = ['pin1a', 'pin1b', 'pin2a', 'pin2b'];
    this.isPressed = false;
  }

  press() { this.isPressed = true; }
  release() { this.isPressed = false; }
}
