# Mobile Scroll Navigation Loop – Analysis

## Symptom
- Storybook’s mobile “scroll” navigation throws `Maximum update depth exceeded` with the stack pointing at `src/hooks/useCalendarActiveMonthTracking.ts:73`.
- The crash happens as soon as the scroll view tries to promote a new month into the active state.

## Moving Pieces
1. **`useCalendarActiveMonthTracking.evaluateActiveMonth`**  
   - Runs on every scroll frame.  
   - Detects the first month header pinned at the top of the container.  
   - When the active month changes it sets local `activeMonthKey` state *and* calls `scroll.syncVisibleMonth(nextActiveKey)` so that the calendar’s controlled month follows the scroll position.
2. **`scroll.syncVisibleMonth` (from `usePhotoCalendarState`)**  
   - Delegates to `commitMonthChange`, which updates the calendar’s month (either by calling `onMonthChange` or by mutating `internalMonthKey`).  
   - This triggers a rerender of the `<PhotoCalendarRoot>` context with the new `monthKey`.
3. **`useCalendarActiveMonthTracking` effect on `visibleMonthKey`**  
   - Runs after the context rerender.  
   - Ensures the new visible month is mounted (`ensureMonthInWindow`) and then tries to keep the DOM aligned by calling `scrollToMonthKey(visibleMonthKey)`, which invokes `element.scrollIntoView`.
4. **Scroll feedback**  
   - The `scrollIntoView` call fires another scroll event before the effect has a chance to reset the internal `lastScrollSyncRef` sentinel.  
   - `evaluateActiveMonth` runs again, sees the same `nextActiveKey`, and re-enters the `setActiveMonthKey`/`scroll.syncVisibleMonth` path.  
   - React detects this cascade of state updates inside the same commit cycle and throws the “maximum update depth” error.

## Why the Guard Rails Fail
- `lastScrollSyncRef` is set inside `evaluateActiveMonth` right before calling `scroll.syncVisibleMonth`.  
- The sentinel is only cleared inside the `useEffect` that reacts to `visibleMonthKey`.  
- Because `scrollIntoView` kicks off a new scroll event *before* the effect clears the sentinel, the second `evaluateActiveMonth` sees `lastScrollSyncRef` still populated but continues to set state (the ref check happens too late), resulting in an infinite loop.
- In dev, React Strict Mode can double‑invoke mount effects and add extra flushes, which magnifies timing windows where the loop can re‑enter. This is a contributing factor in Storybook.

## Fix Options

### 1. Single Source of Truth (Scroll Wins)
- Treat the scroll timeline as canonical when `navigationMode="scroll"`.  
- Remove the `scrollToMonthKey` call entirely and only surface the new month through `onVisibleMonthChange`.  
- External consumers who want to keep the month controlled would update `monthKey` in response and let the hook scroll naturally.  
- **Pros**: Simplest; no forced scroll, no feedback loop.  
- **Cons**: Controlled callers must provide their own scroll logic if they want the viewport to jump.

### 2. Track Update Origin Explicitly
- Introduce an enum ref (`'scroll' | 'external' | null`) instead of a single key.  
- When `evaluateActiveMonth` fires, set `updateOrigin.current = 'scroll'` before calling `syncVisibleMonth`.  
- The `visibleMonthKey` effect checks the origin:  
  - `'scroll'` → clear origin, **skip** `scrollToMonthKey`.  
  - `'external'` → perform `scrollToMonthKey`.  
- External navigation buttons set `updateOrigin.current = 'external'` before invoking `scroll.syncVisibleMonth`.  
- **Pros**: Keeps bi-directional sync but avoids reentrancy.  
- **Cons**: Slightly more bookkeeping; still relies on scroll events but now deterministic.

Implementation sketch:

```ts
// in useCalendarActiveMonthTracking.ts
const originRef = useRef<null | 'scroll' | 'external'>(null);

const evaluateActiveMonth = useCallback(() => {
  // ... compute nextActiveKey
  if (nextActiveKey !== activeMonthKeyRef.current) {
    activeMonthKeyRef.current = nextActiveKey;
    setActiveMonthKey(nextActiveKey);
    originRef.current = 'scroll';
    scroll.syncVisibleMonth(nextActiveKey);
  }
}, [scroll]);

// when buttons/controls trigger navigation
function onExternalNavigate(nextKey: string) {
  originRef.current = 'external';
  scroll.syncVisibleMonth(nextKey);
}

useEffect(() => {
  ensureMonthInWindow(visibleMonthKey);
  const origin = originRef.current;
  if (origin === 'scroll') {
    // user scroll is authoritative; skip scrollIntoView
    originRef.current = null;
    return;
  }
  originRef.current = null; // external or unknown → perform scroll
  scrollToMonthKey(visibleMonthKey);
}, [visibleMonthKey]);
```

