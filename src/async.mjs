export function scheduleIdle(fn) {
  if (typeof setImmediate !== 'undefined') setImmediate(fn);
  else setTimeout(fn, 0);
}

export function yieldToEventLoop() {
  return new Promise((resolve) => scheduleIdle(resolve));
}

export function createGenerationToken() {
  let gen = 0;
  return {
    next() {
      gen += 1;
      return gen;
    },
    current() {
      return gen;
    },
    isCurrent(id) {
      return id === gen;
    },
  };
}
