import { describe, it, expect } from 'vitest';
import { transpile } from '../src/editor/transpiler.js';

describe('transpiler', () => {
  it('converts void functions to async JS functions', () => {
    expect(transpile('void setup() {')).toBe('async function setup() {');
    expect(transpile('void loop() {')).toBe('async function loop() {');
    expect(transpile('void myFunc() {')).toBe('async function myFunc() {');
  });

  it('converts void functions with typed args', () => {
    expect(transpile('void rgbLedDisplay(int red, int green, int blue) {'))
      .toBe('async function rgbLedDisplay(red, green, blue) {');
  });

  it('converts int/float variable declarations to let', () => {
    expect(transpile('int ledPin = 13;')).toBe('let ledPin = 13;');
    expect(transpile('float distance;')).toBe('let distance;');
    expect(transpile('unsigned long pingTime;')).toBe('let pingTime;');
  });

  it('converts #define to const', () => {
    expect(transpile('#define trigPin 12')).toBe('const trigPin = 12;');
    expect(transpile('#define MAX_DISTANCE 200')).toBe('const MAX_DISTANCE = 200;');
  });

  it('leaves plain JS/comments unchanged', () => {
    expect(transpile('// this is a comment')).toBe('// this is a comment');
    expect(transpile('x = 5;')).toBe('x = 5;');
  });

  it('removes C-style casts like (float)', () => {
    expect(transpile('  distance = (float)pingTime * soundVelocity / 2 / 10000;'))
      .toBe('  distance = pingTime * soundVelocity / 2 / 10000;');
  });

  it('handles multiline code', () => {
    const input = `void setup() {
  int x = 5;
  pinMode(13, OUTPUT);
}`;
    const output = transpile(input);
    expect(output).toContain('async function setup() {');
    expect(output).toContain('let x = 5;');
    expect(output).toContain('await pinMode(13, OUTPUT);');
  });
});
