import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, ShieldCheck, Volume2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/openai-voice-workspace.css'

type VoiceLine = { id: number; speaker: 'You' | 'EduSphere AI'; text: string }

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = () => {
      if (peer.iceGatheringState !== 'complete') return
      peer.removeEventListener('icegatheringstatechange', done)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', done)
    done()
  })
}

export function OpenAIVoiceWorkspace({ onToast }: { onToast: (message: string, error?: boolean) => void }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [lines, setLines] = useState<VoiceLine[]>([])
  const [sessionId, setSessionId] = useState('')
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lineIdRef = useRef(0)

  const canCall = Boolean(user && ['owner', 'admin', 'teacher'].includes(user.role))

  const transcriptLineIdsRef = useRef<Partial<Record<VoiceLine['speaker'], number>>>({})

  function appendTranscript(speaker: VoiceLine['speaker'], delta: string) {
    if (!delta) return
    const existingId = transcriptLineIdsRef.current[speaker]
    if (existingId !== undefined) {
      setLines(current => current.map(line => line.id === existingId ? { ...line, text: line.text + delta } : line))
      return
    }
    lineIdRef.current += 1
    const nextId = lineIdRef.current
    transcriptLineIdsRef.current[speaker] = nextId
    setLines(current => [...current, { id: nextId, speaker, text: delta }].slice(-30))
  }

  function endCall() {
    peerRef.current?.getSenders().forEach(sender => sender.track?.stop())
    peerRef.current?.close()
    peerRef.current = null
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.srcObject = null
    }
    setMuted(false)
    setSessionId('')
    setStatus('ended')
  }

  useEffect(() => () => {
    peerRef.current?.close()
    localStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function startCall() {
    if (!supabase || !user || !canCall) {
      setError('Your account is not permitted to start an OpenAI voice session.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError('This browser does not support secure microphone and WebRTC calling. Use the latest browser over HTTPS.')
      return
    }

    setError('')
    setLines([])
    transcriptLineIdsRef.current = {}
    setStatus('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      localStreamRef.current = stream

      const peer = new RTCPeerConnection()
      peerRef.current = peer
      stream.getAudioTracks().forEach(track => peer.addTrack(track, stream))

      peer.ontrack = event => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track])
          void audioRef.current.play().catch(() => setError('Your browser blocked audio playback. Press the audio play control below.'))
        }
      }
      peer.onconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(peer.connectionState)) {
          setError('The voice connection was interrupted. End the call and try again.')
        }
        if (peer.connectionState === 'closed') setStatus('ended')
      }

      const channel = peer.createDataChannel('oai-events')
      channel.onmessage = event => {
        try {
          const payload = JSON.parse(String(event.data))
          const kind = String(payload.type ?? '')
          if (kind === 'session.started') {
            setStatus('connected')
          } else if (kind === 'session.input_transcript.delta') {
            appendTranscript('You', String(payload.delta ?? ''))
          } else if (kind === 'session.output_transcript.delta') {
            appendTranscript('EduSphere AI', String(payload.delta ?? ''))
          } else if (kind === 'session.closed') {
            setStatus('ended')
          } else if (kind === 'error' || kind === 'session.error') {
            setError(String(payload.error?.message ?? payload.message ?? 'The voice service returned an error.'))
          }
        } catch {
          // Ignore non-JSON transport frames.
        }
      }

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await waitForIceGathering(peer)
      const offerSdp = peer.localDescription?.sdp
      if (!offerSdp) throw new Error('The browser did not produce a WebRTC offer.')

      const { data, error: invokeError } = await supabase.functions.invoke('openai-live-session', {
        body: { institutionId: user.institutionId, sdp: offerSdp },
      })
      if (invokeError || data?.error) {
        throw new Error(String(data?.error ?? invokeError?.message ?? 'OpenAI could not start the voice session.'))
      }
      const answerSdp = data?.transport?.sdp
      if (typeof answerSdp !== 'string' || !answerSdp) throw new Error('OpenAI returned an incomplete session answer.')
      setSessionId(String(data?.session?.id ?? ''))
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (caught) {
      endCall()
      const message = caught instanceof Error ? caught.message : 'The voice call could not be started.'
      setError(message)
      onToast(message, true)
    }
  }

  function toggleMute() {
    const next = !muted
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next })
    setMuted(next)
  }

  return <main className="page-content ed360-module-page ed360-openai-voice">
    <header className="ed360-openai-voice-header">
      <div>
        <span>COMMUNICATION / OPENAI LIVE</span>
        <h1>Internet Voice Calling</h1>
        <p>Talk with the EduSphere AI assistant in a live, browser-based voice session.</p>
      </div>
      <div className={'ed360-openai-voice-status ' + status}><i />{status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'ended' ? 'Call ended' : 'Ready to call'}</div>
    </header>

    <section className="ed360-openai-voice-card">
      <div className="ed360-openai-voice-orb"><Volume2 size={30}/></div>
      <h2>{status === 'connected' ? 'You are on a live voice call' : status === 'connecting' ? 'Preparing secure voice connection' : 'Start a voice call with EduSphere AI'}</h2>
      <p>Microphone access is requested only after you press Start. Audio is streamed to OpenAI for the live session; the website does not save a local audio recording.</p>
      {!canCall && <div className="ed360-openai-voice-alert">Your account role cannot start voice sessions. Ask an institution administrator for access.</div>}
      {error && <div className="ed360-openai-voice-alert" role="alert">{error}</div>}
      <div className="ed360-openai-voice-controls">
        {status === 'connected' || status === 'connecting'
          ? <button type="button" className="danger" onClick={endCall}><PhoneOff size={17}/> End call</button>
          : <button type="button" className="primary" onClick={() => void startCall()} disabled={!canCall}><Phone size={17}/> Start voice call</button>}
        <button type="button" className="secondary" onClick={toggleMute} disabled={status !== 'connected'}><>{muted ? <MicOff size={16}/> : <Mic size={16}/>} {muted ? 'Unmute microphone' : 'Mute microphone'}</></button>
      </div>
      <audio ref={audioRef} autoPlay controls aria-label="EduSphere AI voice audio"/>
      {sessionId && <small className="ed360-openai-voice-session">Session reference: {sessionId}</small>}
    </section>

    <section className="ed360-openai-voice-transcript">
      <header><div><b>Live transcript</b><small>Only transcript text returned by the voice service is shown here.</small></div><button type="button" onClick={() => setLines([])} disabled={!lines.length}>Clear transcript</button></header>
      {lines.length ? <div className="ed360-openai-voice-lines">{lines.map(line => <p key={line.id}><b>{line.speaker}</b><span>{line.text}</span></p>)}</div> : <p className="empty">Your conversation transcript will appear here when the voice service sends transcript events.</p>}
    </section>

    <footer className="ed360-openai-voice-note"><ShieldCheck size={17}/><span><b>Privacy and account requirements</b> A server-side OpenAI API key is required in Supabase Edge Function secrets. The browser never receives that key. This page currently provides AI voice calls; calls between staff/families or to ordinary telephone numbers require a separate institution calling/SIP provider and approved contact directory.</span></footer>
  </main>
}
