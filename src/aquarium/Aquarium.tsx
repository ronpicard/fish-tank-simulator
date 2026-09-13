import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createSchool, createBottomLife, seededRandom, stepSchool, stepBottomLife, type Swimmer } from './simulation'
import { vertexShader, reefFragment, foregroundFragment, fishVertex, fishFragment, creatureVertex, particleVertex, particleFragment } from './shaders'

export type Mood = 'day' | 'dusk' | 'night'
export interface AquariumOptions { paused: boolean; mood: Mood; current: number; population: number; light: number }
interface Props { options: AquariumOptions; onReady: () => void }
const assets = `${import.meta.env.BASE_URL}assets/`
// Pixel bounds preserve the cardinal's long fins and exclude neighboring atlas animals.
const fishRects = [
  [8, 125, 414, 385], [424, 14, 833, 437], [841, 142, 1253, 390],
  [8, 432, 415, 793], [424, 526, 833, 767], [834, 530, 1253, 780],
  [8, 902, 417, 1178], [424, 897, 830, 1189], [835, 924, 1250, 1170],
]
const creatureRects = [[0, 18, 674, 680], [707, 275, 1241, 600], [17, 714, 625, 1198], [679, 731, 1238, 1167]]
const uvRect = (rect: number[]) => new THREE.Vector4(rect[0] / 1254, 1 - rect[3] / 1254, (rect[2] - rect[0]) / 1254, (rect[3] - rect[1]) / 1254)
const rectAspect = (rect: number[]) => (rect[3] - rect[1]) / (rect[2] - rect[0])