### 3. Defer `syncVisibleMonth`
- Inside `evaluateActiveMonth`, instead of calling `scroll.syncVisibleMonth` immediately, store the pending key in a ref and schedule the sync with `requestAnimationFrame` (or `queueMicrotask`).  
- The deferred callback runs after React finishes the current commit, so the effect can clear sentinel state before the next scroll fires.  
- **Pros**: Minimal refactor; keeps existing UX.  
- **Cons**: Adds a frame of latency; needs cancellation logic when the component unmounts.

Implementation sketch:

```ts
const rafIdRef = useRef<number | null>(null);

const scheduleSync = useCallback((key: string) => {
  if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
  rafIdRef.current = requestAnimationFrame(() => {
    rafIdRef.current = null;
    scroll.syncVisibleMonth(key);
  });
}, [scroll]);

// in evaluateActiveMonth
scheduleSync(nextActiveKey);

useEffect(() => () => {
  if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
}, []);
```

### 4. Use `IntersectionObserver` Instead of Scroll Events
- Replace the manual scroll listener with an observer watching the month headers.  
- When a header enters the top threshold, update `activeMonthKey` and call `syncVisibleMonth`.  
- Intersection callbacks are throttled by the browser and tend not to generate the rapid, back-to-back updates that happen with synchronous `scrollIntoView`.  
- **Pros**: Smoother, less manual math.  
- **Cons**: Larger refactor; needs polyfill for older browsers if required.

### 5. Layout-Effect Synchronisation
- Convert the `visibleMonthKey` effect to a `useLayoutEffect` so the sentinel is cleared before the browser paints and before the next scroll event dispatch.  
- Combine with the origin guard above to ensure we do not dispatch a second state change while still processing the first one.  
- **Pros**: Keeps behaviour intact, small change.  
- **Cons**: Layout effects run synchronously and might impact initial render time.

Implementation note:

```ts
// change useEffect → useLayoutEffect for the visibleMonthKey reaction only
useLayoutEffect(() => {
  // clear sentinel/origin first, then optionally scrollIntoView
}, [visibleMonthKey]);
```

### 6. Opt-Out Flag
- Provide a prop like `scrollAutoSync?: boolean` defaulting to `true`.  
- In Storybook (or other environments) set it to `false` to disable the `syncVisibleMonth` feedback path entirely.  
- **Pros**: Quick mitigation for environments where the loop is problematic.  
- **Cons**: Does not solve the underlying issue; just sidesteps it.

## Suggested Path Forward
1. Implement option **2 (Update Origin)** as the primary fix—it keeps both navigation methods working and makes the state machine explicit.  
2. If extra smoothing is needed, optionally layer on option **3** (defer sync) to remove any residual timing hazards.  
3. Document the new origin guard so future changes to the scroll pipeline stay aware of the feedback loop risk.

## Edge Cases To Consider
- `ensureMonthInWindow` can mount new sections and change layout; prefer calling it before any programmatic scroll and only once per key.
- For tiny scroll deltas around a header boundary, the active key may flip/flop; apply a small hysteresis threshold (e.g., require the next header to be at least N px into view).
- When programmatically scrolling, temporarily ignore `scroll` events (e.g., with an `isProgrammaticScrollRef` and a short timeout or until a `scrollend` event where supported) to avoid spurious re-evaluations.
- If using `IntersectionObserver`, set `rootMargin`/`threshold` to avoid rapid flicker.

## Test Plan
- Storybook manual: drag the timeline slowly and quickly; verify no console errors and that the header highlight and aria-current reflect the top month.
- Programmatic navigation: click next/prev month/year and ensure the scroller moves to the correct header without re-entering the loop.
- Controlled mode: set `monthKey` externally while the timeline is scrolled to the middle; confirm the viewport outcome matches the chosen policy (scroll wins vs external wins).
- JSDOM test: simulate a sequence of scrollTop values and assert we do not call `setState` more than once per animation frame.

## Known Unrelated Warning
- Storybook `favicon.svg` 404 on port 6007 is a static asset configuration issue; it is unrelated to the update‑depth loop.

## Trade-offs
- Origin guard adds minimal state but improves determinism.
- Deferred sync adds a frame of latency but smooths timing hazards.
- Layout effects can affect render timing; use judiciously.
- Removing `scrollToMonthKey` simplifies logic but shifts responsibility to consumers.
