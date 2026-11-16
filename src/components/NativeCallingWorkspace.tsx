import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CameraOff, CalendarClock, Mic, MicOff, MonitorUp, Phone, PhoneCall, PhoneOff, RefreshCw, ShieldCheck, Users, Video, X } from 'lucide-react'
import { Room, RoomEvent, Track } from 'livekit-client'
import type { Track as LiveTrack } from 'livekit-client'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/native-calling-workspace.css'

type ViewMode = 'calls' | 'classes'
type SessionRow = {
  id: string
  institution_id: string
  session_type: 'classroom' | 'direct_call' | 'group_call'
  title: string
  class_id: string | null
  subject_id: string | null
  created_by: string
  participant_role?: string
  media_mode: 'audio' | 'video'
  starts_at: string | null
  ends_at: string | null
  status: 'scheduled' | 'ringing' | 'live' | 'ended' | 'cancelled'
  recording_enabled: boolean
  online_session_participants?: Array<{
    user_id: string
    participant_role: string
    status: string
    joined_at: string | null
    left_at: string | null
    attendance_minutes: number
  }>
}
type Contact = { user_id: string; display_name: string; role: string }
type ClassOption = { id: string; name: string; section?: string | null }
type SubjectOption = { id: string; name: string; subject_code?: string | null }
type TrackTile = { key: string; track: LiveTrack; identity: string; local: boolean }

async function invokeControl(institutionId: string, action: string, values: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('EduSphere cloud services are not configured.')
  const { data, error } = await supabase.functions.invoke('online-session-control', {
    body: { institutionId, action, ...values },
  })
  if (error) throw new Error(data?.error || error.message || 'The calling service could not complete this action.')
  if (data?.error) throw new Error(String(data.error))
  return data
}

function formatSessionTime(value: string | null) {
  if (!value) return 'Time not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time not set'
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function getRoomTracks(room: Room): TrackTile[] {
  const items: TrackTile[] = []
  for (const publication of room.localParticipant.trackPublications.values()) {
    if (publication.track) items.push({
      key: 'local-' + publication.trackSid,
      track: publication.track,
      identity: room.localParticipant.name || 'You',
      local: true,
    })
  }
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) items.push({
        key: participant.identity + '-' + publication.trackSid,
        track: publication.track,
        identity: participant.name || participant.identity,
        local: false,
      })
    }
  }
  return items
}

function MediaTile({ item }: { item: TrackTile }) {
  const mount = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!mount.current) return
    const element = item.track.attach()
    element.autoplay = true
    if (element instanceof HTMLVideoElement) {
      element.playsInline = true
      element.muted = item.local
      element.style.width = '100%'
      element.style.height = '100%'
      element.style.objectFit = 'cover'
    } else {
      element.muted = item.local
      element.style.width = '1px'
      element.style.height = '1px'
      element.style.position = 'absolute'
      element.style.opacity = '0'
    }
    mount.current.replaceChildren(element)
    return () => {
      item.track.detach(element)
      element.remove()
    }
  }, [item])
  return <div className={'ed360-call-media-tile ' + (item.track.kind === Track.Kind.Audio ? 'audio-only' : '')}>
    <div className="ed360-call-media-mount" ref={mount}/>
    <span className="ed360-call-media-name">{item.local ? 'You' : item.identity}</span>
  </div>
}

