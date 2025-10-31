# Centered Activation Scroll Timeline – Plan

## Goal
- Remove sticky month headers from the scroll timeline.
- Exactly one month is “active” at a time — the month whose section is closest to the vertical center of the viewport.
- Center the current month on mount and on programmatic navigation (e.g., goToToday), and highlight its header without sticky positioning.
- Preserve virtualization: only render month grids when in or near viewport.

## UX Principles
- Soft snapping: Do not fight user scroll; use `scroll-snap-type: y proximity` to gently settle a month to center when scroll slows or ends.
- Clear focus: Visually elevate the active month (header emphasis, subtle scale/opacity or shadow on the month section), but avoid dramatic animations that cause jank.
- Predictable activation: As the user scrolls, the active month changes only when its center crosses a hysteresis band around the viewport center (prevents flip‑flop near boundaries).
- Respect bounds and “no future months”: Do not activate or extend beyond today or `maxMonthKey`.

## Interaction Model
- Initial mount: Scroll the effective month so its section center aligns with the container center; apply active styles to that section’s header.
- User scrolls: While scrolling freely, activation updates when a section’s center is nearest the container center and crosses a hysteresis threshold.
- Programmatic nav (e.g., today, prev/next): Smoothly scroll the target month to center and promote it as active; do not re-trigger feedback loops.
- Keyboard: Up/Down/PageUp/PageDown navigate between months (snap to center). Home/End jump to min/max within bounds.

## Accessibility
- Use `aria-current="date"` on the active month header; remove sticky semantics.
- Announce active month changes via a polite `aria-live` region (optional, dev‑tunable to reduce chatter).
- Keep day buttons accessible; focus remains within the visible month. When months change, avoid stealing focus unless navigation was programmatic.
- Add skip links or shortcuts to jump month-by-month for non-mouse users.

## Visual Design Hints
- Header: Non-sticky; larger weight and accent color for active. Muted for inactive.
- Section: Optional subtle elevation (shadow or scale 0.98→1.0 for active) with 120–160ms ease transitions.
- Center aid: A faint horizontal guide at container center (debug only) can help tune thresholds; keep it off by default.

## Technical Approach
1. Remove sticky headers
   - CSS: Drop `position: sticky; top: 0` from `.calendar-month-header`. Add active/inactive styles only.
   - Ensure container padding no longer reserves space for sticky head.

2. Center activation algorithm
   - Compute viewport center: `centerY = container.scrollTop + container.clientHeight / 2`.
   - For each mounted month section, compute its section center: `sectionCenterY` using cached offsets or `getBoundingClientRect()` + container top.
   - Choose the month with minimal `abs(sectionCenterY - centerY)`.
   - Hysteresis: Only switch when the candidate is at least `X` px closer than current (e.g., 24–48px) or when user stops scrolling (scrollend).
   - Tie breaking: Favor scroll direction on exact ties.

3. Event model
   - Listen to `scroll`; throttle with `requestAnimationFrame`. Prefer the `scrollend` event when supported; otherwise use a short idle timeout (e.g., 120ms).
   - On activation change, call `scroll.syncVisibleMonth(activeKey)`, guarded to avoid re-entry.

4. Snap to center
   - Enable CSS `scroll-snap-type: y proximity` on container; `scroll-snap-align: center` on `.calendar-month-section`.
   - For programmatic navigation, compute offset and set `scrollTop` so the section center aligns (use measured heights and `offsetTop`), not `scrollIntoView` (which lacks a reliable block:center fallback across browsers).

5. Virtualization integration
   - Keep the current windowing (`maxRenderedMonths`) and IO visibility virtualization.
   - Add near-viewport pre-render buffer (configurable, e.g., `preRenderBuffer={1}`) to reduce pop-in while fast scrolling.
   - Cache section heights whenever a month is visible; use those heights for offscreen placeholders.

6. API & configuration
   - New props (scroll mode only):
     - `activationMode: 'centered' | 'sticky'` (default: `centered`).
     - `scrollSnap: 'off' | 'proximity' | 'mandatory'` (default: `proximity`).
     - `activationHysteresisPx?: number` (default: 32).
     - `preRenderBuffer?: number` (default: 1).
     - `announceActiveMonth?: boolean` (default: true).
   - Maintain `scrollMaxRenderedMonths` and respect `minMonthKey`/`maxMonthKey` and “no future months”.

7. Edge cases
- Short containers (small heights): Use proportional hysteresis (e.g., 10–15% of container height), and reduce snap impact.
- Dynamic heights (image loads): Re-measure section heights on content load/resize; update placeholder caches.
- SSR: No DOM; default to the effective month without attempting alignment. Defer alignment until after mount.
- Missing IO: If `IntersectionObserver` isn’t available, render center±1 months, still limit DOM via `maxRenderedMonths`.

## Risks & Mitigations
- Flicker/flip near the center: Add hysteresis, prefer scrollend to commit changes.
- Jank from frequent DOM reads: Cache offsets per frame, avoid repeated layout thrash, batch in rAF.
- Over-snapping (fighting the user): Prefer `proximity` snap and only programmatically snap on explicit navigation.

## Milestones
1. Remove sticky CSS; add snap container/sections.
2. Implement center-based active tracking + hysteresis.
3. Update programmatic navigation to center-align month.
4. Maintain virtualization and add pre-render buffer option.
5. A11y: aria-current + optional live region.
6. Tests: center selection logic, re-entry guards, virtualization + activation interplay.
7. Storybook: demo with soft snapping, hysteresis controls, live center marker (debug).

## Open Questions
- Default snap strength: `proximity` or `off`? (recommend `proximity`).
- Default hysteresis: 32px fixed or % of container? (recommend `max(24px, 10%)`).
- Should keyboard navigation also center the month or respect snap only after focus moves?

---

Implementation will focus on a new hook `useCenteredMonthActivation` (or extend `useCalendarActiveMonthTracking`) that:
- Tracks offsets of mounted sections.
- Computes nearest-to-center with hysteresis and direction bias.
- Coordinates with the existing scroll state for month sync and virtualization.
