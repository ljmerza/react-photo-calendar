# Photo Calendar Composability Plan

## Goal
- Decouple calendar state/behavior from its visual controls so consumers can supply their own navigation buttons, day cell layouts, and containers without rewriting date logic.
- Provide a predictable, typed API that mirrors headless component libraries (e.g., `@radix-ui`, `@react-aria`) while keeping a reference UI for quick starts.
- Preserve current functionality and accessibility guarantees as defaults, with a clear migration path for existing users.

## Current State
- `PhotoCalendar` now composes headless primitives (`PhotoCalendarRoot`, `PhotoCalendarNavigation`, `PhotoCalendarWeekdays`, `PhotoCalendarMonthGrid`) while keeping the legacy props intact.
- Consumers can override navigation, weekday headers, and day rendering via render props (`renderNavigation`, `renderWeekdays`, `renderDay`) or build entirely custom shells with the primitives and context hook.
- Design tokens exposed through CSS variables allow theming without touching JSX.
- Optional helper components such as `PhotoCalendarDay` expose the default button markup for consumers who want partial overrides without rebuilding accessibility wiring.
- A mobile scroll timeline ships behind `navigationMode="scroll"` with `onVisibleMonthChange` and a `scroll` helper state so consumers can prefetch adjacent months while keeping the legacy banner as a fallback.

## Guiding Principles
- **Headless-first**: expose state and callbacks via hooks/context so UI can be composed anywhere in the tree.
- **Composable primitives**: expose small, focused primitives (`CalendarRoot`, `CalendarNavigation`, `DayCell`) with sensible defaults.
- **Render-prop overrides**: prefer slot-style render props so consumers control markup while inheriting accessibility and behavior.
- **Accessibility baked in**: keep ARIA roles/labels/state logic in the headless primitives so custom UI inherits best practices.
- **Type safety**: publish TypeScript interfaces describing component override signatures and render contexts.

## Proposed Architecture
1. **Extract state management**
   - Introduce `usePhotoCalendarState` hook that encapsulates month navigation, range calculation, day mappings, and callbacks.
   - Ensure the hook emits the same `onRangeChange`, `onMonthChange`, and `DayRenderContext` information the current component provides.

2. **Context provider + root component**
   - Create `PhotoCalendarRoot` that wires the state hook and shares data via context.
   - Maintain support for controlled/uncontrolled usage inside the root.

3. **Composable subcomponents**
   - `PhotoCalendarNavigation`: consumes context and renders prev/next/today controls; exposes render props for each control so consumers can supply custom button markup.
   - `PhotoCalendarMonthGrid`: renders weekday headers and day cells through render-prop slots.
   - `PhotoCalendarDay`: headless day cell primitive exposing render props for the button/container and photo thumbnails.
   - Keep a `PhotoCalendar` convenience export that composes the primitives with the current default markup.

4. **Render-prop override API**
   - Provide dedicated render props (`renderNavigation`, `renderMonthChip`, `renderDay`, etc.) that receive typed context objects and callback helpers.
   - Re-export TypeScript interfaces for each render context (e.g., `NavigationRenderProps`, `DayRenderProps`) to guide consumers on available data and required behaviors.
   - Offer optional helper components (e.g., `PhotoCalendarDay`) for teams that want to mix and match default pieces with custom markup.

5. **Styling strategy**
   - Provide minimal CSS tokens via CSS variables for the default skin plus a published design token map (`calendar.color.surface`, `calendar.radius.day`, etc.).
   - Document how to bypass CSS by composing primitives with Tailwind/CSS-in-JS and how to integrate the token map into design system themes.

6. **Testing updates**
   - Expand tests to cover `usePhotoCalendarState` and primitive interaction (keyboard nav, disabled states).
   - Add regression tests ensuring render-prop consumers receive the right context data and callbacks.

## Milestones
1. **Foundations (Week 1)**
   - Document current behaviors and props.
   - Add unit tests around navigation boundaries and day selection to protect refactor.
   - Draft TypeScript types for new state hook and context.

2. **Primitive extraction (Week 2)**
   - Implement `usePhotoCalendarState`.
   - Introduce `PhotoCalendarRoot` and migrate existing component to consume it internally.
   - Ensure `PhotoCalendar` export remains backward-compatible.

- (✅) **Composable navigation**: render-prop slots for navigation buttons/month chips ship in `PhotoCalendarNavigation`, with examples documented in the README.
- (✅) **Day cell composability**: `PhotoCalendarMonthGrid` render prop + `renderDay`/`renderDayContent` hooks support custom wrappers while reusing thumbnail defaults.
- (✅) **Docs & examples**: README + dedicated docs outline render prop contracts and token usage; example app demonstrates custom navigation.
- (In progress) **Hardening**: Type exports aligned; accessibility and testing updates remain to be completed.

## Risks & Mitigations
- **Breaking changes**: mitigate by keeping `PhotoCalendar` wrapper API stable and releasing in a minor version with opt-in overrides.
- **Context misuse**: document hook usage patterns and provide guards (e.g., throw if a primitive is rendered outside the provider in dev mode).
- **Increased bundle size**: monitor bundle output; rely on tree-shaking and optional subcomponent exports.
- **Testing complexity**: prioritize hook-level tests to reduce dependency on full DOM rendering.

## Decisions on Open Questions
- **Package structure**: ship a single package with optional CSS entry points. This keeps imports simple, avoids duplicate build pipelines, and relies on documentation to steer headless consumers toward the tree-shakable core exports.
- **Override API**: favor render-prop slots for overrides. Render props give maximum layout flexibility, let consumers inline conditional UI, and align with the headless-first approach; documentation will emphasize memoization patterns to keep re-renders predictable.
- **Theming guidance**: publish design tokens/theme contracts alongside CSS variables. Offering a token map accelerates adoption for teams with established theming systems while still allowing lightweight usage via vanilla CSS variables.

## Next Steps
- Validate milestone timelines with stakeholders for remaining work (hardening + testing).
- Flesh out render-prop guidance with memoization tips and anti-patterns in the main docs.
- Expand the Storybook catalogue with multiple design-system skins and interaction scenarios (keyboard navigation, range loading, etc.).
- Resume automated testing (Vitest) to cover context consumers and accessibility regressions before release.
