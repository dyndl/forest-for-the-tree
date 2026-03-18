'use client'
import { useState, useRef, useEffect } from 'react'

// ── MEDIA UPLOADER COMPONENT ──────────────────────────────────────────────────
// Drop into any agent card to give it voice/file/camera input

export default function MediaUploader({ agentId, agentName, onResult }) {
  const [mode, setMode] = useState(null) // 'record' | 'upload' | 'camera'
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [uploads, setUploads] = useState([])
  const [loadingUploads, setLoadingUploads] = useState(false)
  const [context, setContext] = useState('')
  const [showUploads, setShowUploads] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      stopRecording()
    }
  }, [])

  // ── LOAD PAST UPLOADS ──────────────────────────────────────────────────────
  async function loadUploads() {
    setLoadingUploads(true)
    const res = await fetch(`/api/media?agent_id=${agentId}&limit=10`)
    const data = await res.json()
    setUploads(data.uploads || [])
    setLoadingUploads(false)
  }

  // ── VOICE RECORDING ────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop())
      recorder.start(1000) // collect chunks every second

      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      alert('Microphone access denied. Please allow microphone in Safari Settings.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function finishRecording() {
    stopRecording()
    await new Promise(r => setTimeout(r, 500)) // wait for final chunk

    const blob = new Blob(chunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm'
    })
    await processFile(blob, `voice_memo_${new Date().toLocaleTimeString()}.webm`, 'audio')
  }

  // ── FILE PROCESSING ────────────────────────────────────────────────────────
  async function processFile(file, name, typeHint) {
    setProcessing(true)
    setMode(null)

    const formData = new FormData()
    formData.append('file', file, name || file.name)
    formData.append('agent_id', agentId)
    formData.append('context', context || `For ${agentName}`)
    if (typeHint) formData.append('type', typeHint)

    try {
      const res = await fetch('/api/media', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.result) {
        onResult && onResult(data.result)
        setContext('')
        // Refresh uploads list if visible
        if (showUploads) loadUploads()
      }
    } catch (err) {
      console.error('Upload error:', err)
    }
    setProcessing(false)
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file, file.name)
    e.target.value = ''
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: '0 11px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Context input */}
      {mode && (
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder={`Context for ${agentName}… (optional)`}
          style={{ background: 'rgba(255,255,255,.65)', border: '1px solid var(--gb2)', borderRadius: 6, padding: '6px 9px', fontSize: 11.5, fontFamily: 'var(--f)', color: 'var(--txt)', outline: 'none', width: '100%' }}
        />
      )}

      {/* Recording UI */}
      {mode === 'record' && (
        <div style={{ background: 'var(--glass2)', border: '1px solid var(--gb2)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {recording && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53e3e', animation: 'blink .8s infinite', flexShrink: 0 }} />
            )}
            <span style={{ fontFamily: 'var(--m)', fontSize: 11, color: recording ? '#e53e3e' : 'var(--txt3)' }}>
              {recording ? `Recording — ${fmtTime(recordingTime)}` : 'Ready to record'}
            </span>
            {recordingTime > 0 && !recording && (
              <span style={{ fontFamily: 'var(--m)', fontSize: 9, color: 'var(--txt3)' }}>recorded {fmtTime(recordingTime)}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!recording ? (
              <button onClick={startRecording}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(15,110,86,.3)', background: 'rgba(15,110,86,.1)', color: 'var(--ok)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--f)', fontWeight: 500 }}>
                ⏺ Start recording
              </button>
            ) : (
              <button onClick={finishRecording}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(138,40,40,.3)', background: 'rgba(138,40,40,.1)', color: 'var(--danger)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--f)', fontWeight: 500 }}>
                ⏹ Stop + transcribe
              </button>
            )}
            <button onClick={() => { stopRecording(); setMode(null) }}
              style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--gb2)', background: 'transparent', color: 'var(--txt3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--f)' }}>
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--txt3)', fontFamily: 'var(--m)' }}>
            Works for live ideas · voice memos · humming a melody
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {processing && (
        <div style={{ background: 'var(--glass2)', border: '1px solid var(--gb2)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--m)', fontSize: 11, color: 'var(--txt2)' }}>
          <div className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} />
          Transcribing + extracting ideas…
        </div>
      )}

      {/* Action buttons */}
      {!processing && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setMode(mode === 'record' ? null : 'record')}
            style={{ flex: 1, minWidth: 80, padding: '6px 8px', borderRadius: 6, border: `1px solid ${mode === 'record' ? 'rgba(15,110,86,.35)' : 'var(--gb2)'}`, background: mode === 'record' ? 'rgba(15,110,86,.1)' : 'var(--glass2)', color: mode === 'record' ? 'var(--ok)' : 'var(--txt2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--f)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            🎙 Record
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, minWidth: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--gb2)', background: 'var(--glass2)', color: 'var(--txt2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--f)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            📎 Upload file
          </button>

          <button onClick={() => cameraInputRef.current?.click()}
            style={{ flex: 1, minWidth: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--gb2)', background: 'var(--glass2)', color: 'var(--txt2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--f)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            📷 Camera
          </button>

          <button onClick={() => { setShowUploads(!showUploads); if (!showUploads) loadUploads() }}
            style={{ flex: 1, minWidth: 80, padding: '6px 8px', borderRadius: 6, border: `1px solid ${showUploads ? 'rgba(26,95,168,.3)' : 'var(--gb2)'}`, background: showUploads ? 'rgba(26,95,168,.08)' : 'var(--glass2)', color: showUploads ? 'var(--sch)' : 'var(--txt2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--f)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            🗂 Backlog
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm,video/mp4,image/*,.pdf,.txt,.md"
        style={{ display: 'none' }} onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file"
        accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* Uploads backlog */}
      {showUploads && (
        <div style={{ background: 'var(--glass2)', border: '1px solid var(--gb2)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--gb2)', fontFamily: 'var(--m)', fontSize: 9, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            {agentName} backlog
          </div>
          {loadingUploads ? (
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--m)' }}>
              <div className="spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} />Loading…
            </div>
          ) : uploads.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--m)' }}>
              No uploads yet for {agentName}
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {uploads.map(u => (
                <UploadCard key={u.id} upload={u} onSelect={() => onResult && onResult(u)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── UPLOAD CARD ───────────────────────────────────────────────────────────────
function UploadCard({ upload, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  const ideas = upload.extracted_ideas
  const typeIcon = { audio: '🎙', image: '📷', pdf: '📄', document: '📝' }[upload.type] || '📎'

  return (
    <div style={{ borderBottom: '1px solid var(--gb2)', padding: '8px 10px', cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ideas?.title || upload.filename}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--txt3)', fontFamily: 'var(--m)', marginTop: 1 }}>
            {upload.type} · {upload.duration_seconds ? `${Math.round(upload.duration_seconds / 60)}m ` : ''}{new Date(upload.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        {ideas?.mood && (
          <span style={{ fontFamily: 'var(--m)', fontSize: 8.5, padding: '2px 6px', borderRadius: 3, background: 'rgba(106,40,120,.08)', color: '#6a2878', flexShrink: 0 }}>
            {ideas.mood}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--txt3)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
          {ideas ? (
            <>
              {ideas.lyric_fragments?.length > 0 && (
                <div>
                  <div style={{ fontSize: 8.5, fontFamily: 'var(--m)', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Lyric fragments</div>
                  {ideas.lyric_fragments.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--txt2)', fontStyle: 'italic', padding: '2px 0', borderLeft: '2px solid rgba(106,40,120,.3)', paddingLeft: 7 }}>{l}</div>
                  ))}
                </div>
              )}
              {ideas.melodic_ideas?.length > 0 && (
                <div>
                  <div style={{ fontSize: 8.5, fontFamily: 'var(--m)', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Melodic ideas</div>
                  {ideas.melodic_ideas.map((m, i) => <div key={i} style={{ fontSize: 11, color: 'var(--txt2)' }}>• {m}</div>)}
                </div>
              )}
              {ideas.production_notes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 8.5, fontFamily: 'var(--m)', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Production</div>
                  {ideas.production_notes.map((p, i) => <div key={i} style={{ fontSize: 11, color: 'var(--txt2)' }}>• {p}</div>)}
                </div>
              )}
              {ideas.next_actions?.length > 0 && (
                <div style={{ background: 'var(--del-bg)', border: '1px solid var(--del-bd)', borderRadius: 5, padding: '6px 8px' }}>
                  <div style={{ fontSize: 8.5, fontFamily: 'var(--m)', color: 'var(--del)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Next actions</div>
                  {ideas.next_actions.map((a, i) => <div key={i} style={{ fontSize: 11, color: 'var(--txt2)' }}>→ {a}</div>)}
                </div>
              )}
              {ideas.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ideas.tags.map((t, i) => (
                    <span key={i} style={{ fontFamily: 'var(--m)', fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'var(--glass2)', border: '1px solid var(--gb2)', color: 'var(--txt3)' }}>{t}</span>
                  ))}
                </div>
              )}
            </>
          ) : upload.transcript ? (
            <div style={{ fontSize: 11, color: 'var(--txt2)', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto', fontFamily: 'var(--m)' }}>
              {upload.transcript.slice(0, 500)}{upload.transcript.length > 500 ? '…' : ''}
            </div>
          ) : upload.analysis ? (
            <div style={{ fontSize: 11, color: 'var(--txt2)', lineHeight: 1.6 }}>{upload.analysis}</div>
          ) : null}

          <button onClick={() => onSelect(upload)}
            style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 5, border: '1px solid var(--gb2)', background: 'var(--glass)', color: 'var(--txt2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--f)' }}>
            Send to {' '}agent →
          </button>
        </div>
      )}
    </div>
  )
}
