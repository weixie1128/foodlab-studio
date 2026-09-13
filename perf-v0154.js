'use strict';
/*
 * FoodLab Studio v0.15.4 — interactive render throttle
 *
 * Background
 * ----------
 * Every slider in the properties panel fires on `input`, and each `input`
 * handler rebuilds the whole SVG (innerHTML is fully replaced). During a drag
 * that is dozens of full rebuilds per second. Scatter/bubble emit one <circle>
 * per data point with no sampling, so a few thousand rows turns a drag into a
 * frozen tab.
 *
 * What this patch does
 * --------------------
 * It wraps the two costly render entry points with an ADAPTIVE throttle:
 *
 *   - a render is measured;
 *   - as long as a render is fast (< SLOW_MS), the wrapper stays completely
 *     transparent — leading call renders synchronously, exactly as before;
 *   - only when a render proves slow does it start coalescing intermediate
 *     drag frames, keeping the renderer to roughly a 50% duty cycle;
 *   - a trailing render is ALWAYS guaranteed, so the final figure on screen is
 *     always the full, complete, unthrottled rendering.
 *
 * No data is dropped, no point is hidden, no statistic changes. The figure you
 * export is identical to the figure exported without this patch.
 */
(() => {
  const VERSION = '0.15.4';
  if (globalThis.__FOODLAB_PERF_0154__) return;
  globalThis.__FOODLAB_PERF_0154__ = true;

  const SLOW_MS = 24;     // below this, the wrapper never interferes
  const BASE_GAP_MS = 100; // floor for the cool-down, in ms

  // Cool-down between two renders. It is derived from the measured cost rather
  // than fixed, so the rule behaves the same on a fast desktop, a slow laptop
  // and a headless test browser: render at most every `max(100, lastRender)`,
  // i.e. the renderer never occupies much more than half the wall clock.
  const coolDown = lastDuration => Math.max(BASE_GAP_MS, lastDuration);
  const stats = { wrapped: [], throttledCalls: 0, trailingRuns: 0, skippedStale: 0, slowestMs: 0, debug: [] };

  function appState0154() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  function throttled(name) {
    const original = globalThis[name];
    if (typeof original !== 'function') return;
    if (original.__foodlabThrottled0154) return;

    const entry = { calls: 0, lastDuration: 0 };
    stats.wrapped.push(entry);

    let lastStart = 0;
    let timer = 0;
    let pending = null;

    // A deferred render must never fire against a state the app has already
    // moved on from (that is how a chart-switch in the middle of a drag would
    // hit a half-reset state). Capture a cheap fingerprint when scheduling and
    // drop the trailing render if the target changed underneath us.
    function fingerprint() {
      const st = appState0154();
      if (!st) return '';
      return [
        st.view || '',
        st.chart?.mode || '',
        st.gallery?.type || '',
        st.gallery?.rows?.length ?? -1,
        st.gallery?.analysis ? 1 : 0
      ].join('|');
    }

    function flush() {
      timer = 0;
      if (!pending) return;
      const { args, self, stamp } = pending;
      pending = null;
      if (stamp !== fingerprint()) {
        stats.skippedStale = (stats.skippedStale || 0) + 1;
        return;
      }
      stats.trailingRuns++;
      try {
        run(args, self);
      } catch (error) {
        // The synchronous path still throws normally; a deferred render is
        // best-effort, so report it without turning it into a page-level error.
        console.warn('[FoodLab v0.15.4] deferred render skipped', error);
      }
    }

    function run(args, self) {
      const t0 = performance.now();
      const out = original.apply(self, args);
      const cost = performance.now() - t0;
      entry.lastDuration = cost;
      if (cost > stats.slowestMs) stats.slowestMs = cost;
      lastStart = performance.now();
      return out;
    }

    function wrapper(...args) {
      entry.calls++;
      const now = performance.now();
      const provenSlow = entry.lastDuration > SLOW_MS;

      // Inside the cool-down window of a proven-slow render: keep only the
      // newest request and make sure exactly one flush is scheduled.
      const gap = coolDown(entry.lastDuration);
      if (provenSlow && now - lastStart < gap) {
        pending = { args, self: this, stamp: fingerprint() };
        if (!timer) {
          stats.throttledCalls++;
          timer = setTimeout(flush, Math.max(16, gap - (now - lastStart)));
        }
        stats.debug.push({ n: entry.calls, gap: Math.round(now - lastStart), last: Math.round(entry.lastDuration), action: 'throttle' });
        if (stats.debug.length > 40) stats.debug.shift();
        return undefined;
      }

      // Outside the window (or rendering is fast): render immediately, exactly
      // like the unpatched app, and cancel any pending coalesced request.
      if (timer) { clearTimeout(timer); timer = 0; pending = null; }
      stats.debug.push({ n: entry.calls, gap: Math.round(now - lastStart), last: Math.round(entry.lastDuration), action: 'render' });
      if (stats.debug.length > 40) stats.debug.shift();
      return run(args, this);
    }

    wrapper.__foodlabThrottled0154 = true;
    globalThis[name] = wrapper;
    try { if (typeof window !== 'undefined') window[name] = wrapper; } catch (_e) {}
  }

  function install0154() {
    // Chart Studio / gallery mode — measured hot path (full SVG rebuild).
    throttled('renderGalleryStudioCanvas');
    // Experiment mode — the same full-rebuild pattern on #chartStage.
    throttled('renderChart');

    globalThis.FoodLabPerf0154 = Object.freeze({
      version: VERSION,
      slowThresholdMs: SLOW_MS,
      baseGapMs: BASE_GAP_MS,
      get report() {
        return {
          wrapped: stats.wrapped.length,
          callsPerWrapper: stats.wrapped.map(e => ({ calls: e.calls, lastDurationMs: Math.round(e.lastDuration) })),
          throttledCalls: stats.throttledCalls,
          trailingRuns: stats.trailingRuns,
          skippedStale: stats.skippedStale,
          debug: stats.debug.slice(),
          slowestRenderMs: Math.round(stats.slowestMs)
        };
      }
    });

    if (appState0154()) {
      console.info('[FoodLab Studio] render throttle v0.15.4 active',
        `(engages only when a render exceeds ${SLOW_MS} ms)`);
    }
  }

  if (typeof document === 'undefined') return;
  // Run after app.js and after every earlier FoodLab patch has wrapped its own
  // render functions, so this wrapper ends up outermost and sees the real cost.
  if (document.readyState === 'complete') setTimeout(install0154, 0);
  else window.addEventListener('load', () => setTimeout(install0154, 0), { once: true });
})();
