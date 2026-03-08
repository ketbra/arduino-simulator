export function createExecutor(runtime) {
  let setupFn = null;
  let loopFn = null;
  let running = false;
  let loopTimeoutId = null;

  function buildGlobals() {
    const api = runtime.api;
    return {
      HIGH: api.HIGH, LOW: api.LOW, OUTPUT: api.OUTPUT, INPUT: api.INPUT,
      pinMode: api.pinMode, digitalWrite: api.digitalWrite, digitalRead: api.digitalRead,
      analogWrite: api.analogWrite, pulseIn: api.pulseIn,
      delay: api.delay, delayMicroseconds: api.delayMicroseconds,
      Serial: api.Serial,
      random: api.random, constrain: api.constrain, map: api.map,
    };
  }

  function compileCode(code) {
    const globals = buildGlobals();
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    const wrappedCode = `
      ${code}
      return { setup: typeof setup === 'function' ? setup : null, loop: typeof loop === 'function' ? loop : null };
    `;

    try {
      const factory = new Function(...globalNames, wrappedCode);
      return factory(...globalValues);
    } catch (e) {
      throw new Error(`Compilation error: ${e.message}`);
    }
  }

  async function loadAndRunSetup(code) {
    const compiled = compileCode(code);
    setupFn = compiled.setup;
    loopFn = compiled.loop;

    if (setupFn) {
      setupFn();
    }
    running = true;
  }

  async function runLoopIterations(count) {
    if (!loopFn) return;
    for (let i = 0; i < count && running; i++) {
      loopFn();
    }
  }

  function startLoop(intervalMs = 10) {
    if (!loopFn) return;
    running = true;

    function tick() {
      if (!running) return;
      try {
        const result = loopFn();
        let nextDelay = intervalMs;
        if (result && result.__delay) {
          nextDelay = Math.max(1, result.__delay);
        }
        loopTimeoutId = setTimeout(tick, nextDelay);
      } catch (e) {
        running = false;
        runtime.api.Serial.println(`Runtime error: ${e.message}`);
      }
    }

    tick();
  }

  function stop() {
    running = false;
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId);
      loopTimeoutId = null;
    }
  }

  function isRunning() {
    return running;
  }

  return { loadAndRunSetup, runLoopIterations, startLoop, stop, isRunning };
}
