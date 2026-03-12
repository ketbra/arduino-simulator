import { describe, it, expect } from 'vitest';
import { ConnectionGraph } from '../src/circuit/connection-graph.js';
import { solveCircuit, LED_FORWARD_VOLTAGE, LED_INTERNAL_RESISTANCE, NOMINAL_LED_CURRENT, MAX_LED_CURRENT } from '../src/circuit/circuit-solver.js';
import { LED } from '../src/circuit/components/led.js';
import { RgbLed } from '../src/circuit/components/rgb-led.js';
import { Resistor } from '../src/circuit/components/resistor.js';

const GND_NODES = ['arduino:GND', 'arduino:GND2'];
const STATIC_POWER = [
  { node: 'arduino:5V', voltage: 5.0 },
  { node: 'arduino:3V3', voltage: 3.3 },
];

function buildGraph(wires) {
  const graph = new ConnectionGraph();
  for (const [a, b] of wires) {
    graph.addWire(a, b);
  }
  return graph;
}

describe('solveCircuit', () => {
  it('single LED + 220Ω resistor on 5V: brightness ≈ 0.68', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],  // internal LED connection
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    const led = results.get('led1');

    // I = (5 - 2) / 220 = 0.01364A, brightness = 0.01364 / 0.020 = 0.682
    expect(led.burnedOut).toBe(false);
    expect(led.brightness).toBeCloseTo(0.682, 2);
  });

  it('single LED no resistor on 5V: burnout', () => {
    const models = new Map();
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:5V', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    const led = results.get('led1');

    // I = (5-2)/25 = 0.12A = 120mA > 30mA, no resistor → burnout
    expect(led.burnedOut).toBe(true);
    expect(led.brightness).toBe(0);
  });

  it('2 LEDs in series on 5V + 220Ω: brightness ≈ 0.23', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));
    models.set('led2', new LED('led2'));

    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'component:led2:anode'],
      ['component:led2:anode', 'component:led2:cathode'],
      ['component:led2:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    const led1 = results.get('led1');
    const led2 = results.get('led2');

    // I = (5 - 2*2) / 220 = 1/220 = 0.00455A, brightness = 0.00455/0.020 = 0.227
    expect(led1.burnedOut).toBe(false);
    expect(led1.brightness).toBeCloseTo(0.227, 2);
    expect(led2.brightness).toBeCloseTo(0.227, 2);
  });

  it('3 LEDs in series on 5V: off (voltage insufficient)', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));
    models.set('led2', new LED('led2'));
    models.set('led3', new LED('led3'));

    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'component:led2:anode'],
      ['component:led2:anode', 'component:led2:cathode'],
      ['component:led2:cathode', 'component:led3:anode'],
      ['component:led3:anode', 'component:led3:cathode'],
      ['component:led3:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);

    // 5V - 3*2V = -1V → off
    expect(results.get('led1').brightness).toBe(0);
    expect(results.get('led2').brightness).toBe(0);
    expect(results.get('led3').brightness).toBe(0);
  });

  it('2 LEDs on 3.3V: off (3.3 - 4 = -0.7V)', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));
    models.set('led2', new LED('led2'));

    const graph = buildGraph([
      ['arduino:3V3', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'component:led2:anode'],
      ['component:led2:anode', 'component:led2:cathode'],
      ['component:led2:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    expect(results.get('led1').brightness).toBe(0);
    expect(results.get('led2').brightness).toBe(0);
  });

  it('reversed LED: off', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:cathode'],  // reversed!
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:anode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    const led = results.get('led1');
    expect(led.brightness).toBe(0);
  });

  it('LED with no complete circuit: off', () => {
    const models = new Map();
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:5V', 'component:led1:anode'],
      // cathode not connected to GND
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    expect(results.get('led1').brightness).toBe(0);
    expect(results.get('led1').burnedOut).toBe(false);
  });

  it('LED driven by GPIO pin (HIGH = 5V)', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:pin13', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const powerSources = [
      ...STATIC_POWER,
      { node: 'arduino:pin13', voltage: 5.0 },
    ];

    const results = solveCircuit(graph, models, powerSources, GND_NODES);
    expect(results.get('led1').brightness).toBeCloseTo(0.682, 2);
  });

  it('LED driven by GPIO pin LOW: off', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:pin13', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const powerSources = [
      ...STATIC_POWER,
      { node: 'arduino:pin13', voltage: 0 },
    ];

    const results = solveCircuit(graph, models, powerSources, GND_NODES);
    expect(results.get('led1').brightness).toBe(0);
  });

  it('push button open blocks circuit', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    // Button not pressed — no connection between pin1a and pin2a
    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:btn1:pin1a'],
      // gap: btn1:pin1a not connected to btn1:pin2a
      ['component:btn1:pin2a', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    expect(results.get('led1').brightness).toBe(0);
  });

  it('push button closed completes circuit', () => {
    const models = new Map();
    models.set('r1', new Resistor('r1', 220));
    models.set('led1', new LED('led1'));

    const graph = buildGraph([
      ['arduino:5V', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'component:btn1:pin1a'],
      ['component:btn1:pin1a', 'component:btn1:pin2a'],  // button pressed
      ['component:btn1:pin2a', 'component:led1:anode'],
      ['component:led1:anode', 'component:led1:cathode'],
      ['component:led1:cathode', 'arduino:GND'],
    ]);

    const results = solveCircuit(graph, models, STATIC_POWER, GND_NODES);
    expect(results.get('led1').brightness).toBeCloseTo(0.682, 2);
  });

  it('RGB LED channels with PWM values', () => {
    const models = new Map();
    models.set('rgb1', new RgbLed('rgb1'));
    models.set('r1', new Resistor('r1', 220));
    models.set('r2', new Resistor('r2', 220));
    models.set('r3', new Resistor('r3', 220));

    const graph = buildGraph([
      ['arduino:5V', 'component:rgb1:common'],
      ['component:rgb1:red', 'component:r1:pin1'],
      ['component:r1:pin1', 'component:r1:pin2'],
      ['component:r1:pin2', 'arduino:pin9'],
      ['component:rgb1:green', 'component:r2:pin1'],
      ['component:r2:pin1', 'component:r2:pin2'],
      ['component:r2:pin2', 'arduino:pin10'],
      ['component:rgb1:blue', 'component:r3:pin1'],
      ['component:r3:pin1', 'component:r3:pin2'],
      ['component:r3:pin2', 'arduino:pin11'],
    ]);

    // Pin 9 = LOW (0V) → max current through red channel
    // Pin 10 = HIGH (5V) → no current through green
    // Pin 11 = PWM 128 → 128/255 * 5V = 2.51V → vAcross = 5 - 2.51 - 2 = 0.49V
    const powerSources = [
      ...STATIC_POWER,
      { node: 'arduino:pin9', voltage: 0 },
      { node: 'arduino:pin10', voltage: 5.0 },
      { node: 'arduino:pin11', voltage: (128 / 255) * 5.0 },
    ];

    const results = solveCircuit(graph, models, powerSources, GND_NODES);
    const rgb = results.get('rgb1');

    expect(rgb.burnedOut).toBe(false);
    // Red: (5-0-2)/220 = 3/220 = 0.01364A → brightness = 0.682 → 174
    expect(rgb.color.r).toBeGreaterThan(150);
    // Green: (5-5-2) = -2 → 0
    expect(rgb.color.g).toBe(0);
    // Blue: (5-2.51-2)/220 = 0.49/220 → brightness ≈ 0.111 → ~28
    expect(rgb.color.b).toBeGreaterThan(0);
    expect(rgb.color.b).toBeLessThan(100);
  });
});
