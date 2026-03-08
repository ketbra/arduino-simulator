export const ledBlink = {
  name: 'LED Blink',
  description: 'Blink an LED on and off every second',
  code: `#define ledPin 13

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 350, y: 280 },
    { type: 'led', id: 'led1', x: 400, y: 320 },
  ],
  wires: [
    { from: 'arduino:pin13', to: 'component:r1:pin1', color: '#22cc22' },
    { from: 'component:r1:pin2', to: 'component:led1:anode', color: '#22cc22' },
    { from: 'component:led1:cathode', to: 'arduino:GND', color: '#222222' },
  ],
};
