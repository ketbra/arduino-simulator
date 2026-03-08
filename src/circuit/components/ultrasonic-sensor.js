export class UltrasonicSensor {
  constructor(id) {
    this.id = id;
    this.type = 'ultrasonic-sensor';
    this.pins = ['vcc', 'trig', 'echo', 'gnd'];
  }
}
