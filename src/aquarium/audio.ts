export type AudioStatus = 'waiting' | 'playing' | 'muted' | 'unavailable'

/** A close aquarium: soft pump vibration, circulating water, and irregular aerator bubbles. */
export class AquariumAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sources: AudioScheduledSourceNode[] = []
  private nodes: AudioNode[] = []
  private bubbles = new Set<OscillatorNode>()
  private enabled = true
  private timer: ReturnType<typeof setInterval> | undefined
  private nextBubble = 0
  private disposed = false

  constructor(private onStatus: (status: AudioStatus) => void = () => {}) {}

  private initialize() {
    if (this.context || this.disposed) return
    const context = new AudioContext({ latencyHint: 'playback' })
    this.context = context
    const master = context.createGain()
    master.gain.value = 0
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.ratio.value = 3
    master.connect(compressor).connect(context.destination)
    this.master = master
    this.nodes.push(master, compressor)

    // A long, quiet stereo bed. Seam endpoints fade to zero, so there is no loop click.
    const buffer = context.createBuffer(2, context.sampleRate * 19, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let brown = 0
      for (let i = 0; i < data.length; i++) {
        const noise = Math.random() * 2 - 1
        brown = (brown + 0.017 * noise) / 1.017
        const edge = Math.min(1, i / 1800, (data.length - 1 - i) / 1800)
        data[i] = (brown * 2.2 + noise * 0.085) * edge
      }
    }
    const water = context.createBufferSource()
    water.buffer = buffer
    water.loop = true
    const circulation = context.createBiquadFilter()
    circulation.type = 'lowpass'
    circulation.frequency.value = 780
    circulation.Q.value = 0.45
    const waterLevel = context.createGain()
    waterLevel.gain.value = 0.44
    water.connect(circulation).connect(waterLevel).connect(master)
    water.start()
    this.sources.push(water)
    this.nodes.push(water, circulation, waterLevel)

    // Mechanical vibration stays barely audible, with a soft higher harmonic.
    for (const [frequency, volume] of [[57, 0.009], [114, 0.0035]]) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const level = context.createGain()
      level.gain.value = volume
      oscillator.connect(level).connect(master)
      oscillator.start()
      this.sources.push(oscillator)
      this.nodes.push(oscillator, level)
    }
    const modulation = context.createOscillator()
    modulation.frequency.value = 0.17
    const modulationLevel = context.createGain()
    modulationLevel.gain.value = 0.035
    modulation.connect(modulationLevel).connect(waterLevel.gain)
    modulation.start()
    this.sources.push(modulation)
    this.nodes.push(modulation, modulationLevel)
    context.onstatechange = () => this.syncStatus()
    this.timer = setInterval(() => this.scheduleBubbles(), 200)
    this.nextBubble = context.currentTime + 0.8
  }

  private syncStatus() {
    if (!this.context || this.disposed) return
    const running = this.context.state === 'running'
    this.master?.gain.setTargetAtTime(this.enabled && running ? 0.48 : 0, this.context.currentTime, 0.35)
    this.onStatus(!this.enabled ? 'muted' : running ? 'playing' : 'waiting')
  }

  private bubble(at: number, small: boolean) {
    const context = this.context!
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const panner = context.createStereoPanner()
    const frequency = (small ? 1200 : 620) + Math.random() * 500
    const duration = small ? 0.075 : 0.16
    oscillator.frequency.setValueAtTime(frequency, at)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.46, at + duration)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(small ? 0.015 : 0.025, at + 0.006)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    panner.pan.value = 0.28 + Math.random() * 0.30
    oscillator.connect(envelope).connect(panner).connect(this.master!)
    this.bubbles.add(oscillator)
    oscillator.onended = () => {
      oscillator.disconnect(); envelope.disconnect(); panner.disconnect()
      this.bubbles.delete(oscillator)
    }
    oscillator.start(at)
    oscillator.stop(at + duration + 0.03)
  }

  private scheduleBubbles() {
    const context = this.context
    if (!context || this.disposed || !this.enabled || context.state !== 'running') return
    if (context.currentTime + 0.35 < this.nextBubble) return
    const at = Math.max(this.nextBubble, context.currentTime + 0.02)
    this.bubble(at, false)
    if (Math.random() < 0.55) this.bubble(at + 0.065 + Math.random() * 0.07, true)
    this.nextBubble = at + 0.7 + Math.random() * 2.6
  }

  /** Do not await resume: a browser may leave the autoplay promise pending until a gesture. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.disposed) return
    try {
      if (enabled) this.initialize()
      this.syncStatus()
      if (enabled && this.context && !document.hidden) {
        const context = this.context
        void context.resume().then(() => {
          if (this.context === context && !this.disposed) this.syncStatus()
        }).catch(() => { if (!this.disposed) this.onStatus('waiting') })
      }
    } catch { this.onStatus('unavailable') }
  }

  unlock = () => { if (this.enabled) this.setEnabled(true) }

  visibility = () => {
    if (!this.context || this.disposed) return
    if (document.hidden) void this.context.suspend().catch(() => {})
    else if (this.enabled) this.unlock()
  }

  dispose() {
    this.disposed = true
    clearInterval(this.timer)
    if (this.context) this.context.onstatechange = null
    this.bubbles.forEach(source => { try { source.stop() } catch { /* already ended */ } })
    this.sources.forEach(source => source.stop())
    this.nodes.forEach(node => node.disconnect())
    void this.context?.close().catch(() => {})
    this.context = null
    this.master = null
  }
}
