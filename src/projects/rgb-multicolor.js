export const rgbMulticolor = {
  name: 'RGB LED Multicolor',
  description: 'RGB LED displays random colors every 500ms',
  code: `int ledPinR = 11;
int ledPinG = 10;
int ledPinB = 9;

void setup() {
  pinMode(ledPinR, OUTPUT);
  pinMode(ledPinG, OUTPUT);
  pinMode(ledPinB, OUTPUT);
}

void loop() {
  analogWrite(ledPinR, random(256));
  analogWrite(ledPinG, random(256));
  analogWrite(ledPinB, random(256));
  delay(500);
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 300, y: 280 },
    { type: 'resistor', id: 'r2', x: 350, y: 280 },
    { type: 'resistor', id: 'r3', x: 400, y: 280 },
    { type: 'rgb-led', id: 'rgb1', x: 350, y: 340 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:rgb1:common', color: '#cc2222' },
    { from: 'arduino:pin11', to: 'component:r1:pin1', color: '#cc2222' },
    { from: 'component:r1:pin2', to: 'component:rgb1:red', color: '#cc2222' },
    { from: 'arduino:pin10', to: 'component:r2:pin1', color: '#22cc22' },
    { from: 'component:r2:pin2', to: 'component:rgb1:green', color: '#22cc22' },
    { from: 'arduino:pin9', to: 'component:r3:pin1', color: '#2222cc' },
    { from: 'component:r3:pin2', to: 'component:rgb1:blue', color: '#2222cc' },
  ],
};
