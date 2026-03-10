import { describe, it, expect } from 'vitest';
import { compute, COMPONENT_SPECS, getPinHole } from '../src/circuit/breadboard-layout.js';

// Helper: create minimal component objects matching the project's class shapes
function resistor(id, ohms = 220) {
  return { id, type: 'resistor', pins: ['pin1', 'pin2'], ohms };
}
function led(id) {
  return { id, type: 'led', pins: ['anode', 'cathode'], brightness: 0 };
}
function rgbLed(id) {
  return { id, type: 'rgb-led', pins: ['common', 'red', 'green', 'blue'] };
}
function pushButton(id) {
  return { id, type: 'push-button', pins: ['pin1a', 'pin1b', 'pin2a', 'pin2b'] };
}
function ultrasonicSensor(id) {
  return { id, type: 'ultrasonic-sensor', pins: ['vcc', 'trig', 'echo', 'gnd'] };
}

describe('BreadboardLayout', () => {
  describe('empty circuit', () => {
    it('returns empty results for no components', () => {
      const result = compute([], []);
      expect(result.placements.size).toBe(0);
      expect(result.jumperWires).toEqual([]);
      expect(result.occupiedHoles).toEqual([]);
    });

    it('returns empty results for null/undefined components', () => {
      const result = compute(null, []);
      expect(result.placements.size).toBe(0);
    });
  });

  describe('simple LED circuit (pin13 → resistor → LED → GND)', () => {
    const components = [resistor('r1'), led('led1')];
    const wires = [
      { from: 'arduino:pin13', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    it('places both components', () => {
      const result = compute(components, wires);
      expect(result.placements.has('r1')).toBe(true);
      expect(result.placements.has('led1')).toBe(true);
    });

    it('assigns resistor before LED (BFS from pin13)', () => {
      const result = compute(components, wires);
      const r1Col = result.placements.get('r1').startCol;
      const led1Col = result.placements.get('led1').startCol;
      expect(r1Col).toBeLessThan(led1Col);
    });

    it('assigns correct column spans', () => {
      const result = compute(components, wires);
      expect(result.placements.get('r1').colSpan).toBe(1);
      expect(result.placements.get('led1').colSpan).toBe(1);
    });

    it('records correct types in placements', () => {
      const result = compute(components, wires);
      expect(result.placements.get('r1').type).toBe('resistor');
      expect(result.placements.get('led1').type).toBe('led');
    });

    it('generates jumper wires from Arduino pins', () => {
      const result = compute(components, wires);
      // Should have a jumper from arduino:pin13 to resistor pin1
      const gpioJumper = result.jumperWires.find(
        (j) => j.from === 'arduino:pin13'
      );
      expect(gpioJumper).toBeDefined();
      expect(gpioJumper.toHole).toBeDefined();
      expect(gpioJumper.toHole.row).toBe('top');
    });

    it('generates power rail jumper for GND', () => {
      const result = compute(components, wires);
      const gndJumper = result.jumperWires.find(
        (j) => j.from === 'arduino:GND'
      );
      expect(gndJumper).toBeDefined();
      expect(gndJumper.railType).toBe('-');
    });

    it('tracks occupied holes for both components', () => {
      const result = compute(components, wires);
      const r1Holes = result.occupiedHoles.filter((h) => h.compId === 'r1');
      const led1Holes = result.occupiedHoles.filter((h) => h.compId === 'led1');
      // Resistor has 2 pins (top + bot), LED has 2 pins (top + bot)
      expect(r1Holes).toHaveLength(2);
      expect(led1Holes).toHaveLength(2);
    });

    it('resistor pins occupy top and bottom row groups', () => {
      const result = compute(components, wires);
      const r1Holes = result.occupiedHoles.filter((h) => h.compId === 'r1');
      const rows = r1Holes.map((h) => h.row).sort();
      expect(rows).toEqual(['bot', 'top']);
    });
  });

  describe('component-to-component wire skipping', () => {
    it('skips jumper when two pins share same column and row group', () => {
      // Resistor pin2 (bot) → LED anode (top): different row groups → should generate wire
      // But if we had two pins in the same column+row, it would skip
      const components = [resistor('r1'), led('led1')];
      const wires = [
        { from: 'arduino:pin13', to: 'component:r1:pin1' },
        { from: 'component:r1:pin2', to: 'component:led1:anode' },
        { from: 'component:led1:cathode', to: 'arduino:GND' },
      ];
      const result = compute(components, wires);

      // r1:pin2 is in 'bot', led1:anode is in 'top' → different row groups → wire generated
      const compWire = result.jumperWires.find(
        (j) => j.fromHole && j.toHole
      );
      expect(compWire).toBeDefined();
    });
  });

  describe('multi-pin RGB LED', () => {
    const components = [rgbLed('rgb1')];
    const wires = [
      { from: 'arduino:5V', to: 'component:rgb1:common' },
      { from: 'arduino:pin9', to: 'component:rgb1:red' },
      { from: 'arduino:pin10', to: 'component:rgb1:green' },
      { from: 'arduino:pin11', to: 'component:rgb1:blue' },
    ];

    it('assigns 4-column span for RGB LED', () => {
      const result = compute(components, wires);
      expect(result.placements.has('rgb1')).toBe(true);
      expect(result.placements.get('rgb1').colSpan).toBe(4);
    });

    it('all RGB LED pins are in top row group', () => {
      const result = compute(components, wires);
      const rgbHoles = result.occupiedHoles.filter((h) => h.compId === 'rgb1');
      expect(rgbHoles).toHaveLength(4);
      expect(rgbHoles.every((h) => h.row === 'top')).toBe(true);
    });

    it('each pin occupies a unique column', () => {
      const result = compute(components, wires);
      const rgbHoles = result.occupiedHoles.filter((h) => h.compId === 'rgb1');
      const cols = rgbHoles.map((h) => h.col);
      expect(new Set(cols).size).toBe(4);
    });

    it('generates jumper wires for GPIO and power pins', () => {
      const result = compute(components, wires);
      // 3 GPIO + 1 power = 4 jumpers
      expect(result.jumperWires.length).toBe(4);
      const powerJumper = result.jumperWires.find((j) => j.railType === '+');
      expect(powerJumper).toBeDefined();
    });
  });

  describe('push-button circuit with power rails', () => {
    const components = [pushButton('btn1'), resistor('r1')];
    const wires = [
      { from: 'arduino:5V', to: 'component:btn1:pin1a' },
      { from: 'component:btn1:pin2a', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'arduino:GND' },
      { from: 'component:btn1:pin2b', to: 'arduino:pin2' },
    ];

    it('assigns 2-column span for push-button', () => {
      const result = compute(components, wires);
      expect(result.placements.get('btn1').colSpan).toBe(2);
    });

    it('places button before resistor (BFS order from pins)', () => {
      const result = compute(components, wires);
      const btnCol = result.placements.get('btn1').startCol;
      const r1Col = result.placements.get('r1').startCol;
      expect(btnCol).toBeLessThan(r1Col);
    });

    it('button occupies 4 holes across 2 columns', () => {
      const result = compute(components, wires);
      const btnHoles = result.occupiedHoles.filter((h) => h.compId === 'btn1');
      expect(btnHoles).toHaveLength(4);
      const cols = [...new Set(btnHoles.map((h) => h.col))];
      expect(cols).toHaveLength(2);
    });

    it('generates power rail jumper wires', () => {
      const result = compute(components, wires);
      const fiveVJumper = result.jumperWires.find((j) => j.from === 'arduino:5V');
      expect(fiveVJumper).toBeDefined();
      expect(fiveVJumper.railType).toBe('+');
      const gndJumper = result.jumperWires.find((j) => j.from === 'arduino:GND');
      expect(gndJumper).toBeDefined();
      expect(gndJumper.railType).toBe('-');
    });
  });

  describe('ultrasonic sensor', () => {
    const components = [ultrasonicSensor('us1')];
    const wires = [
      { from: 'arduino:5V', to: 'component:us1:vcc' },
      { from: 'arduino:pin7', to: 'component:us1:trig' },
      { from: 'arduino:pin8', to: 'component:us1:echo' },
      { from: 'arduino:GND', to: 'component:us1:gnd' },
    ];

    it('assigns 4-column span', () => {
      const result = compute(components, wires);
      expect(result.placements.get('us1').colSpan).toBe(4);
    });

    it('all pins in top row group', () => {
      const result = compute(components, wires);
      const holes = result.occupiedHoles.filter((h) => h.compId === 'us1');
      expect(holes.every((h) => h.row === 'top')).toBe(true);
    });
  });

  describe('multiple chains', () => {
    it('places components from separate chains in order', () => {
      const components = [resistor('r1'), led('led1'), resistor('r2'), led('led2')];
      const wires = [
        // Chain 1: pin13 → r1 → led1 → GND
        { from: 'arduino:pin13', to: 'component:r1:pin1' },
        { from: 'component:r1:pin2', to: 'component:led1:anode' },
        { from: 'component:led1:cathode', to: 'arduino:GND' },
        // Chain 2: pin12 → r2 → led2 → GND
        { from: 'arduino:pin12', to: 'component:r2:pin1' },
        { from: 'component:r2:pin2', to: 'component:led2:anode' },
        { from: 'component:led2:cathode', to: 'arduino:GND' },
      ];

      const result = compute(components, wires);
      expect(result.placements.size).toBe(4);

      // All four components should have distinct starting columns
      const cols = [...result.placements.values()].map((p) => p.startCol);
      expect(new Set(cols).size).toBe(4);
    });
  });

  describe('disconnected components', () => {
    it('still places components not connected to Arduino', () => {
      const components = [resistor('r1'), led('led1')];
      // No wires at all — both components are disconnected
      const wires = [];
      const result = compute(components, wires);
      expect(result.placements.size).toBe(2);
    });
  });

  describe('getPinHole helper', () => {
    it('returns correct hole for a placed component pin', () => {
      const placements = new Map([
        ['r1', { startCol: 5, colSpan: 1, type: 'resistor' }],
      ]);
      const hole = getPinHole('r1', 'pin1', placements);
      expect(hole).toEqual({ col: 5, row: 'top', compId: 'r1', pinName: 'pin1' });

      const hole2 = getPinHole('r1', 'pin2', placements);
      expect(hole2).toEqual({ col: 5, row: 'bot', compId: 'r1', pinName: 'pin2' });
    });

    it('returns null for unknown component', () => {
      const placements = new Map();
      expect(getPinHole('r99', 'pin1', placements)).toBeNull();
    });
  });
});
