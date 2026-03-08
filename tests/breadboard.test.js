import { describe, it, expect } from 'vitest';
import { BreadboardModel } from '../src/circuit/breadboard.js';

describe('BreadboardModel', () => {
  it('has 30 columns (1-30) and rows a-j', () => {
    const bb = new BreadboardModel();
    expect(bb.isValidPosition('a', 1)).toBe(true);
    expect(bb.isValidPosition('j', 30)).toBe(true);
    expect(bb.isValidPosition('k', 1)).toBe(false);
  });

  it('holes in same row group on same column are connected', () => {
    const bb = new BreadboardModel();
    expect(bb.areConnected('a1', 'e1')).toBe(true);
    expect(bb.areConnected('b5', 'd5')).toBe(true);
    expect(bb.areConnected('f1', 'j1')).toBe(true);
  });

  it('holes across the center gap are NOT connected', () => {
    const bb = new BreadboardModel();
    expect(bb.areConnected('e1', 'f1')).toBe(false);
  });

  it('power rails run the full length', () => {
    const bb = new BreadboardModel();
    expect(bb.areConnected('power+:1', 'power+:30')).toBe(true);
    expect(bb.areConnected('power-:1', 'power-:30')).toBe(true);
    expect(bb.areConnected('power+:1', 'power-:1')).toBe(false);
  });
});
