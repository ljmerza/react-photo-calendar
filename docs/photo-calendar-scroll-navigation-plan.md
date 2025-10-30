# Photo Calendar Scroll Navigation Plan

## Goal
- Replace header-based prev/next navigation with a vertically scrollable timeline that continuously loads previous and next months, mirroring the Tinybeans experience.
- Maintain keyboard, screen reader, and touch accessibility while keeping the existing headless primitives composable.
- Deliver a migration path that preserves the current button controls as an opt-in fallback for teams not ready to adopt the scroller.

## Motivation
- Button controls impose a discrete navigation flow; users cannot skim multiple months or compare photos across months quickly.
- Mobile users expect inertial scrolling; the current controls feel dated compared with native timeline-style apps.
- Prefetching adjacent months enables faster perceived loading and aligns with the product vision of effortless journaling through time.

## Target Experience
- **Continuous vertical scroll**: Users drag/scroll up or down to reveal earlier/later months; prioritize smooth native scrolling on mobile without supplemental animations.
- **Month anchors**: Each month section snaps to a comfortable offset with a sticky header showing month + year that updates as the user scrolls.
- **Infinite timeline illusion**: The scroller should recycle DOM nodes and hydrate data so users rarely hit hard stops, but retain guardrails for `minDate`/`maxDate`.
- **Programmatic sync**: Calling `goToToday` or selecting a date should scroll the viewport to the relevant month using native browser behavior.
- **Graceful fallback**: When virtualization is unavailable (SSR without `IntersectionObserver`, print view, etc.), render a limited number of months with warning styles.
- **Mobile-first**: This timeline is scoped to mobile contexts; desktop consumers can continue using the existing control-based navigation.

## Experience Requirements
- **Performance**: Maintain 60fps scrolling on mid-range mobile devices; limit simultaneous rendered months (e.g., render 3–5 ahead/behind).
- **Accessibility**:
  - Ensure month sections remain reachable via keyboard (focus sentinels, roving tab index).
  - Preserve ARIA semantics on day buttons and announce month changes as the sticky header updates.
  - Provide skip links or keyboard shortcuts to jump to previous/next month for users who cannot scroll.
- **Responsive behavior**: Optimize sticky headers for mobile screen sizes while ensuring the scroll container continues to behave inside constrained-height parents.
- **Localization**: Continue using `monthNames` and locale formatting; support right-to-left layouts by mirroring scroll indicators and ensuring horizontal content is unaffected.

## Technical Approach
1. **Container + layout**
   - Introduce `PhotoCalendarScrollView` wrapping the month grid list inside a scrollable container (`overflow-y: auto; height: 100%`).
   - Implement sticky month headers using `position: sticky; top: 0` within each month section; expose render prop to customize the header.
2. **Virtualization strategy**
   - Maintain an ordered list of month descriptors (`{ year, monthNumber, key }`) derived from `usePhotoCalendarState`.
   - Use sentinels (e.g., `IntersectionObserver`) near the top/bottom to trigger addition of previous/next month descriptors.
   - Recycle months by keeping a window (e.g., ±6 months around the visible index); remove DOM nodes outside the window while retaining cached data in state.
   - Derive the active month from scroll position so the sticky header updates immediately when users reverse direction.
   - Consider leveraging an existing hook (`useVirtualizer` from TanStack Virtual) if bundle impact is acceptable; otherwise implement a lightweight index-based virtualizer tailored to the calendar.
3. **State integration**
   - Extend `usePhotoCalendarState` to expose utilities for month list navigation (`getAdjacentMonth`, `clampToBounds`) and an event for `onVisibleMonthChange`.
   - Keep `currentMonth`/`currentYear` as the authoritative state; scrolling updates these values when the leading month changes, allowing existing day grid logic to remain intact.
   - Expose a `scroll` helper object (snapshots, month adjacency, bounds checks, state sync) through context so advanced consumers can coordinate prefetching and analytics without imperative refs.
4. **Data hydration**
   - Prefetch photo data for months within the render window by reusing existing data loaders, ensuring requests remain cancellable when months exit the window.
   - Expose hooks/callbacks (`onMonthRangeVisible`) so consumers can eagerly fetch assets beyond the immediate window if desired.
5. **Scroll behavior**
   - Rely on native browser scrolling without custom animation layers for v1; keep hooks available for future enhancement.
   - Avoid layout thrash by reading and writing scroll positions within `requestAnimationFrame` loops when running any necessary scroll adjustments.
6. **Testing & monitoring**
   - Add interaction tests simulating wheel/keyboard navigation to assert `onVisibleMonthChange` updates and `goToToday` scroll behavior.
   - Instrument with optional console warnings (development) when virtualization window grows beyond thresholds, encouraging configuration tuning.

## Migration Plan
- Keep existing `PhotoCalendarNavigation` exports; mark them as legacy but supported.
- Introduce a top-level feature flag or prop (`navigationMode="scroll" | "controls"`) defaulting to `controls` for backward compatibility.
- Provide codemods/docs explaining how to replace `PhotoCalendarNavigation` usage with the new `PhotoCalendarScrollView` and sticky header render props.
- Update Storybook to include both modes side by side and document responsive behaviors.

## Risks & Mitigations
- **Scroll position drift**: Differences between virtualized month heights and actual grid heights could desync anchors. Mitigate by measuring rendered month height and updating cache after each render.
- **Large data sets**: Loading entire photo collections for many months at once can increase memory usage. Limit concurrent fetches and evict caches when months leave the window.
- **Browser support**: Sticky positioning and smooth scrolling have edge cases in older Android WebViews. Provide feature detection and degrade gracefully to non-sticky headers + manual focus controls.
- **Complexity creep**: A custom virtualizer adds maintenance burden. Evaluate third-party solutions before building bespoke logic; if custom, isolate in `useMonthVirtualizer` hook with thorough tests.

## Open Questions
- When should we revisit parallax or animation polish (e.g., fading month separators) to match Tinybeans once the core experience ships?
- How do we expose analytics hooks for scroll depth and month impressions without impacting performance?
- What are acceptable bundle size deltas if we add a virtualization dependency?

## Next Steps
1. Validate UX flows with design (sticky header styling, fallback states).
2. Spike a prototype in Storybook using static data to confirm virtualization approach and performance.
3. Extend `usePhotoCalendarState` with scroll-specific APIs and wire up the new `PhotoCalendarScrollView`.
4. Update documentation/examples, including migration guidance and accessibility notes.
5. Schedule a beta flag release with analytics instrumentation to monitor adoption before making scroll the default.
