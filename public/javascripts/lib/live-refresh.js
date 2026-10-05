// The 30-second refresh that the traveler and NCR pages share (spec 125,
// User Stories 5 and 6). Written once so both pages pause, resume and skip
// ticks the same way.
//
// - The callback runs every interval.
// - A tick is skipped while the previous call is still in flight, so a slow
//   response never stacks requests.
// - A failed call is swallowed here: the caller keeps the state it last showed,
//   and the next tick tries again (FR-029). Errors are not shown per attempt.
// - The timer stops while the tab is hidden and runs once, straight away, when
//   the tab is shown again (FR-030).
// - The returned function stops the refresh for good.

export const LIVE_REFRESH_INTERVAL_MS = 30000;

export function startLiveRefresh(callback, { intervalMs = LIVE_REFRESH_INTERVAL_MS } = {}) {
  let timer = null;
  let inFlight = false;
  let stopped = false;

  function tick() {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    Promise.resolve()
      .then(() => callback())
      .catch(() => {
        // keep the last state; the next tick retries
      })
      .then(() => {
        inFlight = false;
      });
  }

  function start() {
    if (timer === null && !stopped) {
      timer = setInterval(tick, intervalMs);
    }
  }

  function pause() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function onVisibilityChange() {
    if (stopped) {
      return;
    }
    if (document.hidden) {
      pause();
    } else {
      tick();
      start();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  if (!document.hidden) {
    start();
  }

  return function stop() {
    stopped = true;
    pause();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
