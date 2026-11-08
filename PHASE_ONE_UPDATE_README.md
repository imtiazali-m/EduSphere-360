# EduSphere 360 — Phase One update

This update is based on the saved complete source archive `EduSphere360_Current_Source(2)(2).zip` (4 November 2026), combined with the latest Dashboard and `modules.ts` supplied in the 7 November 2026 conversation, plus the saved AdministrationModule implementation. It is not a fresh export of the current Windows folder.

## Included feature groups

1. **Institution setup:** departments, academic sessions and programs.
2. **Class management:** classes and sections.
3. **Subject management:** institution subject catalogue.

The Administration workspace also retains the saved supporting Rooms & Facilities CRUD tab. Existing source files from the base archive are retained. Before replacing the two existing source files, their exact original contents are preserved under `preserved-originals/phase-one-base-2026-11-04/`.

## Install

1. Extract this ZIP into a new folder; do not overwrite your current project folder.
2. In Supabase SQL Editor, run `supabase/migrations/015_administration_setup.sql` after the existing base migrations.
3. Copy `.env.local` from your working project into the extracted folder if you wish to test against the same Supabase project. Do not share that file publicly.
4. Open the extracted folder in VS Code and run `npm.cmd install`, then `npm.cmd run dev`.
5. Sign in as the institution Owner or Administrator and open **Administration**.

## Important scope note

The Administration CRUD screen supports create, list, search, edit and delete for the configured entities. The SQL migration creates institution-scoped tables and protects them with the existing `is_institution_member` and `has_institution_role` functions. This package has not been connected to your live Supabase project and does not claim that the migration has been executed there.
