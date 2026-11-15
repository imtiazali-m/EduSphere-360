# EduSphere native WebRTC media server

EduSphere owns the classroom and calling experience: scheduling, institution access, class rosters, invitations, participant history and attendance intervals are stored in the EduSphere Supabase project. Live audio/video is carried by a self-hosted WebRTC SFU; this deployment does **not** use Zoom, Google Meet or a managed LiveKit Cloud project.

## Required hosting

A small development test can use a single VM. Production capacity must be sized from expected concurrent classrooms, participants, video quality and network bandwidth. Before enabling live calls, provision:

- A Linux virtual machine with a public IPv4 address and UDP support.
- A DNS name such as `livekit.example.edu` pointing to that VM.
- Permission to open TCP 80, 443 and 7881, UDP 3478 and UDP 50000–60000.
- A valid TLS certificate for the media domain. Self-signed certificates are not suitable for browser clients.

The LiveKit VM guide provides a supported Docker Compose + Caddy + Redis deployment generator. Use the generated configuration for the selected domain and hosting provider rather than exposing the API port directly:
https://docs.livekit.io/transport/self-hosting/vm/

## Supabase Edge Function secrets

After the server is installed and its API key/secret are generated, add these three secrets to the **development** Supabase project under Edge Functions → Secrets:

- `LIVEKIT_URL`: `wss://livekit.example.edu`
- `LIVEKIT_API_KEY`: the server API key
- `LIVEKIT_API_SECRET`: the matching server API secret

Never put the API secret in Vite variables, browser code, SQL rows, GitHub files or chat messages. The `online-session-control` Edge Function signs 10-minute room tokens only after validating the current user and institution permissions.

## Readiness checks before enabling live calls

1. Verify the WebSocket endpoint uses the trusted TLS certificate.
2. Verify UDP media connectivity from a browser on a different network.
3. Test TCP fallback and TURN/TLS from a restrictive network.
4. Join a video class with one teacher and multiple student accounts.
5. Test microphone/camera permissions, mute, camera off, screen share, network loss and reconnect.
6. Confirm participants who leave/rejoin accumulate only their actual connected minutes.
7. Verify class roster restrictions and ensure one institution cannot access another institution's rooms.
8. Keep recording disabled unless an institution explicitly approves a separate recording and retention policy.

The Supabase Edge Function reports media status as pending until all three secrets are present. A scheduled class or invitation is not evidence that live media is connected.