export function NativeCallingWorkspace({
  onToast,
  initialView = 'calls',
}: {
  onToast: (message: string, error?: boolean) => void
  initialView?: ViewMode
}) {
  const { user } = useAuth()
  const [view, setView] = useState<ViewMode>(user?.role === 'parent' ? 'classes' : initialView)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [serverConfigured, setServerConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('video')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [startAt, setStartAt] = useState(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000)
    next.setMinutes(0, 0, 0)
    return new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null)
  const [roomTracks, setRoomTracks] = useState<TrackTile[]>([])
  const [remoteCount, setRemoteCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const roomRef = useRef<Room | null>(null)
  const mountedRef = useRef(true)

  const institutionId = user?.institutionId ?? ''
  const canUseCalling = Boolean(user && ['owner', 'admin', 'teacher', 'student'].includes(user.role))
  const canScheduleClass = Boolean(user && ['owner', 'admin', 'teacher'].includes(user.role))

  const refreshSessions = useCallback(async () => {
    if (!institutionId) return
    const data = await invokeControl(institutionId, 'list')
    if (mountedRef.current) setSessions((data.sessions ?? []) as SessionRow[])
  }, [institutionId])

  const loadWorkspace = useCallback(async () => {
    if (!institutionId || !user || !supabase) return
    setLoading(true)
    setError('')
    try {
      const [state, contactData, classResult, subjectResult] = await Promise.all([
        invokeControl(institutionId, 'status'),
        invokeControl(institutionId, 'contacts'),
        supabase.from('classes').select('id,name,section').eq('institution_id', institutionId).eq('is_active', true).order('name'),
        supabase.from('subjects').select('id,name,subject_code').eq('institution_id', institutionId).eq('is_active', true).order('name'),
      ])
      setServerConfigured(Boolean(state.mediaServer?.configured))
      setContacts((contactData.contacts ?? []) as Contact[])
      if (classResult.error) throw classResult.error
      if (subjectResult.error) throw subjectResult.error
      setClasses((classResult.data ?? []) as ClassOption[])
      setSubjects((subjectResult.data ?? []) as SubjectOption[])
      await refreshSessions()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The calling workspace could not load.'
      setError(message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [institutionId, user, refreshSessions])

  useEffect(() => {
    mountedRef.current = true
    void loadWorkspace()
    return () => {
      mountedRef.current = false
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [loadWorkspace])

  useEffect(() => {
    if (!institutionId || !user?.id || !supabase) return
    const channel = supabase.channel('ed360-online-session-inbox-' + user.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'online_session_participants',
        filter: 'user_id=eq.' + user.id,
      }, () => { void refreshSessions() })
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [institutionId, user?.id, refreshSessions])

  const callSessions = useMemo(
    () => sessions.filter(session => session.session_type !== 'classroom'),
    [sessions],
  )
  const classSessions = useMemo(
    () => sessions.filter(session => session.session_type === 'classroom'),
    [sessions],
  )

  function toggleContact(id: string) {
    setSelectedContacts(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]
      return next
    })
  }

  async function createCall() {
    if (!institutionId || selectedContacts.length < 1) {
      setError('Select at least one person to call.')
      return
    }
    if (selectedContacts.length > 10) {
      setError('Group calls are limited to ten invited contacts.')
      return
    }
    const names = contacts.filter(contact => selectedContacts.includes(contact.user_id)).map(contact => contact.display_name)
    const title = selectedContacts.length === 1 ? 'Call with ' + (names[0] ?? 'institution member') : 'Group call'
    setBusy(true)
    setError('')
    try {
      const data = await invokeControl(institutionId, 'create', {
        sessionType: selectedContacts.length > 1 ? 'group_call' : 'direct_call',
        title,
        mediaMode,
        targetUserIds: selectedContacts,
        startsAt: new Date().toISOString(),
      })
      setSelectedContacts([])
      await refreshSessions()
      onToast('Call invitation created.')
      if (data.session?.id) await joinSession(data.session.id)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The call could not be started.'
      setError(message)
      onToast(message, true)
    } finally {
      setBusy(false)
    }
  }

  async function createClassSession() {
    if (!institutionId || !classId) {
      setError('Choose a class before scheduling its online lesson.')
      return
    }
    if (!sessionTitle.trim()) {
      setError('Enter a title for the online class.')
      return
    }
    const date = new Date(startAt)
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 5 * 60 * 1000) {
      setError('Choose a valid start time in the future.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await invokeControl(institutionId, 'create', {
        sessionType: 'classroom',
        title: sessionTitle.trim(),
        classId,
        subjectId: subjectId || null,
        mediaMode: 'video',
        startsAt: date.toISOString(),
      })
      setSessionTitle('')
      await refreshSessions()
      onToast('Online class scheduled for the selected class.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The online class could not be scheduled.'
      setError(message)
      onToast(message, true)
    } finally {
      setBusy(false)
    }
  }

  async function joinSession(sessionId: string) {
    if (!institutionId || !supabase || roomRef.current) return
    setBusy(true)
    setError('')
    setConnectionState('connecting')
    try {
      const data = await invokeControl(institutionId, 'join', { sessionId })
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room
      const refreshTracks = () => {
        if (!mountedRef.current) return
        setRoomTracks(getRoomTracks(room))
        setRemoteCount(room.remoteParticipants.size)
      }
      const onDisconnected = () => {
        if (mountedRef.current) {
          setConnectionState('disconnected')
          setRoomTracks([])
          setRemoteCount(0)
        }
      }
      room.on(RoomEvent.TrackSubscribed, refreshTracks)
      room.on(RoomEvent.TrackUnsubscribed, refreshTracks)
      room.on(RoomEvent.LocalTrackPublished, refreshTracks)
      room.on(RoomEvent.LocalTrackUnpublished, refreshTracks)
      room.on(RoomEvent.ParticipantConnected, refreshTracks)
      room.on(RoomEvent.ParticipantDisconnected, refreshTracks)
      room.on(RoomEvent.Disconnected, onDisconnected)
      await room.connect(data.serverUrl, data.token)
      const observerMode = data.session?.participantRole === 'parent'
      if (!observerMode) await room.localParticipant.setMicrophoneEnabled(true)
      if (!observerMode && data.session?.mediaMode === 'video') {
        await room.localParticipant.setCameraEnabled(true)
        setCameraOn(true)
      } else {
        setCameraOn(false)
      }
      setMuted(observerMode)
      setActiveSession({
        id: data.session.id,
        institution_id: institutionId,
        session_type: data.session.sessionType,
        title: data.session.title,
        class_id: null,
        subject_id: null,
        created_by: '',
        participant_role: data.session.participantRole,
        media_mode: data.session.mediaMode,
        starts_at: data.session.startsAt,
        ends_at: null,
        status: 'live',
        recording_enabled: false,
      })
      setConnectionState('connected')
      refreshTracks()
      await refreshSessions()
    } catch (caught) {
      roomRef.current?.disconnect()
      roomRef.current = null
      setConnectionState('disconnected')
      const message = caught instanceof Error ? caught.message : 'The call could not connect.'
      setError(message)
      onToast(message, true)
    } finally {
      setBusy(false)
    }
  }

  async function leaveSession(endForEveryone = false) {
    const session = activeSession
    if (!session || !institutionId) return
    setBusy(true)
    try {
      roomRef.current?.disconnect()
      roomRef.current = null
      if (endForEveryone) await invokeControl(institutionId, 'end', { sessionId: session.id })
      else await invokeControl(institutionId, 'leave', { sessionId: session.id })
      setActiveSession(null)
      setRoomTracks([])
      setRemoteCount(0)
      setConnectionState('disconnected')
      setMuted(false)
      setCameraOn(false)
      setSharing(false)
      await refreshSessions()
      onToast(endForEveryone ? 'Session ended for everyone.' : 'You left the session.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The session could not be closed.'
      setError(message)
      onToast(message, true)
    } finally {
      setBusy(false)
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setMicrophoneEnabled(muted)
      setMuted(!muted)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Microphone permission was denied.')
    }
  }

  async function toggleCamera() {
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setCameraEnabled(!cameraOn)
      setCameraOn(!cameraOn)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Camera permission was denied.')
    }
  }

  async function toggleScreenShare() {
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setScreenShareEnabled(!sharing)
      setSharing(!sharing)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Screen sharing is not available.')
    }
  }

  const activeParticipants = activeSession?.id
    ? sessions.find(item => item.id === activeSession.id)?.online_session_participants ?? []
    : []

  const canEnd = Boolean(activeSession && (
    sessions.find(item => item.id === activeSession.id)?.created_by === user?.id
    || user?.role === 'owner' || user?.role === 'admin'
  ))

  return <main className="page-content ed360-native-calling">
    <header className="ed360-native-header">
      <div>
        <span>GIDC BADIN · LIVE LEARNING</span>
        <h1>{view === 'classes' ? 'Online Classes' : 'Voice & Video Calling'}</h1>
        <p>Schedule a class or start a voice/video call.</p>
      </div>
      <div className={'ed360-native-server-status ' + (serverConfigured ? 'ready' : 'pending')}>
        <i/>{serverConfigured ? 'Media server configured' : 'Media server setup pending'}
      </div>
    </header>

    {error && <div className="ed360-native-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}

    {activeSession ? <section className="ed360-native-live">
      <header>
        <div><span>LIVE SESSION</span><h2>{activeSession.title}</h2><p>{connectionState === 'connected' ? 'Connected securely' : connectionState === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p></div>
        <span className={'ed360-native-live-state ' + connectionState}><i/>{connectionState}</span>
      </header>
      <div className="ed360-native-video-grid">
        {roomTracks.filter(item => item.track.kind === Track.Kind.Video).map(item => <MediaTile key={item.key} item={item}/>)}
        {roomTracks.filter(item => item.track.kind === Track.Kind.Audio).map(item => <MediaTile key={item.key} item={item}/>)}
        {roomTracks.length === 0 && <div className="ed360-native-empty-media"><Video size={28}/><b>Preparing your media</b><span>Your camera and microphone controls are ready.</span></div>}
      </div>
      <div className="ed360-native-live-footer">
        <span><Users size={15}/>{remoteCount + 1} connected</span>
        <div className="ed360-native-controls">
          {activeSession.participant_role !== 'parent' && <>
          <button type="button" onClick={() => void toggleMicrophone()} title={muted ? 'Unmute microphone' : 'Mute microphone'}><>{muted ? <MicOff size={17}/> : <Mic size={17}/>}<span>{muted ? 'Unmute' : 'Mute'}</span></></button>
          <button type="button" onClick={() => void toggleCamera()} title={cameraOn ? 'Turn camera off' : 'Turn camera on'}><>{cameraOn ? <Camera size={17}/> : <CameraOff size={17}/>}<span>{cameraOn ? 'Camera on' : 'Camera off'}</span></></button>
          <button type="button" onClick={() => void toggleScreenShare()} title={sharing ? 'Stop sharing' : 'Share screen'}><>{sharing ? <MonitorUp size={17}/> : <MonitorUp size={17}/>}<span>{sharing ? 'Stop share' : 'Share screen'}</span></></button>
          </>}
          {activeSession.participant_role === 'parent' && <span className="ed360-native-observer"><ShieldCheck size={15}/> Observer mode</span>}
          <button type="button" className="end" disabled={busy} onClick={() => void leaveSession(canEnd)}><PhoneOff size={17}/><span>{canEnd ? 'End session' : 'Leave'}</span></button>
        </div>
      </div>
      <div className="ed360-native-attendance">
        <b>Session attendance</b>
        <span>{activeParticipants.length ? activeParticipants.length + ' registered participant record(s)' : 'Your join and leave time is recorded for this class.'}</span>
      </div>
    </section> : <>
      <nav className="ed360-native-tabs" aria-label="Calling workspace">
        <button type="button" className={view === 'calls' ? 'active' : ''} onClick={() => setView('calls')}><PhoneCall size={16}/> Calls</button>
        <button type="button" className={view === 'classes' ? 'active' : ''} onClick={() => setView('classes')}><Video size={16}/> Online classes</button>
      </nav>

      {view === 'calls' ? <div className="ed360-native-columns">
        <section className="ed360-native-panel ed360-native-compose">
          <header><div><b>Start a call</b><small>Select institution members</small></div><Phone size={20}/></header>
          {!canUseCalling && <p className="ed360-native-muted">Your account does not have calling permission.</p>}
          <label>Call type</label>
          <div className="ed360-native-choice">
            <button type="button" className={mediaMode === 'audio' ? 'selected' : ''} onClick={() => setMediaMode('audio')}><Mic size={16}/> Voice</button>
            <button type="button" className={mediaMode === 'video' ? 'selected' : ''} onClick={() => setMediaMode('video')}><Video size={16}/> Video</button>
          </div>
          <label>Choose people</label>
          <div className="ed360-native-contact-list">
            {contacts.length ? contacts.map(contact => <label key={contact.user_id} className="ed360-native-contact">
              <input type="checkbox" checked={selectedContacts.includes(contact.user_id)} onChange={() => toggleContact(contact.user_id)} disabled={busy || (!selectedContacts.includes(contact.user_id) && selectedContacts.length >= 10)}/>
              <span className="avatar">{contact.display_name.slice(0,1).toUpperCase()}</span>
              <span><b>{contact.display_name}</b><small>{contact.role.replaceAll('_',' ')}</small></span>
            </label>) : <p className="ed360-native-muted">No eligible contacts were found in this institution.</p>}
          </div>
          <button type="button" className="ed360-native-primary" onClick={() => void createCall()} disabled={busy || !selectedContacts.length || !canUseCalling}>
            <Phone size={16}/>{busy ? 'Starting…' : selectedContacts.length > 1 ? 'Start group call' : 'Start call'}
          </button>
        </section>

        <section className="ed360-native-panel">
          <header><div><b>Recent calls</b><small>Call invitations and session history</small></div><button type="button" className="ed360-native-icon-button" onClick={() => void refreshSessions()} title="Refresh calls"><RefreshCw size={16}/></button></header>
          <div className="ed360-native-session-list">
            {loading ? <p className="ed360-native-muted">Loading your calls…</p> : callSessions.length ? callSessions.map(session => {
              const own = session.online_session_participants?.some(participant => participant.user_id === user?.id)
              const host = session.created_by === user?.id || user?.role === 'owner' || user?.role === 'admin'
              return <article className="ed360-native-session-card" key={session.id}>
                <div className="type-icon"><Phone size={17}/></div>
                <div className="details"><b>{session.title}</b><small>{session.media_mode === 'audio' ? 'Voice call' : 'Video call'} · {formatSessionTime(session.starts_at)}</small><span className={'status ' + session.status}>{session.status.replace('_',' ')}</span></div>
                {session.status !== 'ended' && session.status !== 'cancelled' && <button type="button" onClick={() => void joinSession(session.id)} disabled={busy || !serverConfigured || (!own && !host)}>{own ? 'Rejoin' : 'Answer'}</button>}
              </article>
            }) : <p className="ed360-native-muted">No calls yet. Choose a contact to start one.</p>}
          </div>
        </section>
      </div> : <div className="ed360-native-columns">
        {canScheduleClass && <section className="ed360-native-panel ed360-native-compose">
          <header><div><b>Schedule an online class</b><small>Create a live lesson for a class group</small></div><CalendarClock size={20}/></header>
          <label htmlFor="ed360-class-title">Class title</label>
          <input id="ed360-class-title" value={sessionTitle} onChange={event => setSessionTitle(event.target.value)} placeholder="e.g. Mathematics — Chapter 4"/>
          <label htmlFor="ed360-class-group">Class / section</label>
          <select id="ed360-class-group" value={classId} onChange={event => setClassId(event.target.value)}>
            <option value="">Select class</option>
            {classes.map(item => <option value={item.id} key={item.id}>{item.name}{item.section ? ' · ' + item.section : ''}</option>)}
          </select>
          <label htmlFor="ed360-class-subject">Subject (optional)</label>
          <select id="ed360-class-subject" value={subjectId} onChange={event => setSubjectId(event.target.value)}>
            <option value="">Select subject</option>
            {subjects.map(item => <option value={item.id} key={item.id}>{item.name}{item.subject_code ? ' · ' + item.subject_code : ''}</option>)}
          </select>
          <label htmlFor="ed360-class-start">Start date and time</label>
          <input id="ed360-class-start" type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)}/>
          <button type="button" className="ed360-native-primary" onClick={() => void createClassSession()} disabled={busy || !canScheduleClass}><CalendarClock size={16}/>{busy ? 'Saving…' : 'Schedule class'}</button>
        </section>}
        <section className="ed360-native-panel">
          <header><div><b>Class schedule</b><small>Upcoming live lessons and previous sessions</small></div><button type="button" className="ed360-native-icon-button" onClick={() => void refreshSessions()} title="Refresh classes"><RefreshCw size={16}/></button></header>
          <div className="ed360-native-session-list">
            {loading ? <p className="ed360-native-muted">Loading your classes…</p> : classSessions.length ? classSessions.map(session => {
              return <article className="ed360-native-session-card" key={session.id}>
                <div className="type-icon class"><Video size={17}/></div>
                <div className="details"><b>{session.title}</b><small>{formatSessionTime(session.starts_at)}</small><span className={'status ' + session.status}>{session.status.replace('_',' ')}</span></div>
                {session.status !== 'ended' && session.status !== 'cancelled' && <button type="button" onClick={() => void joinSession(session.id)} disabled={busy || !serverConfigured}>{session.status === 'live' ? 'Join live' : 'Join class'}</button>}
              </article>
            }) : <p className="ed360-native-muted">No online classes have been scheduled for your accessible classes.</p>}
          </div>
        </section>
      </div>}
    </>}

  </main>
}
