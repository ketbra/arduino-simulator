export function createArduinoRuntime() {
  const pinModes = {};
  const pinStates = {};
  const externalPinStates = {};
  let serialOutput = '';
  let sensorDistance = 100;
  const listeners = { pinChange: [], serialData: [] };

  function on(event, callback) {
    if (listeners[event]) listeners[event].push(callback);
  }

  function notifyPinChange(pin, value) {
    listeners.pinChange.forEach((cb) => cb(pin, value, pinModes[pin]));
  }

  function notifySerialData(text) {
    listeners.serialData.forEach((cb) => cb(text));
  }

  const HIGH = 1;
  const LOW = 0;
  const OUTPUT = 'OUTPUT';
  const INPUT = 'INPUT';

  const api = {
    HIGH, LOW, OUTPUT, INPUT,

    pinMode(pin, mode) {
      pinModes[pin] = mode;
      pinStates[pin] = 0;
    },

    digitalWrite(pin, value) {
      pinStates[pin] = value;
      notifyPinChange(pin, value);
    },

    digitalRead(pin) {
      if (externalPinStates[pin] !== undefined) return externalPinStates[pin];
      return pinStates[pin] || 0;
    },

    analogWrite(pin, value) {
      pinStates[pin] = value;
      notifyPinChange(pin, value);
    },

    pulseIn(pin, value, timeout) {
      const timing = (sensorDistance * 2 * 10000) / 340;
      return timing;
    },

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    delayMicroseconds(us) {
      return new Promise((resolve) => setTimeout(resolve, Math.max(1, us / 1000)));
    },

    Serial: {
      begin(baud) {},
      print(value) {
        const text = String(value);
        serialOutput += text;
        notifySerialData(text);
      },
      println(value) {
        const text = String(value) + '\n';
        serialOutput += text;
        notifySerialData(text);
      },
    },

    random(minOrMax, max) {
      if (max === undefined) {
        return Math.floor(Math.random() * minOrMax);
      }
      return Math.floor(Math.random() * (max - minOrMax)) + minOrMax;
    },

    constrain(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    map(value, fromLow, fromHigh, toLow, toHigh) {
      return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    },
  };

  return {
    api,
    on,
    getPinMode: (pin) => pinModes[pin],
    getPinState: (pin) => pinStates[pin],
    setExternalPinState: (pin, value) => { externalPinStates[pin] = value; },
    getSerialOutput: () => serialOutput,
    setSensorDistance: (d) => { sensorDistance = d; },
    emit(event, ...args) { if (listeners[event]) listeners[event].forEach((cb) => cb(...args)); },
    reset() {
      Object.keys(pinModes).forEach((k) => delete pinModes[k]);
      Object.keys(pinStates).forEach((k) => delete pinStates[k]);
      Object.keys(externalPinStates).forEach((k) => delete externalPinStates[k]);
      serialOutput = '';
      listeners.pinChange = [];
      listeners.serialData = [];
    },
  };
}
