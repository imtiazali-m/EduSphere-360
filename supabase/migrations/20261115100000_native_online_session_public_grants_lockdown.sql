-- Remove inherited public/anonymous table privileges from call-session records.
revoke all on table
  public.online_sessions,
  public.online_session_participants,
  public.online_session_events
from public, anon;

grant select on table
  public.online_sessions,
  public.online_session_participants,
  public.online_session_events
to authenticated;
