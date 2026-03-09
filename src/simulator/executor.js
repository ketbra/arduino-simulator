export function createExecutor(runtime) {
  let setupFn = null;
  let loopFn = null;
  let running = false;
  let loopTimeoutId = null;
  let onLineChange = null;
  let stepping = false;
  let stepResolve = null;
  let compiled = false;

  function buildGlobals() {
    const api = runtime.api;
    return {
      HIGH: api.HIGH, LOW: api.LOW, OUTPUT: api.OUTPUT, INPUT: api.INPUT,
      pinMode: api.pinMode, digitalWrite: api.digitalWrite, digitalRead: api.digitalRead,
      analogWrite: api.analogWrite, pulseIn: api.pulseIn,
      delay: api.delay, delayMicroseconds: api.delayMicroseconds,
      Serial: api.Serial,
      random: api.random, constrain: api.constrain, map: api.map,
      __reportLine: (n) => {
        if (onLineChange) onLineChange(n);
        if (stepping) {
          return new Promise((resolve) => { stepResolve = resolve; });
        }
      },
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
    const result = compileCode(code);
    setupFn = result.setup;
    loopFn = result.loop;
    compiled = true;

    if (setupFn) {
      await setupFn();
    }
    running = true;
  }

  async function runLoopIterations(count) {
    if (!loopFn) return;
    for (let i = 0; i < count && running; i++) {
      await loopFn();
    }
  }

  function startLoop(intervalMs = 10) {
    if (!loopFn) return;
    running = true;
    stepping = false;

    async function tick() {
      if (!running) return;
      try {
        await loopFn();
        if (running) {
          loopTimeoutId = setTimeout(tick, intervalMs);
        }
      } catch (e) {
        running = false;
        runtime.api.Serial.println(`Runtime error: ${e.message}`);
      }
    }

    tick();
  }

  function startStepping() {
    if (!loopFn) return;
    running = true;
    stepping = true;

    async function stepLoop() {
      while (running && stepping) {
        try {
          await loopFn();
        } catch (e) {
          running = false;
          runtime.api.Serial.println(`Runtime error: ${e.message}`);
          return;
        }
      }
    }

    stepLoop();
  }

  function step() {
    if (stepResolve) {
      const resolve = stepResolve;
      stepResolve = null;
      resolve();
    }
  }

  function stop() {
    running = false;
    stepping = false;
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId);
      loopTimeoutId = null;
    }
    // Unblock any pending step
    if (stepResolve) {
      const resolve = stepResolve;
      stepResolve = null;
      resolve();
    }
  }

  function isRunning() {
    return running;
  }

  function isStepping() {
    return stepping;
  }

  function isCompiled() {
    return compiled;
  }

  function setLineCallback(cb) {
    onLineChange = cb;
  }

  return {
    loadAndRunSetup, runLoopIterations, startLoop, startStepping, step,
    stop, isRunning, isStepping, isCompiled, setLineCallback,
  };
}
