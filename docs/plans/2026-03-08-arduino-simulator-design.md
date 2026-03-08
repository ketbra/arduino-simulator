# Arduino Simulator - Design Document

## Purpose

A web-based Arduino simulator for 4th/5th grade classroom use. Students build virtual circuits on a breadboard, write Arduino-like code in JavaScript, and see simulated results in the browser. Serves as both a classroom supplement (when hardware is limited) and a take-home tool for continued exploration.

## Context

Built to support AMD STEM volunteer sessions at Wellan Montessori School. The classroom projects progress from simple LED circuits to a capstone project combining an ultrasonic distance sensor with an RGB LED.

## Architecture

Three main UI panels:
1. **Code Editor** (left, ~40% width) - Syntax-highlighted editor with Arduino IDE dark theme
2. **Circuit Workspace** (right, ~60% width) - Breadboard + Arduino board visualization
3. **Serial Monitor** (below editor) - Shows Serial.print output

Top toolbar: Logo, Load Example dropdown, Schematic/Breadboard mode toggle, Run/Stop buttons.

## Circuit Workspace

### Two Modes

- **Schematic mode**: Simplified drag-and-connect interface. Component blocks connect to labeled Arduino pins via click-to-wire. Lower friction for beginners.
- **Breadboard mode**: Realistic breadboard with proper row/column electrical connectivity. Components placed into specific holes. When switching from Schematic to Breadboard mode, an auto-layout algorithm translates logical connections into physical breadboard placement.

### Rendering

SVG-based rendering for crisp visuals, clickable/draggable components, hover states, and tooltips.

## Components

| Component | Pins/Behavior | Visual |
|-----------|--------------|--------|
| LED (single color) | 2 pins (anode/cathode), polarity-sensitive | Red circle, glows when active |
| RGB LED (common anode) | 4 pins (common +, R, G, B), color via PWM. LOW=bright, HIGH=off | Circle renders blended color |
| Resistor (220 ohm) | 2 pins, pass-through, validates presence | Colored-band rectangle |
| Push button | 4 pins (2-pole), clickable toggle | Clickable square, depresses visually |
| HC-SR04 ultrasonic | 4 pins (Vcc, Trig, Echo, GND), distance from slider | Blue rectangle with transducer circles |
| Jumper wires | Click source then destination to create | Colored lines with routing |

### Circuit Validation

- Runs on clicking "Run" button
- Checks pin connectivity, power-to-ground paths, resistor presence
- **Missing resistor = smoke/spark animation, LED burns out visually** (memorable teaching moment)
- Warning icons for unconnected required pins
- Clear error messages in Serial Monitor

### Common Anode Gotcha

The RGB LED is common-anode: writing LOW makes it bright, HIGH makes it off. This is faithfully simulated to reproduce the "design caveat" discovery from the classroom.

## Code Editor & Execution Engine

### Editor

- CodeMirror 6 with dark theme
- Line numbers, auto-indent
- Inline error messages

### Transpiler Pipeline

Extensible array of transform functions. Initial transforms:
- `void setup()` / `void loop()` / `void name()` -> `function setup()` / `function loop()` / `function name()`
- `int x = 5` / `float x = 5.0` -> `let x = 5` / `let x = 5.0`
- `#define NAME value` -> `const NAME = value`

### Arduino API Compatibility Layer

```
pinMode(pin, INPUT/OUTPUT)
digitalWrite(pin, HIGH/LOW)
digitalRead(pin)
analogWrite(pin, value)        // PWM 0-255
pulseIn(pin, value, timeout)   // returns simulated timing from distance slider
delay(ms)
delayMicroseconds(us)
Serial.begin(baud)
Serial.print(value)
Serial.println(value)
random(max) / random(min, max)
constrain(value, min, max)
map(value, fromLow, fromHigh, toLow, toHigh)
```

### Execution Model

- `setup()` runs once on clicking Run
- `loop()` runs repeatedly via setTimeout
- `delay()` converted to async/await pauses (non-blocking)
- Stop button halts execution and resets component states
- Pin state changes trigger immediate visual updates

## Ultrasonic Sensor Simulation

A slider control labeled "Object Distance" (0-200cm). The simulated `pulseIn` returns timing values derived from the slider position using the formula: `time = distance * 2 / 340 * 10000` (matching real HC-SR04 physics).

## Sample Projects

1. **LED Blink** - Pin 13 -> resistor -> LED -> GND. digitalWrite HIGH/LOW with delay.
2. **Button-Controlled LED** - 5V -> resistor -> button -> LED -> GND. Pre-loaded code (power supply only).
3. **RGB LED Multicolor** - Pins 9/10/11 -> resistors -> RGB LED (common anode to 5V). analogWrite with random colors.
4. **Ultrasonic Distance-to-Color** (capstone) - HC-SR04 (pins 11/12) + RGB LED (pins 3/5/6). Maps distance ranges to colors.

Each preset loads both circuit and code. A "Blank Project" option is also available.

## Visual Style

- Code editor: Dark theme matching Arduino IDE aesthetic
- Circuit workspace: Clean light background with good contrast and clear labels
- Active components: Subtle glow effect when powered
- Professional but approachable - kids feel like "real engineers"

## Tech Stack

- **Build tool**: Vite
- **Editor**: CodeMirror 6
- **Framework**: None (vanilla JS + DOM)
- **Circuit rendering**: SVG
- **Testing**: Playwright for UI testing

### File Structure

```
src/
  main.js              - App entry, layout setup
  editor/              - Code editor, transpiler
  simulator/           - Arduino API layer, execution engine
  circuit/
    breadboard.js      - Breadboard model (row/column connectivity)
    components/        - One file per component (led.js, rgb-led.js, etc.)
    wiring.js          - Wire creation, routing, validation
    renderer.js        - SVG rendering for circuit workspace
  projects/            - Sample project definitions (circuit + code)
  ui/                  - Toolbar, panels, slider, modals
```

### Build Targets

- `npm run dev` - Local dev server with hot reload
- `npm run build` - Static files for hosting (GitHub Pages, etc.)
- `npm run bundle` - Single HTML file for offline/USB distribution

## Key Design Decisions

1. **Progressive fidelity** (Schematic -> Breadboard with auto-layout) balances accessibility with realism
2. **JavaScript dialect** rather than C interpretation keeps implementation simple while looking nearly identical to real Arduino code
3. **SVG over Canvas** for circuit rendering enables easy click/drag interaction
4. **No framework** keeps bundle tiny and avoids unnecessary complexity
5. **Smoke animation for missing resistors** makes circuit validation memorable and fun
6. **Faithful common-anode simulation** preserves the classroom's key teaching moment
