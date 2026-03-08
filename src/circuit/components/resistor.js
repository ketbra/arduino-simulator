export class Resistor {
  constructor(id, ohms = 220) {
    this.id = id;
    this.type = 'resistor';
    this.pins = ['pin1', 'pin2'];
    this.ohms = ohms;
  }
}
