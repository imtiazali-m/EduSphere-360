# Phase 2 — Unified visual design system

**Working branch:** `work/accelerated-12-phase-start-20261110`  
**Intent:** Replace the current mixed visual language with one coherent premium identity while retaining the current application, existing screen content, routes, role rules and cloud data behaviour.

## Design problem found

The project has several overlapping style layers. The public marketing site and sign-in screens still contain a forest-green/lime palette; older dashboard styles use another green palette; later refinements introduce navy/cobalt; and operational workspaces contain many independent hard-coded blue, green, amber and violet values. This produces inconsistent brand accents, status treatments, borders, typography and spacing across screens.

The operational hierarchy stylesheet also applied browser-level `zoom` to the entire application (`1.06`, then `1.02` on small screens). Global zoom is not a sound responsive typography system: it changes the effective viewport and can create clipping, inconsistent breakpoints and awkward form/table scaling. The zoom declarations are removed; responsive sizing is handled with layout breakpoints and component dimensions instead.

## 1. Brand direction

A calm, confident academic technology identity:

- **Midnight navy** for institutional trust, navigation and high-level headings.
- **Sapphire blue** for primary actions, selected navigation, links and focus states.
- **Teal** as a restrained secondary accent for selected positive/learning signals.
- **Cool paper surfaces** for page backgrounds and white surfaces for cards/forms.
- **Semantic status colours** only for success, pending/warning and errors. A data card should not receive a random decorative colour simply to look different.

This creates one recognisable identity across the public welcome website, owner setup, login, the role dashboard and the module workspaces. The public landing page keeps its own editorial composition but no longer reads like a separate green brand.

## 2. Core colour tokens

| Token | Value | Use |
|---|---|---|
| Midnight 950 | `#0B1E33` | Deepest background and contrast |
| Navy 900 | `#102B49` | Main brand, sidebar and primary headings |
| Navy 800 | `#173D64` | Secondary brand surface |
| Sapphire 700 | `#2459C7` | Main interactive action |
| Sapphire 600 | `#316FE0` | Primary buttons, links, active states |
| Sapphire 100 | `#EAF1FF` | Selected/soft accent surface |
| Teal 700 | `#147D80` | Restrained secondary accent |
| Canvas | `#F3F6FB` | Application page background |
| White | `#FFFFFF` | Cards and forms |
| Ink | `#172B43` | Main readable text |
| Muted | `#5E7289` | Secondary text |
| Line | `#DFE7F0` | Borders and separators |
| Success | `#177B55` | Saved/approved/completed state |
| Warning | `#9A6718` | Pending/attention state |
| Danger | `#AD4541` | Failed/rejected/destructive state |

All tokens are centralised in `src/styles/design-system.css`. Component-specific variants should reference semantic tokens rather than inventing new hex colours.

## 3. Contrast and accessibility

Core foreground/background combinations are checked in the project verifier using WCAG relative-luminance contrast ratios. The current token targets include main ink on the cool canvas, muted text on canvas and white, white text on the sapphire primary action, and white text on semantic success/warning/danger states. Small secondary labels use the darker muted token rather than pale grey. This automated check does not replace full component-level contrast testing for every legacy style.

## 4. Typography and density

- Use the existing system-font stack consistently; no new font download or runtime dependency.
- Give every page one clear H1, section H2s, compact labels and comfortably readable body copy.
- Keep critical table text and form labels readable; avoid decorative microtype for operational information.
- Use consistent spacing and radii: 8px small, 12px medium, 17px large and 22px feature surfaces.
- Use restrained shadows to separate surfaces, not to make every card appear to float.
- Do not enlarge the entire page with browser zoom. Scale layouts and type within responsive breakpoints.

## 5. Screen-by-screen system

### Public welcome website
- Align header, logo, buttons, links, section accents and product preview to navy/sapphire.
- Retain the existing marketing sections, feature explanations, product tour, FAQ and owner sign-up/login calls to action.
- Preserve the editorial hero and product preview while improving contrast, card boundaries and mobile stacking.
- Keep illustrative dashboard preview numbers and visual examples clearly illustrative; never imply they are live institution data.

### Login and institution setup
- Use the same brand navy and sapphire as the rest of the product.
- Keep the security/identity visual panel but remove the separate forest-green brand language.
- Standardise input, focus, primary action, error and helper-text treatments.
- Preserve separate institution-owner and employee/student/parent access paths and their existing authentication logic.

### Signed-in application shell
- Use a midnight-navy sidebar with sapphire selected states, a bright readable workspace canvas and a consistent white topbar.
- Maintain the existing role-filtered menu groups and workspace tabs.
- Keep sign-out/Quick Access at the bottom of the navigation rather than pinning it above the menu.
- Retain the mobile drawer and desktop collapsed-sidebar behaviours.

### Dashboards
- Standardise page title, date context, filters, metric cards, first-run guidance, charts, recent activity and quick actions.
- Keep role-specific content and metrics; do not turn every role into the owner dashboard.
- Clearly distinguish real records, no data, loading, partial visibility and errors.
- Preserve the note that dashboard “records found” signals do not prove that an entire business process is configured.

### Module workspaces, tables and forms
- Standardise workspace hero, sub-navigation, record cards, KPI cards, table header/row/hover, form controls, action buttons, state pills, empty states and feedback.
- Keep column sets and available actions role-specific.
- Preserve existing data validation, RLS, RPC and file-security logic.
- Keep wide data tables scrollable within their own containers on mobile; do not shrink the entire page to make a wide table fit.

## 6. Responsive design rules

- Desktop: fixed navigation rail, flexible workspace canvas and readable max-width content.
- Tablet: preserve essential navigation and allow filter/toolbars to wrap without overlap.
- Mobile: drawer navigation, stacked dashboard panels, two-column metrics where legible, single-column forms and horizontally scrollable tables within a bounded container.
- No application-wide zoom; no forced horizontal overflow on the page.
- Keep touch targets comfortably sized and maintain visible keyboard focus.
- Respect `prefers-reduced-motion`.

## 7. Phase 2 implementation and acceptance

The first implementation slice adds the unified semantic token layer, imports it after the existing component styles, normalises major shared surfaces, and removes the old root-level zoom declarations. This is a foundation and a first visual pass, not a claim that every page has been visually approved.

Acceptance requires:
1. No competing primary brand palettes across public, login and authenticated screens.
2. Reusable shared tokens drive colour, border, shadow, radius and surface treatment.
3. Navigation states, buttons, forms, tables, notices and status pills remain consistent.
4. No root zoom; page layouts respond at desktop, tablet and mobile widths.
5. Every role retains its own content and permitted navigation.
6. No behaviour, access-control, route, Supabase or production data change is introduced by CSS-only work.
7. A fresh build, source verifier, screenshots at representative widths, and manual visual review are completed before the design is accepted or deployed.

## 8. Current state

- Static source review completed for the design cascade and application shell.
- Unified CSS token layer and first pass are being added on the working branch.
- GitHub Actions run `42875451852` passed source verification, user-error, finance and private-file tests, the production Vite build, Cloudflare output validation and both build-artifact uploads.
- Visual browser review and screenshot-based acceptance remain pending. The Vercel deployment-detail page requires sign-in, so an anonymous preview URL and visual Ready state could not be confirmed.
- No Cloudflare production deployment was made.
- No production Cloudflare deployment or Supabase change is included in Phase 2.
