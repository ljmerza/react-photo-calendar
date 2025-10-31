# Virtualized Centered Activation – Alternatives To Stabilize Scrolling

## TL;DR
- Yes: use a dedicated scroll container, not the document viewport. But the lasting fix is to replace sentinel-based prepend with a deterministic, height-aware virtualizer that uses top/bottom spacers and an anchor index. This removes the cascade when new months mount.

## Problems Observed
- Prepending older months changes `scrollHeight` and `scrollTop`, keeping the top sentinel intersecting and repeatedly extending.
- IntersectionObserver near the top is sensitive to tiny geometry changes (images loading, rounding, scroll compensation).
- Centered activation + IO triggers can interleave in unlucky orders, producing jitters.

## Better Approaches

### Option A — Deterministic Height-Based Virtualizer (Recommended)
- Replace top/bottom sentinels with explicit virtualization using spacers:
  - Maintain an ordered list of month keys (bounded by `minMonthKey` and today).
  - Render a small window around a center index (e.g., 5–7 months).
  - Above the first rendered month, render a single top spacer with height equal to the sum of heights of all offscreen months above. Similarly for bottom spacer.
- Activation from center:
  - Compute `containerCenter = scrollTop + clientHeight / 2`.
  - Use prefix sums of month heights to find which month’s center is nearest to `containerCenter` (binary search in O(log n)).
  - Apply hysteresis to avoid flip‑flop.
- Month heights:
  - Estimate based on known structure (header + weekdays + 5 or 6 week rows).
  - Measure actual heights when a month mounts and cache them; adjust prefix sums.
  - When a measured height differs from estimate, adjust `scrollTop` to keep the anchored month centered (single compensation), no sentinel involved.
- Pros
  - No IO loops, no sentinel sensitivity; smooth prepend/append via spacer updates.
  - Precise center activation; easy to add overscan buffer.
- Cons
  - Slightly more code (prefix sums, compensation on remeasure).

### Option B — Adopt a Proven Virtualizer (TanStack Virtual)
- Use `@tanstack/virtual` with a dynamic-size vertical list and a custom item renderer for months.
- Leverage its scroll anchoring and measurement APIs; set the parent scroll element to our container.
- Pros
  - Battle-tested, handles dynamic heights and anchoring.
- Cons
  - New dependency and bundle cost (~3–6KB gzipped).

### Option C — Paged “Month Buckets”
- Render exactly one month centered, and page up/down by one month (no continuous loading while mid-scroll).
- Use scroll-snap mandatory to keep one item centered; fetch neighbors on page changes.
- Pros
  - Very stable; simplest.
- Cons
  - Loses inertial free scroll feel.

## Container vs Document Viewport
- Keep using a dedicated container (`overflow-y: auto; height: Npx`) as the IO/measurement root.
- Avoid doc-level viewport dependencies entirely.
- Add:
  - `contain: content;` or `contain: layout paint size;` on the scroll container for performance.
  - Consider `overflow-anchor: none;` if the browser’s auto-scroll anchoring fights our JS compensation.

## Implementation Plan (Option A)
1. Data model
   - Build `months[]` as continuous keys from `minMonthKey`..`todayKey` (lazy-expand when needed).
   - Keep `heights[]` and `prefixSums[]` (top cumulative heights), recompute when a height changes.
2. Virtualizer hook `useVirtualMonthList`
   - Inputs: `containerRef`, `months`, `getEstimatedHeight`, `overscan`.
   - Outputs:
     - `renderRange: { start, end }` around center index with overscan.
     - `topSpacerHeight`, `bottomSpacerHeight`.
     - `activeIndex`, `activeKey` (nearest to center with hysteresis).
     - `registerRef(key)` to measure and cache height on mount.
3. Rendering
   - Render top spacer, mapped months in `renderRange`, bottom spacer.
   - No top/bottom sentinels.
4. Centered activation
   - On scroll (rAF), compute center position, derive `activeIndex` via binary search in `prefixSums`.
   - Emit `onVisibleMonthChange` when active key changes.
5. Programmatic navigation
   - Compute the `targetIndex` and desired `scrollTop` so the month center aligns with container center using `prefixSums` + measured height; set `scrollTop` (smooth).
6. Image/layout remeasure
   - On month mount or image load, update `heights[index]`, recompute `prefixSums`, and adjust `scrollTop` to keep the active index centered.
7. Virtual window bounds
   - Limit render window size (e.g., 5–7 months) via `renderRange` while letting top/bottom spacers represent the rest.

## Additional Ideas
- Overscan buffer: render ±1 month beyond visible to avoid pop-in while fast scrolling.
- Debounced activation: commit active month on `scrollend` (or 100–150ms idle) to reduce churn.
- Keyboard support: Up/Down to move one month; PageUp/PageDown to jump ±3 months, always centered.
- Prefetch policy: Preload images for `activeIndex`, `activeIndex±1`.

## Migration Notes
- Remove IntersectionObservers and the extend-window logic; the virtualizer controls the render window directly.
- Keep the “no future months” rule by capping `months[]` at today.
- Maintain existing props (`scrollMaxRenderedMonths`) as the max window size; add `overscan` and `activationHysteresisPx`.

## Next Steps
1. Prototype `useVirtualMonthList` in a Storybook sandbox with static estimated heights.
2. Add measurement + scroll compensation for dynamic heights.
3. Swap `PhotoCalendarScrollView` to use the new hook; remove IO sentinels.
4. Add tests: center-finding, remeasure compensation, and window reduction invariants.
5. Tune hysteresis/overscan for mobile.
