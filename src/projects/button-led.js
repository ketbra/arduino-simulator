export const buttonLed = {
  name: 'Button-Controlled LED',
  description: 'LED lights when button is pressed (circuit only, no code needed)',
  code: `// This project uses the Arduino as power supply only.
// The LED is controlled directly by the push button circuit.
// No code is needed - just connect 5V through the button,
// resistor, and LED to GND.

void setup() {
  // Nothing to configure - Arduino is just providing power
}

void loop() {
  // Nothing to do - the circuit handles everything
}`,
  components: [
    { type: 'resistor', id: 'r1', x: 350, y: 280 },
    { type: 'push-button', id: 'btn1', x: 300, y: 320 },
    { type: 'led', id: 'led1', x: 400, y: 320 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:btn1:pin1a', color: '#cc2222' },
    { from: 'component:btn1:pin2a', to: 'component:r1:pin1', color: '#cccc22' },
    { from: 'component:r1:pin2', to: 'component:led1:anode', color: '#22cc22' },
    { from: 'component:led1:cathode', to: 'arduino:GND', color: '#222222' },
  ],
};
