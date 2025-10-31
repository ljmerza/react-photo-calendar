# Default Month Drift – Why It Can Show March 2025

## Symptom
- When mounting the calendar without an explicit `monthKey`/`defaultMonthKey`, the visible month sometimes appears as March 2025 instead of “today’s” month.

## How Initial Month Is Chosen
- `usePhotoCalendarState` computes the initial month from `defaultMonthKey` if provided; otherwise it derives “today’s month”.
- Code path:
  - `usePhotoCalendarState` → `formatMonthKey(parseMonthKey(defaultMonthKey))`.
  - `parseMonthKey(undefined)` returns the first day of the current month.
  - The month label and day grid are derived from this effective month.

## Why Drift Happens
There are several environment and configuration factors that can shift the initial month away from what you expect.

- Time source differences
  - If another part of your app (or test harness) mocks the global clock (e.g., `vi.setSystemTime`, `sinon.useFakeTimers`), then `new Date()` returns that mocked time. If it’s set to March 2025, the calendar will initialise there.
  - Some Storybook or test setups set a fixed “demo” date via global mocks.

- Local vs UTC month resolution
  - Prior to the latest change, the default path used UTC (`getUTCFullYear()/getUTCMonth()`), which could disagree with the user’s local month near month boundaries. We switched to local getters to reduce off‑by‑one issues.
  - The calendar formats labels with `Intl.DateTimeFormat` using `timeZone: 'UTC'` by default (for stable, cross‑client rendering). This can make labels look offset from local expectations, even when the underlying `monthKey` is correct.

- Bounds clamping in scroll mode
  - If `minMonthKey`/`maxMonthKey` are provided and the derived “today” lies outside these bounds, navigation clamps to the nearest allowed month.
  - In scroll mode, once the active month header changes, `scroll.syncVisibleMonth` updates the context. If bounds force a clamp, you can appear to “start” at the clamped month.

- SSR vs CSR timing
  - On SSR, the first render happens on the server (often with `TZ=UTC`). On hydration, the browser may have a different local zone. If “today” in UTC crosses a boundary vs local, you can see a one‑month discrepancy.
  - If an SSR framework injects a fixed build time into `Date`, that also affects the initial month.

- Programmatic alignment and measurement
  - The scroll timeline aligns the viewport to the visible month after refs mount. If measurement fails or is delayed (e.g., zero‑height container at first paint), the “active month” may be inferred from the first mounted section instead of scrolled into view.

## Quick Checks
- Confirm no global clock mocks are active:
  - Search for `setSystemTime`, `useFakeTimers`, or date shims in your app/test setup.
- Check bounds:
  - If `maxMonthKey` is `2025-03`, starting past that will clamp to March 2025.
- Verify time zone expectations:
  - By default, labels are formatted with `timeZone: 'UTC'`. If you want local labels, pass `timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}` or omit the prop and switch the library default.
- Log the derived key:
  - Temporarily add `onVisibleMonthChange={(k) => console.log('visible', k)}` to see which month the state believes is active on mount and after scroll alignment.

## Mitigations and Options
- Provide a deterministic initial month
  - Pass `defaultMonthKey` explicitly (e.g., from your own “now” provider) to avoid relying on the ambient environment.

- Control the notion of “now”
  - Consider a `nowProvider?: () => Date` option (proposed enhancement) to make the source of truth explicit for apps and tests.

- Align time zones
  - If your UX expects local labels, pass `timeZone` explicitly to the calendar. Example: `timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}`.

- Guard against clamp surprises
  - If you set `minMonthKey`/`maxMonthKey`, make sure your intended start month is within bounds; otherwise the first interaction will snap to a bound.

- Improve initial alignment robustness (scroll mode)
  - We already defer intersection observers and use a multi‑frame alignment attempt. If you still see misalignment, verify the scroll container has a stable height before mount.

## Proposed Follow‑ups
- Add `nowProvider` to `usePhotoCalendarState`/`PhotoCalendar`.
- Default `timeZone` to the browser’s zone instead of `'UTC'` (breaking change risk; document clearly).
- Add a development warning when the derived start month is outside configured bounds.
- Expose a prop to disable automatic scroll alignment for apps that want to handle it themselves.

## Summary
“March 2025” is a symptom of the environment’s definition of “today” (mocks, SSR, or time zone) or of bounds clamping overriding the initial month. Supplying `defaultMonthKey`, aligning `timeZone`, or injecting a `nowProvider` removes ambiguity and ensures consistent initialisation across environments.

