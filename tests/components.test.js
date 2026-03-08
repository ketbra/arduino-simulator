import { describe, it, expect } from 'vitest';
import { LED } from '../src/circuit/components/led.js';
import { RgbLed } from '../src/circuit/components/rgb-led.js';
import { Resistor } from '../src/circuit/components/resistor.js';
import { PushButton } from '../src/circuit/components/push-button.js';
import { UltrasonicSensor } from '../src/circuit/components/ultrasonic-sensor.js';

describe('LED', () => {
  it('has anode and cathode pins', () => {
    const led = new LED('led1');
    expect(led.pins).toEqual(['anode', 'cathode']);
  });

  it('computes brightness from pin states', () => {
    const led = new LED('led1');
    led.update({ anode: 1, cathode: 0 }, { hasResistor: true });
    expect(led.brightness).toBe(1);
    expect(led.burnedOut).toBe(false);
  });

  it('burns out without resistor', () => {
    const led = new LED('led1');
    led.update({ anode: 1, cathode: 0 }, { hasResistor: false });
    expect(led.burnedOut).toBe(true);
  });

  it('is off when cathode equals anode', () => {
    const led = new LED('led1');
    led.update({ anode: 0, cathode: 0 }, { hasResistor: true });
    expect(led.brightness).toBe(0);
  });
});

describe('RgbLed (common anode)', () => {
  it('has 4 pins', () => {
    const rgb = new RgbLed('rgb1');
    expect(rgb.pins).toEqual(['common', 'red', 'green', 'blue']);
  });

  it('inverts color values for common anode (LOW=bright)', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 0, green: 0, blue: 0 }, { hasResistors: true });
    expect(rgb.color).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('HIGH means off for common anode', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 255, green: 255, blue: 255 }, { hasResistors: true });
    expect(rgb.color).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('handles PWM values', () => {
    const rgb = new RgbLed('rgb1');
    rgb.update({ common: 1, red: 128, green: 255, blue: 0 }, { hasResistors: true });
    expect(rgb.color).toEqual({ r: 127, g: 0, b: 255 });
  });
});

describe('PushButton', () => {
  it('defaults to open (not pressed)', () => {
    const btn = new PushButton('btn1');
    expect(btn.isPressed).toBe(false);
  });

  it('toggles on press', () => {
    const btn = new PushButton('btn1');
    btn.press();
    expect(btn.isPressed).toBe(true);
    btn.release();
    expect(btn.isPressed).toBe(false);
  });
});

describe('Resistor', () => {
  it('has two pins and an ohm value', () => {
    const r = new Resistor('r1', 220);
    expect(r.pins).toEqual(['pin1', 'pin2']);
    expect(r.ohms).toBe(220);
  });
});

describe('UltrasonicSensor', () => {
  it('has 4 pins', () => {
    const us = new UltrasonicSensor('us1');
    expect(us.pins).toEqual(['vcc', 'trig', 'echo', 'gnd']);
  });
});
