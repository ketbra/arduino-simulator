export function createSerialMonitor(outputElement) {
  function append(text) {
    outputElement.textContent += text;
    outputElement.scrollTop = outputElement.scrollHeight;
  }

  function clear() {
    outputElement.textContent = '';
  }

  return { append, clear };
}
