import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type WaveSurfer from 'wavesurfer.js'
import { unwrapIpc } from '../../lib/ipc'

interface NarrationWaveformProps {
  projectId: string
  takeId: string | null
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

export function NarrationWaveform({ projectId, takeId }: NarrationWaveformProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveRef = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let wave: WaveSurfer | null = null
    setReady(false)
    setPlaying(false)
    setTime(0)
    setDuration(0)
    setError(null)

    const container = containerRef.current
    if (!container || !takeId || !window.electronAPI) return

    void (async () => {
      try {
        const [{ default: WaveSurferRuntime }, audioResult] = await Promise.all([
          import('wavesurfer.js'),
          window.electronAPI!.narrationReadAudio({ projectId, takeId })
        ])
        if (disposed) return

        wave = WaveSurferRuntime.create({
          container,
          height: 76,
          normalize: true,
          cursorWidth: 1,
          barWidth: 2,
          barGap: 1,
          barRadius: 2
        })
        waveRef.current = wave

        wave.on('ready', () => {
          if (disposed || !wave) return
          setReady(true)
          setDuration(wave.getDuration())
        })
        wave.on('timeupdate', (value) => {
          if (!disposed) setTime(value)
        })
        wave.on('play', () => !disposed && setPlaying(true))
        wave.on('pause', () => !disposed && setPlaying(false))
        wave.on('finish', () => !disposed && setPlaying(false))
        wave.on('error', (event) => {
          if (!disposed) setError(event instanceof Error ? event.message : 'Lecture audio impossible')
        })

        const audio = unwrapIpc(audioResult)
        await wave.loadBlob(base64ToBlob(audio.base64, audio.mimeType))
      } catch (loadError) {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : 'Audio narration indisponible')
      }
    })()

    return () => {
      disposed = true
      waveRef.current = null
      wave?.destroy()
    }
  }, [projectId, takeId])

  async function togglePlayback(): Promise<void> {
    if (!waveRef.current || !ready) return
    await waveRef.current.playPause()
  }

  function restart(): void {
    if (!waveRef.current || !ready) return
    waveRef.current.seekTo(0)
  }

  return (
    <div className="narration-waveform-shell">
      <div ref={containerRef} className="narration-waveform" aria-label="Forme d’onde de la narration" />
      {!takeId && <p className="narration-wave-placeholder">Sélectionnez une prise pour l’écouter.</p>}
      {error && <p className="narration-wave-error" role="alert">{error}</p>}
      <div className="narration-player-controls">
        <button className="icon-btn" onClick={() => void togglePlayback()} disabled={!ready} title={playing ? 'Pause' : 'Lire'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button className="icon-btn" onClick={restart} disabled={!ready} title="Retour au début">
          <RotateCcw size={14} />
        </button>
        <span>{time.toFixed(1)} s / {duration.toFixed(1)} s</span>
      </div>
    </div>
  )
}
