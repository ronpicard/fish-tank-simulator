export type AudioStatus = 'waiting' | 'playing' | 'muted' | 'unavailable'

const recordingUrl = `${import.meta.env.BASE_URL}assets/aquarium-filter.mp3`

/** A softly mixed, seamless loop of DudeAwesome's real aquarium-filter recording. */
export class AquariumAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private loadAbort: AbortController | null = null
  private failed = false
  private enabled = true
  private disposed = false

  constructor(private onStatus: (status: AudioStatus) => void = () => {}) {}

  private initialize() {
    if (this.context || this.disposed) return
    const context = new AudioContext({ latencyHint: 'playback' })
    this.context = context
    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)
    this.master = master
    context.onstatechange = () => this.syncStatus()
  }

  private async loadRecording() {
    const context = this.context
    if (!context || this.source || this.loadAbort || this.disposed) return
    const controller = new AbortController()
    this.loadAbort = controller
    this.failed = false
    try {
      const response = await fetch(recordingUrl, { signal: controller.signal })
      if (!response.ok) throw new Error(`Aquarium recording: ${response.status}`)
      const bytes = await response.arrayBuffer()
      if (this.disposed || this.context !== context) return
      const buffer = await context.decodeAudioData(bytes)
      if (this.disposed || this.context !== context) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(this.master!)
      source.start()
      this.source = source
      this.syncStatus()
    } catch {
      if (!this.disposed && this.context === context) {
        this.failed = true
        this.syncStatus()
      }
    } finally {
      if (this.loadAbort === controller) this.loadAbort = null
    }
  }

  private syncStatus() {
    if (this.disposed) return
    const running = this.context?.state === 'running' && !document.hidden && Boolean(this.source)
    if (this.context) {
      this.master?.gain.setTargetAtTime(this.enabled && running ? 0.55 : 0, this.context.currentTime, 0.25)
    }
    this.onStatus(!this.enabled ? 'muted' : this.failed ? 'unavailable' : running ? 'playing' : 'waiting')
  }

  /** Resume inside the gesture; fetching and decoding must not delay the autoplay unlock. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.disposed) return
    try {
      if (enabled) this.initialize()
      if (enabled && this.context && !document.hidden) {
        const context = this.context
        void context.resume().then(() => {
          if (this.context === context && !this.disposed) this.syncStatus()
        }).catch(() => { if (!this.disposed) this.syncStatus() })
      }
      if (enabled) void this.loadRecording()
      this.syncStatus()
    } catch {
      this.failed = true
      this.syncStatus()
    }
  }

  unlock = () => { if (this.enabled) this.setEnabled(true) }

  visibility = () => {
    if (!this.context || this.disposed) return
    this.syncStatus()
    if (document.hidden) void this.context.suspend().catch(() => {})
    else if (this.enabled) this.unlock()
  }

  dispose() {
    this.disposed = true
    this.loadAbort?.abort()
    this.loadAbort = null
    if (this.context) this.context.onstatechange = null
    this.source?.stop()
    this.source?.disconnect()
    this.master?.disconnect()
    void this.context?.close().catch(() => {})
    this.source = null
    this.context = null
    this.master = null
  }
}