class Reef {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30)
  options: AquariumOptions
  swimmers: Swimmer[] = createSchool(9)
  bottomLife = createBottomLife()
  fish: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  creatures: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  textures: THREE.Texture[] = []
  background: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  foreground: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null
  aspect = 1
  time = 0
  mood = 0
  frame = 0
  previous = 0
  disposed = false
  observer: ResizeObserver
  onError: () => void

  constructor(private container: HTMLDivElement, options: AquariumOptions, onError: () => void) {
    this.options = { ...options }
    this.onError = onError
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setClearColor(0x100f0f)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.setAttribute('aria-label', 'A small glass aquarium at home with distinct tropical fish, a cleaner shrimp, a snail, a hermit crab, and a starfish')
    this.renderer.domElement.setAttribute('role', 'img')
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost)
    container.appendChild(this.renderer.domElement)
    this.camera.position.z = 10
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(container)
    document.addEventListener('visibilitychange', this.visibility)
    this.resize()
  }

  async load() {
    const loader = new THREE.TextureLoader()
    // Track each successful load immediately so partial failures can also be disposed.
    const loadTexture = async (name: string) => {
      const texture = await loader.loadAsync(assets + name)
      if (this.disposed) texture.dispose()
      else this.textures.push(texture)
      return texture
    }
    const [reef, atlas, invertebrates] = await Promise.all([
      loadTexture('home-tank.png'), loadTexture('home-fish.png'), loadTexture('home-creatures.png'),
    ])
    if (this.disposed) return
    this.background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader, fragmentShader: reefFragment,
      uniforms: {
        uTexture: { value: reef }, uTime: { value: 0 }, uMood: { value: 0 }, uLight: { value: 1 },
      }, depthWrite: false,
    }))
    this.background.position.z = -5
    this.background.renderOrder = -10
    this.background.scale.x = this.aspect
    this.scene.add(this.background)

    this.swimmers.forEach(swimmer => {
      const rect = fishRects[swimmer.species]
      const geometry = new THREE.PlaneGeometry(1, rectAspect(rect), 28, 16)
      const material = new THREE.ShaderMaterial({
        vertexShader: fishVertex, fragmentShader: fishFragment,
        uniforms: {
          uTexture: { value: atlas }, uTime: { value: 0 }, uPhase: { value: swimmer.phase }, uActivity: { value: 0.5 },
          uUvRect: { value: uvRect(rect) },
          uDepth: { value: swimmer.depth }, uMood: { value: 0 }, uLight: { value: 1 },
        }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.renderOrder = 3 + Math.round((1 - swimmer.depth) * 10)
      this.fish.push(mesh)
      this.scene.add(mesh)
    })

    this.foreground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader, fragmentShader: foregroundFragment,
      uniforms: { uTexture: { value: reef }, uMood: { value: 0 }, uLight: { value: 1 } },
      transparent: true, depthWrite: false,
    }))
    this.foreground.scale.x = this.aspect
    this.foreground.renderOrder = 5
    this.scene.add(this.foreground)

    for (let i = 0; i < 4; i++) {
      const rect = creatureRects[i]
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, rectAspect(rect), 18, 18), new THREE.ShaderMaterial({
        vertexShader: creatureVertex, fragmentShader: fishFragment,
        uniforms: {
          uTexture: { value: invertebrates }, uTime: { value: 0 }, uKind: { value: i },
          uUvRect: { value: uvRect(rect) }, uDepth: { value: 0.2 }, uMood: { value: 0 }, uLight: { value: 1 },
        },
        transparent: true, depthWrite: false,
      }))
      mesh.renderOrder = 16
      this.creatures.push(mesh)
      this.scene.add(mesh)
    }
    const random = seededRandom(123)
    const positions = [], sizes = [], phases = []
    for (let i = 0; i < 28; i++) {
      positions.push(random() * 2 - 1, random() * 2 - 1, 0)
      sizes.push(1.3 + random() * 2.1)
      phases.push(random())
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    particleGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    particleGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
    this.particles = new THREE.Points(particleGeometry, new THREE.ShaderMaterial({
      vertexShader: particleVertex, fragmentShader: particleFragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() }, uAspect: { value: this.aspect } },
      transparent: true, depthWrite: false,
    }))
    this.particles.frustumCulled = false
    this.particles.renderOrder = 20
    this.scene.add(this.particles)
    this.animate(performance.now())
  }

  resize = () => {
    const { width, height } = this.container.getBoundingClientRect()
    this.aspect = Math.max(width, 1) / Math.max(height, 1)
    this.camera.left = -this.aspect
    this.camera.right = this.aspect
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    if (this.background) {
      this.background.scale.x = this.aspect
    }
    if (this.foreground) this.foreground.scale.x = this.aspect
    if (this.particles) this.particles.material.uniforms.uAspect.value = this.aspect
  }

  contextLost = (event: Event) => {
    event.preventDefault()
    this.onError()
    this.dispose()
  }

  visibility = () => {
    cancelAnimationFrame(this.frame)
    if (!document.hidden && !this.disposed) {
      this.previous = 0
      this.frame = requestAnimationFrame(this.animate)
    }
  }

  animate = (now: number) => {
    if (this.disposed) return
    const dt = this.previous ? Math.min((now - this.previous) / 1000, 0.05) : 0
    this.previous = now
    const { paused, current, population, light } = this.options
    const desiredMood = this.options.mood === 'day' ? 0 : this.options.mood === 'dusk' ? 1 : 2
    this.mood = THREE.MathUtils.damp(this.mood, desiredMood, 2.5, dt)
    const activeFish = this.swimmers.slice(0, population)
    if (!paused) {
      this.time += dt * current
      stepSchool(activeFish, dt, this.time, current)
      stepBottomLife(this.bottomLife, dt, current)
    }
    if (this.background) {
      this.background.material.uniforms.uTime.value = this.time
      this.background.material.uniforms.uMood.value = this.mood
      this.background.material.uniforms.uLight.value = light
    }
    if (this.foreground) {
      this.foreground.material.uniforms.uMood.value = this.mood
      this.foreground.material.uniforms.uLight.value = light
    }
    this.fish.forEach((mesh, i) => {
      mesh.visible = i < population
      if (!mesh.visible) return
      const swimmer = this.swimmers[i]
      const size = swimmer.size * (1 - swimmer.depth * 0.22)
      mesh.position.set((swimmer.x * 2 - 1) * this.aspect, 1 - swimmer.y * 2, 1 - swimmer.depth)
      // A smooth narrowing body suggests yaw as the individual turns around.
      const facing = Math.sign(swimmer.facing || 1) * (0.16 + Math.abs(swimmer.facing) * 0.84)
      mesh.scale.set(size * facing, size, 1)
      mesh.rotation.z = THREE.MathUtils.clamp(-swimmer.vy * Math.sign(swimmer.vx) * 6, -0.22, 0.22)
      mesh.renderOrder = swimmer.depth > 0.56 ? 3 : 8 + Math.round((1 - swimmer.depth) * 5)
      mesh.material.uniforms.uTime.value = swimmer.finTime
      mesh.material.uniforms.uActivity.value = swimmer.activity
      mesh.material.uniforms.uDepth.value = swimmer.depth
      mesh.material.uniforms.uMood.value = this.mood
      mesh.material.uniforms.uLight.value = light
    })
    this.creatures.forEach((mesh, i) => {
      const animal = this.bottomLife[i]
      const { x, y } = animal
      const size = [0.205, 0.083, 0.115, 0.118][i]
      mesh.position.set((x * 2 - 1) * this.aspect, 1 - y * 2, 1.2)
      mesh.scale.setScalar(size)
      mesh.rotation.z = i === 0 ? Math.sin(animal.localTime * 0.035) * 0.04 : 0
      mesh.material.uniforms.uTime.value = animal.localTime
      mesh.material.uniforms.uMood.value = this.mood
      mesh.material.uniforms.uLight.value = light
    })
    if (this.particles) this.particles.material.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.camera)
    if (!document.hidden) this.frame = requestAnimationFrame(this.animate)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    document.removeEventListener('visibilitychange', this.visibility)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost)
    const geometries = new Set<THREE.BufferGeometry>()
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry)
        object.material.dispose()
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    this.textures.forEach(texture => texture.dispose())
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

export default function Aquarium({ options, onReady }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<Reef | null>(null)
  const initialOptions = useRef(options)
  const readyCallback = useRef(onReady)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let reef: Reef | undefined
    setError(false)
    try {
      reef = new Reef(container.current!, initialOptions.current, () => { if (active) setError(true) })
      instance.current = reef
      reef.load().then(() => { if (active) readyCallback.current() }).catch(() => {
        reef?.dispose()
        if (active) { setError(true); readyCallback.current() }
      })
    } catch {
      setError(true)
      readyCallback.current()
    }
    return () => { active = false; reef?.dispose(); instance.current = null }
  }, [attempt])
  useEffect(() => {
    initialOptions.current = options
    if (instance.current) instance.current.options = options
  }, [options])
  return <>
    <div className="aquarium" ref={container} style={{ backgroundImage: `url(${assets}home-tank.png)` }} />
    {error && <div className="render-error" role="alert">
      <span>The reef is still here. Live animation couldn’t start in this browser.</span>
      <button onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div>}
  </>
}
