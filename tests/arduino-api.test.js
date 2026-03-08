import { describe, it, expect, beforeEach } from 'vitest';
import { createArduinoRuntime } from '../src/simulator/arduino-api.js';

describe('Arduino API', () => {
  let runtime;

  beforeEach(() => {
    runtime = createArduinoRuntime();
  });

  it('sets pin mode', () => {
    runtime.api.pinMode(13, runtime.api.OUTPUT);
    expect(runtime.getPinMode(13)).toBe('OUTPUT');
  });

  it('writes digital HIGH/LOW', () => {
    runtime.api.pinMode(13, runtime.api.OUTPUT);
    runtime.api.digitalWrite(13, runtime.api.HIGH);
    expect(runtime.getPinState(13)).toBe(1);
    runtime.api.digitalWrite(13, runtime.api.LOW);
    expect(runtime.getPinState(13)).toBe(0);
  });

  it('writes analog values 0-255', () => {
    runtime.api.pinMode(9, runtime.api.OUTPUT);
    runtime.api.analogWrite(9, 128);
    expect(runtime.getPinState(9)).toBe(128);
  });

  it('reads digital pin state', () => {
    runtime.api.pinMode(7, runtime.api.INPUT);
    runtime.setExternalPinState(7, 1);
    expect(runtime.api.digitalRead(7)).toBe(1);
  });

  it('Serial.print appends to output buffer', () => {
    runtime.api.Serial.begin(9600);
    runtime.api.Serial.print('Hello');
    runtime.api.Serial.println(' World');
    expect(runtime.getSerialOutput()).toBe('Hello World\n');
  });

  it('random returns value in range', () => {
    for (let i = 0; i < 50; i++) {
      const val = runtime.api.random(10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
    }
  });

  it('constrain clamps values', () => {
    expect(runtime.api.constrain(300, 0, 255)).toBe(255);
    expect(runtime.api.constrain(-5, 0, 255)).toBe(0);
    expect(runtime.api.constrain(100, 0, 255)).toBe(100);
  });

  it('map scales values between ranges', () => {
    expect(runtime.api.map(512, 0, 1024, 0, 100)).toBe(50);
  });

  it('pulseIn returns simulated timing from distance', () => {
    runtime.setSensorDistance(50);
    const timing = runtime.api.pulseIn(11, runtime.api.HIGH, 12000);
    expect(timing).toBeCloseTo(2941, -1);
  });
});
