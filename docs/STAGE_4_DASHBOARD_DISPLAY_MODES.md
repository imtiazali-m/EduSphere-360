# Stage 4 — Modern and Classic Dashboard Views

## Scope

This is a frontend-only presentation change to the existing signed-in application. It does not create another dashboard data source and does not change Supabase, records, role grants, row filters, navigation destinations, or workspace operations.

## Behaviour

- **Modern** is the default. It keeps the existing spacious dashboard cards, charts, panels and whitespace.
- **Classic** uses a denser administrative presentation: smaller card spacing, more compact summaries, and register-like recent activity, workspace tabs and tables.
- Both modes keep the same mounted `Dashboard`, `Overview`, role-filtered module list, current workspace-tab collection and child-window relationships. The selector only changes a `data-view-mode` presentation attribute.
- Light/dark theme, standard/large/extra-large type, compact/expanded sidebar, and reduced motion are exposed in the Display settings panel.
- The sidebar preference is the same state used by the existing sidebar collapse button; there are not two competing controls.
- Preferences are versioned and stored in browser local storage on the current device. They are not account settings and are not synchronized between devices. If browser storage is unavailable or full, the dashboard remains usable and the preference simply is not persisted.
- Settings do not invoke sign-out, change the URL, open/close tabs, or call data-loading functions.

## Accessibility and responsive behaviour

The controls are native buttons, selects and checkbox inputs with accessible names, `aria-pressed`, `aria-expanded`, and visible keyboard focus. The settings panel is connected to its trigger, can be dismissed with Escape, and returns focus to the trigger. New controls have 32px minimum dimensions, exceeding the WCAG 2.2 AA 24×24 CSS-pixel minimum target size. The layout wraps the view selector and display settings on narrow screens. An explicit reduced-motion preference supplements the operating-system `prefers-reduced-motion` setting.

Reference: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), particularly Success Criterion 2.5.8 Target Size (Minimum) and 2.4.11 Focus Not Obscured (Minimum). The 3:1, 2px focus-area criterion in 2.4.13 is AAA, not AA; it is not represented here as an AA requirement.

## Automated verification

`scripts/test-display-preferences.mjs` covers default values, successful reads/writes, invalid values, malformed JSON, and storage read/write failures. `scripts/verify-project.mjs` checks that the selector remains within the existing dashboard shell and that role-aware navigation and workspace rendering remain present. GitHub Actions runs the preference tests, project verifier, TypeScript check and production build.

## Manual acceptance still required

After the preview build is available, use disposable test logins for the seven roles and verify:
1. Switch Modern ↔ Classic while inside a nested workspace; the same workspace remains active and data does not clear.
2. Sign out and back in; settings persist on the same browser/device, and another browser/device starts with its own defaults.
3. Verify compact/expanded sidebar both from its existing collapse button and from Display settings.
4. Check Light/Dark across dashboard, tables and modal surfaces, and test Standard/Large/Extra large at desktop, tablet and phone widths.
5. Keyboard-only: Tab to Modern/Classic and Display; open settings; operate every control; close with Escape; confirm focus returns to Display.
6. Enable reduced motion and confirm transitions/animations are suppressed; verify OS reduced-motion also applies.
7. Confirm the same routes, menu items, row counts and actions remain available before and after switching modes for each role.

This PR is source-only. A successful CI build is not the same as live authenticated seven-role acceptance or production deployment.
