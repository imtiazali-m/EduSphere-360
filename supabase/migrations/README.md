# Migration history

The six `20261108...` migration files in this folder match migrations already applied to the linked production Supabase project. Keep each 14-digit timestamp unchanged so `supabase migration list --remote` can match local and remote history.

The older numbered SQL files are preserved as legacy project material. Do not execute them blindly against the existing production database: parts of their schema are already present with different legacy column names. The five timestamped compatibility migrations are the reviewed incremental changes for the current live schema.
