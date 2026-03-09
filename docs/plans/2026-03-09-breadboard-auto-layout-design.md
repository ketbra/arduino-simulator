# Breadboard Auto-Layout View Design

**Goal:** Add a read-only breadboard view that auto-lays out schematic components onto a realistic breadboard, teaching students how physical breadboard wiring works.

**Architecture:** When the user clicks "Breadboard", a layout engine traces the connection graph and places components onto breadboard rows/columns with signal-flow ordering. No editing is allowed in breadboard view — users switch back to Schematic to make changes.

---

## Breadboard Model

Internal connectivity:
- Rows a-e in the same column are connected (top half)
- Rows f-j in the same column are connected (bottom half)
- Power rail + holes are all connected horizontally
- Power rail - holes are all connected horizontally
- Center gap separates the two halves

## Auto-Layout Algorithm (signal-flow based)

1. **Trace circuits from Arduino pins** — BFS from each used Arduino pin through the connection graph, building ordered component chains (e.g., pin13 → resistor → LED → GND)
2. **Assign columns** — Each chain gets a starting column. Components within a chain are placed at successive columns with spacing.
3. **Place components straddling the gap** — Component leg 1 goes in row e, leg 2 in row f (same column). This connects them to both halves.
4. **Multi-pin components** (RGB LED, HC-SR04, push button) span multiple adjacent columns.
5. **Connect to power rails** — GND connections get a wire from the component's row down to the - rail. 5V/3.3V connections get a wire to the + rail.
6. **Arduino jumper wires** — Wires from Arduino header pins down to the breadboard rows where components are placed.
7. **Shared rows = no wire needed** — When two component legs are in the same row-group, no wire is drawn — the breadboard connection is implicit.

## Visual Feedback

- **Active row highlighting** — When a component leg occupies a hole, subtly highlight all 5 holes in that row-group (a-e or f-j) to show internal connections.
- **Component rendering** — Simplified representations showing legs going into specific holes, with labels.
- **Wire colors** — Match schematic wire colors for consistency.

## Scope Boundaries

- No drag/drop in breadboard view
- No wire editing in breadboard view
- No breadboard-specific connection graph (reuse schematic graph, visualize differently)
- Layout is regenerated each time you switch to breadboard view
