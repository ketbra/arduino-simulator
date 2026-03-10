// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { BreadboardRenderer } from '../src/circuit/breadboard-renderer.js';
import { compute } from '../src/circuit/breadboard-layout.js';

const NS = 'http://www.w3.org/2000/svg';

// Helper: create a minimal SVG container
function createSvgContainer() {
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  document.body.appendChild(svg);
  return g;
}

// Component factory helpers (matching breadboard-layout test style)
function resistor(id) {
  return { id, type: 'resistor', pins: ['pin1', 'pin2'] };
}
function led(id) {
  return { id, type: 'led', pins: ['anode', 'cathode'] };
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

describe('BreadboardRenderer', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = createSvgContainer();
    renderer = new BreadboardRenderer(container);
  });

  describe('constructor and clear', () => {
    it('creates a renderer with a container', () => {
      expect(renderer).toBeDefined();
    });

    it('clear() is safe to call before any render', () => {
      expect(() => renderer.clear()).not.toThrow();
    });
  });

  describe('empty layout', () => {
    it('renders an empty layout without error', () => {
      const layout = compute([], []);
      renderer.render(layout);
      const overlay = container.querySelector('.bb-overlay');
      expect(overlay).not.toBeNull();
    });

    it('has no component groups for empty layout', () => {
      const layout = compute([], []);
      renderer.render(layout);
      const comps = container.querySelectorAll('[data-bb-component]');
      expect(comps.length).toBe(0);
    });
  });

  describe('simple LED circuit', () => {
    const components = [resistor('r1'), led('led1')];
    const wires = [
      { from: 'arduino:pin13', to: 'component:r1:pin1' },
      { from: 'component:r1:pin2', to: 'component:led1:anode' },
      { from: 'component:led1:cathode', to: 'arduino:GND' },
    ];

    it('renders component groups for resistor and LED', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-resistor')).not.toBeNull();
      expect(container.querySelector('.bb-led')).not.toBeNull();
    });

    it('renders the LED body with correct class', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-led-body')).not.toBeNull();
    });

    it('renders row-group highlights', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const highlights = container.querySelectorAll('.bb-highlight');
      // r1 has top + bot pins, led1 has top + bot pins
      // Each pin highlights 5 holes in its row group
      // But r1 and led1 might share columns — check there are highlights
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('renders jumper wires', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const jumpers = container.querySelectorAll('.bb-jumper');
      expect(jumpers.length).toBeGreaterThan(0);
    });

    it('renders GPIO jumper with data-from-pin attribute', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const gpioWire = container.querySelector('[data-from-pin="arduino:pin13"]');
      expect(gpioWire).not.toBeNull();
    });

    it('renders GND rail jumper with data-from-pin', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const gndWire = container.querySelector('[data-from-pin="arduino:GND"]');
      expect(gndWire).not.toBeNull();
    });
  });

  describe('push-button', () => {
    const components = [pushButton('btn1')];
    const wires = [
      { from: 'arduino:5V', to: 'component:btn1:pin1a' },
      { from: 'component:btn1:pin2b', to: 'arduino:pin2' },
    ];

    it('renders push-button component', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-push-button')).not.toBeNull();
    });

    it('push-button has 4 pin dots', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const btnGroup = container.querySelector('.bb-push-button');
      const circles = btnGroup.querySelectorAll('circle');
      // 1 cap circle + 4 pin dots = 5
      expect(circles.length).toBe(5);
    });
  });

  describe('RGB LED', () => {
    const components = [rgbLed('rgb1')];
    const wires = [
      { from: 'arduino:5V', to: 'component:rgb1:common' },
      { from: 'arduino:pin9', to: 'component:rgb1:red' },
      { from: 'arduino:pin10', to: 'component:rgb1:green' },
      { from: 'arduino:pin11', to: 'component:rgb1:blue' },
    ];

    it('renders RGB LED component', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-rgb-led')).not.toBeNull();
    });

    it('renders RGB LED body with correct class', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-rgb-led-body')).not.toBeNull();
    });

    it('RGB LED body has data-bb-component attr', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const body = container.querySelector('.bb-rgb-led-body');
      expect(body.getAttribute('data-bb-component')).toBe('rgb1');
    });

    it('renders 4 legs (lines) and 4 pin dots', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const rgbGroup = container.querySelector('.bb-rgb-led');
      const lines = rgbGroup.querySelectorAll('line');
      expect(lines.length).toBe(4);
      // 1 body circle + 4 pin dots = 5 circles
      const circles = rgbGroup.querySelectorAll('circle');
      expect(circles.length).toBe(5);
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

    it('renders ultrasonic component', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      expect(container.querySelector('.bb-ultrasonic')).not.toBeNull();
    });

    it('ultrasonic has 2 "eye" circles plus 4 pin dots', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const usGroup = container.querySelector('.bb-ultrasonic');
      const circles = usGroup.querySelectorAll('circle');
      // 2 eyes + 4 pin dots = 6
      expect(circles.length).toBe(6);
    });

    it('ultrasonic has body rect and 4 leg lines', () => {
      const layout = compute(components, wires);
      renderer.render(layout);
      const usGroup = container.querySelector('.bb-ultrasonic');
      expect(usGroup.querySelectorAll('rect').length).toBe(1);
      expect(usGroup.querySelectorAll('line').length).toBe(4);
    });
  });

  describe('render replaces previous overlay', () => {
    it('calling render twice leaves only one overlay', () => {
      const layout = compute([resistor('r1')], []);
      renderer.render(layout);
      renderer.render(layout);
      const overlays = container.querySelectorAll('.bb-overlay');
      expect(overlays.length).toBe(1);
    });
  });

  describe('clear removes overlay', () => {
    it('clear removes all rendered elements', () => {
      const layout = compute([resistor('r1')], []);
      renderer.render(layout);
      expect(container.querySelector('.bb-overlay')).not.toBeNull();
      renderer.clear();
      expect(container.querySelector('.bb-overlay')).toBeNull();
    });
  });

  describe('row-group highlighting', () => {
    it('highlights 5 holes per occupied row-group column', () => {
      // Single resistor occupies col N top + col N bot = 2 groups
      // Each group gets 5 highlight circles = 10 total
      const layout = compute([resistor('r1')], []);
      renderer.render(layout);
      const highlights = container.querySelectorAll('.bb-highlight');
      expect(highlights.length).toBe(10);
    });

    it('highlight circles have correct fill and stroke', () => {
      const layout = compute([resistor('r1')], []);
      renderer.render(layout);
      const highlight = container.querySelector('.bb-highlight');
      expect(highlight.getAttribute('fill')).toBe('#ffee0033');
      expect(highlight.getAttribute('stroke')).toBe('#ddcc0044');
    });
  });

  describe('component-to-component jumper wires', () => {
    it('renders a wire between different row-group pins', () => {
      const components = [resistor('r1'), led('led1')];
      const wires = [
        { from: 'arduino:pin13', to: 'component:r1:pin1' },
        { from: 'component:r1:pin2', to: 'component:led1:anode' },
        { from: 'component:led1:cathode', to: 'arduino:GND' },
      ];
      const layout = compute(components, wires);
      renderer.render(layout);

      // There should be a comp-to-comp jumper (r1:pin2 bot -> led1:anode top)
      const jumpers = container.querySelectorAll('.bb-jumper');
      // At least: GPIO jumper, GND rail jumper, comp-to-comp jumper
      expect(jumpers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('multiple components', () => {
    it('renders all component types in a mixed circuit', () => {
      const components = [
        resistor('r1'),
        led('led1'),
        pushButton('btn1'),
        rgbLed('rgb1'),
        ultrasonicSensor('us1'),
      ];
      const wires = [];
      const layout = compute(components, wires);
      renderer.render(layout);

      expect(container.querySelector('.bb-resistor')).not.toBeNull();
      expect(container.querySelector('.bb-led')).not.toBeNull();
      expect(container.querySelector('.bb-push-button')).not.toBeNull();
      expect(container.querySelector('.bb-rgb-led')).not.toBeNull();
      expect(container.querySelector('.bb-ultrasonic')).not.toBeNull();
    });
  });

  describe('overlay layer structure', () => {
    it('overlay has four sub-layers: highlights, wires, arches, components', () => {
      const layout = compute([resistor('r1')], []);
      renderer.render(layout);
      const overlay = container.querySelector('.bb-overlay');
      const children = overlay.children;
      expect(children.length).toBe(4);
      expect(children[0].getAttribute('class')).toBe('bb-highlights');
      expect(children[1].getAttribute('class')).toBe('bb-wires');
      expect(children[2].getAttribute('class')).toBe('bb-arches');
      expect(children[3].getAttribute('class')).toBe('bb-components');
    });
  });
});
