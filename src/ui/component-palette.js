const PALETTE_ITEMS = [
  { type: 'led', label: 'LED', color: '#cc3333' },
  { type: 'rgb-led', label: 'RGB LED', color: '#9933cc' },
  { type: 'resistor', label: '220\u03A9', color: '#b8956a' },
  { type: 'push-button', label: 'Button', color: '#666' },
  { type: 'ultrasonic-sensor', label: 'HC-SR04', color: '#2277bb' },
];

export function createComponentPalette(containerElement, onAddComponent) {
  let nextId = 1;

  PALETTE_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'palette-item';
    btn.textContent = item.label;
    btn.style.cssText = `
      padding: 4px 10px; border-radius: 4px; border: 1px solid #aaa;
      background: ${item.color}22; color: #333; cursor: pointer; font-size: 12px;
      transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = `${item.color}44`; });
    btn.addEventListener('mouseleave', () => { btn.style.background = `${item.color}22`; });
    btn.addEventListener('click', () => {
      const id = `${item.type}-${nextId++}`;
      onAddComponent(item.type, id, 400 + Math.random() * 50, 350 + Math.random() * 50);
    });
    containerElement.appendChild(btn);
  });
}
