# EduSphere 360 — Front-end visual refresh

## Scope

This work refines the existing React/TypeScript application. It does not replace the application, invent institution records, or alter Supabase.

## Shared visual direction

The final stylesheet `src/styles/visual-refresh.css` is loaded after the existing design and operational styles. It aligns the public marketing site, account screens, signed-in navigation, dashboard, record modules and specialist workspaces around deep navy, sapphire, teal and restrained semantic status colours. It standardises headings, readable text, spacing, bordered surfaces, card elevation, focus indicators, transitions and responsive behavior.

## Imagery

The public landing page includes a dedicated campus-and-learning photograph showcase below the facts band. Both images include descriptive alternative text, lazy loading and captions. The dashboard heading also uses a campus photograph under a high-contrast overlay. Photo sources and photographer credits are listed in `docs/ASSET_CREDITS.md`.

## Workspace and navigation behavior

- Tabs are identified by canonical routes, so selecting a menu alias focuses the existing destination instead of opening a duplicate window.
- Parent relationships cannot self-reference.
- Menu selection follows the currently active route.
- Switching windows expands the relevant menu group.
- Choosing a group in compact-sidebar mode expands the sidebar and reveals that group's submenu in one click.
- The Dashboard heading opens the Dashboard, rather than acting only as a disclosure control.
- The selected workspace is labelled in the application frame and the tab strip scrolls horizontally to keep the active tab visible.
- Inactive windows remain hidden while their mounted component state is preserved.

## Workspace readability

Overrides improve the visual hierarchy, typography and control sizing for student, faculty, staff, administration and attendance screens, as well as shared module insight cards and tables. These changes are presentation-only; module data access, permissions, CRUD handlers and existing workflow logic are preserved.

## Verification boundaries

Automated route, modal/window and responsive checks are source-level checks. CI additionally runs the production Vite build and validates Cloudflare output. A successful isolated PR preview deployment is distinct from production deployment.

Desktop read-only checks have inspected the public landing, login, signup, campus/learning image section and public sample diagrams. The owner signup terms checkbox is present in the rendered form HTML. No credentials were submitted.

Actual authenticated testing of each institution role, real transaction workflows and phone/tablet screenshot acceptance remain separate release gates. Never infer that these have passed from source or build checks alone.

## Release safety

This branch must be reviewed and explicitly promoted before production changes. No production Supabase schema, RLS policy, Auth configuration, Edge Function, storage object, account or institution record is part of this visual change.
