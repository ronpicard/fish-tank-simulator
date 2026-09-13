import * as THREE from 'three'
import { createBodyGeometry, createShellGeometry, createStarGeometry } from './animalGeometry.ts'

export interface AnimalModel {
  root: THREE.Group
  animate: (time: number, activity: number) => void
  setOrder: (order: number) => void
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const wet = (color: THREE.ColorRepresentation, roughness = 0.42) => new THREE.MeshPhysicalMaterial({
  color, roughness, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.31,
  transparent: true, depthWrite: true, envMapIntensity: 0.22,
})
function ellipsoid(parent: THREE.Object3D, material: THREE.Material, center: THREE.Vector3, scale: THREE.Vector3) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material)
  mesh.position.copy(center); mesh.scale.copy(scale); parent.add(mesh)
  return mesh
}
function curve(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 18) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 6, false), material)
  parent.add(mesh)
  return mesh
}
function fan(parent: THREE.Object3D, origin: THREE.Vector3, tips: THREE.Vector3[], color: number, opacity = 0.63) {
  const group = new THREE.Group(), vertices: number[] = [], uvs: number[] = [], indices: number[] = [], ribs: number[] = []
  const steps = 5
  tips.forEach((tip, i) => {
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, point = origin.clone().lerp(tip, t)
      point.z += Math.sin(t * Math.PI) * 0.008
      vertices.push(point.x, point.y, point.z)
      uvs.push(i / (tips.length - 1), t)
      if (i < tips.length - 1 && j < steps) {
        const a = i * (steps + 1) + j, b = a + steps + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
      if (j > 0) {
        const previous = origin.clone().lerp(tip, (j - 1) / steps)
        previous.z += Math.sin((j - 1) / steps * Math.PI) * 0.008
        ribs.push(previous.x, previous.y, previous.z, point.x, point.y, point.z)
      }
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  const material = wet(color, 0.53)
  material.side = THREE.DoubleSide; material.opacity = opacity; material.depthWrite = false
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFinUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinUv = uv;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFinUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float finEdge = smoothstep(0.88, 0.99, vFinUv.y);
        diffuseColor.rgb *= mix(1.0, 0.28, finEdge);
        diffuseColor.a *= 0.82 + sin(vFinUv.x * 210.0) * 0.14;
      `)
  }
  material.customProgramCacheKey = () => 'translucent-fin-rays-v1' 
  group.add(new THREE.Mesh(geometry, material))
  const ribColor = new THREE.Color(color).multiplyScalar(0.42)
  const ribGeometry = new THREE.BufferGeometry()
  ribGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ribs, 3))
  group.add(new THREE.LineSegments(ribGeometry, new THREE.LineBasicMaterial({ color: ribColor, transparent: true, opacity: 0.42, depthWrite: false })))
  parent.add(group)
  return group
}

const fishSkins = /* glsl */ `
  varying vec3 vAnimalPosition;
  uniform float uSpecies;
  float hashFish(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 fishPigment(vec3 p) {
    float x = p.x;
    vec3 color = vec3(0.94, 0.21, 0.015);
    if (uSpecies < 0.5) {
      float bands = min(abs(x - 0.23), min(abs(x + 0.025), abs(x + 0.285)));
      color = mix(color, vec3(0.008, 0.012, 0.013), 1.0 - smoothstep(0.047, 0.057, bands));
      color = mix(color, vec3(0.94, 0.93, 0.79), 1.0 - smoothstep(0.031, 0.039, bands));
    } else if (uSpecies < 1.5) {
      color = vec3(0.53, 0.53, 0.41);
      float bands = min(abs(x - 0.23 + p.y * 0.25), min(abs(x + 0.01), abs(x + 0.25)));
      color = mix(color, vec3(0.009, 0.013, 0.016), 1.0 - smoothstep(0.035, 0.053, bands));
      vec2 dots = vec2(x * 73.0, p.y * 73.0);
      if (length(fract(dots) - 0.5) < 0.10 && hashFish(floor(dots)) > 0.55) color += 0.42;
    } else if (uSpecies < 2.5) {
      color = mix(vec3(1.0, 0.58, 0.008), vec3(0.33, 0.014, 0.66), smoothstep(-0.11, 0.05, x));
    } else if (uSpecies < 3.5) {
      color = mix(vec3(0.75, 0.045, 0.008), vec3(0.89, 0.82, 0.69), smoothstep(-0.25, 0.15, x));
    } else if (uSpecies < 4.5) {
      color = mix(vec3(0.65, 0.20, 0.04), vec3(0.035, 0.25, 0.47), smoothstep(-0.25, 0.15, sin(p.y * 162.0 + x * 7.0)));
    } else if (uSpecies < 5.5) {
      color = vec3(0.78, 0.56, 0.04);
      if (length(fract(vec2(x * 67.0, p.y * 83.0)) - 0.5) < 0.13) color = vec3(0.51, 0.65, 0.52);
    } else if (uSpecies < 6.5) {
      color = mix(vec3(0.035, 0.28, 0.24), vec3(0.12, 0.65, 0.70), smoothstep(-0.13, 0.13, p.y));
    } else if (uSpecies < 7.5) {
      float maze = sin(x * 69.0 + sin(p.y * 58.0) * 2.4 + p.z * 19.0);
      color = mix(vec3(0.012, 0.26, 0.20), vec3(0.83, 0.20, 0.015), smoothstep(0.2, 0.7, maze));
      color = mix(color, vec3(0.04, 0.23, 0.70), smoothstep(0.85, 0.99, abs(maze)));
    } else {
      float mottling = hashFish(floor(vec2(x * 43.0, p.y * 46.0)));
      color = mix(vec3(0.14, 0.11, 0.07), vec3(0.55, 0.44, 0.28), mottling);
    }
    float scales = sin(x * 360.0 + sin(p.y * 240.0) * 0.75) * sin(p.y * 240.0);
    color *= 0.96 + scales * 0.04;
    color *= mix(0.80, 1.04, smoothstep(-0.15, 0.12, p.y));
    return pow(color, vec3(1.35));
  }
`
const profiles = [
  { height: 0.18, width: 0.095, head: 0.55, fin: 0xe58a24 },
  { height: 0.22, width: 0.075, head: 0.52, fin: 0x424a46 },
  { height: 0.125, width: 0.067, head: 0.49, fin: 0x7044a1 },
  { height: 0.102, width: 0.057, head: 0.52, fin: 0xd78568 },
  { height: 0.115, width: 0.067, head: 0.59, fin: 0x976044 },
  { height: 0.11, width: 0.083, head: 0.70, fin: 0xcbb849 },
  { height: 0.18, width: 0.070, head: 0.52, fin: 0x68b9b2 },
  { height: 0.12, width: 0.086, head: 0.62, fin: 0x338669 },
  { height: 0.12, width: 0.093, head: 0.80, fin: 0x92806b },
]
export function createFishModel(species: number): AnimalModel {
  const root = new THREE.Group(), profile = profiles[species]
  root.name = `fish-3d-${species}`
  const skin = wet(0xffffff, 0.40)
  skin.iridescence = species === 6 ? 0.18 : 0.045
  skin.iridescenceIOR = 1.3
  const uniforms = { uTime: { value: 0 }, uActivity: { value: 0.5 }, uSpecies: { value: species } }
  skin.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vAnimalPosition;
      uniform float uTime;
      uniform float uActivity;
    `).replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      float flexN = max(0.0, (0.13 - position.x) / 0.51);
      float ampN = 0.018 + uActivity * 0.012;
      float derivative = ampN * (cos(uTime + position.x * 7.0) * 7.0 * flexN * flexN - sin(uTime + position.x * 7.0) * 2.0 * flexN / 0.51);
      objectNormal.x -= derivative * objectNormal.z;
    `).replace('#include <begin_vertex>', `#include <begin_vertex>
      vAnimalPosition = position;
      float flex = max(0.0, (0.13 - position.x) / 0.51);
      transformed.z += sin(uTime + position.x * 7.0) * flex * flex * (0.018 + uActivity * 0.012);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + fishSkins)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= fishPigment(vAnimalPosition);')
  }
  skin.customProgramCacheKey = () => 'volumetric-fish-skin-v1'
  const body = new THREE.Mesh(createBodyGeometry(profile), skin)
  body.name = 'solid-body'; root.add(body)
  const tail = new THREE.Group(); tail.position.x = -0.36; root.add(tail)
  ellipsoid(tail, wet(profile.fin), v(-0.035, 0, 0), v(0.085, 0.030, 0.035))
  const forked = species === 1 || species === 6
  const tailColor = species === 2 ? 0xe6b82f : profile.fin
  fan(tail, v(0, 0, 0), Array.from({ length: 17 }, (_, i) => {
    const t = i / 8 - 1
    return v(forked ? -0.14 - Math.abs(t) * 0.14 : -0.26 + t * t * 0.045, t * profile.height * 0.97, Math.cos(t * Math.PI) * 0.008)
  }), tailColor, 0.80)
  const dorsalHeight = species === 1 ? 0.46 : species === 3 ? 0.40 : profile.height * 1.72
  const dorsal = fan(root, v(-0.02, profile.height * 0.62, 0), Array.from({ length: 33 }, (_, i) => {
    const t = i / 32
    const crest = species === 3 ? Math.exp(-Math.pow((t - 0.86) / 0.065, 2)) : species === 1 ? Math.exp(-Math.pow((t - 0.68) / 0.19, 2)) : Math.sin(t * Math.PI)
    return v(-0.29 + t * 0.48, profile.height * 0.72 + crest * (dorsalHeight - profile.height * 0.72), Math.sin(t * Math.PI) * 0.009)
  }), profile.fin, 0.62)
  const anal = fan(root, v(-0.10, -profile.height * 0.58, 0), Array.from({ length: 12 }, (_, i) => {
    const t = i / 11
    return v(-0.27 + t * 0.33, -profile.height * (0.65 + Math.sin(t * Math.PI) * (species === 1 ? 0.92 : 0.65)), 0)
  }), profile.fin, 0.56)
  const pectorals: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(0.14, -0.035, side * profile.width * 0.83); root.add(hinge)
    fan(hinge, v(0, 0, 0), Array.from({ length: 10 }, (_, i) => {
      const t = i / 9
      return v(-0.04 - Math.sin(t * Math.PI) * 0.15, -0.02 - t * 0.08, side * (0.035 + Math.sin(t * Math.PI) * 0.14))
    }), profile.fin, 0.40)
    pectorals.push(hinge)
    const eyeX = species === 8 ? 0.29 : 0.27, eyeY = profile.height * 0.23, eyeZ = profile.width * 0.77
    ellipsoid(root, wet(0x9e8447, 0.30), v(eyeX, eyeY, side * eyeZ), v(0.031, 0.031, 0.023))
    ellipsoid(root, wet(0x020508, 0.13), v(eyeX + 0.004, eyeY, side * (eyeZ + 0.014)), v(0.021, 0.023, 0.013))
    curve(root, [v(0.17, profile.height * 0.70, side * profile.width * 0.60), v(0.12, 0, side * profile.width * 0.96), v(0.15, -profile.height * 0.57, side * profile.width * 0.69)], 0.0017, wet(0x44392f, 0.75))
  }
  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 16), wet(species === 0 ? 0xd57835 : 0xa38c70))
  lips.position.set(0.389, -0.012, 0); lips.rotation.y = Math.PI / 2; root.add(lips)
  return {
    root,
    animate(time, activity) {
      uniforms.uTime.value = time; uniforms.uActivity.value = activity
      tail.position.z = Math.sin(time - 2.52) * 0.923 * (0.018 + activity * 0.012)
      tail.rotation.y = Math.sin(time - 2.3) * (0.13 + activity * 0.12)
      dorsal.rotation.x = Math.sin(time * 0.65) * 0.035; anal.rotation.x = Math.sin(time * 0.71 + 2) * 0.025
      pectorals.forEach((fin, i) => { fin.rotation.x = Math.sin(time * 1.32 + i * Math.PI) * 0.36 })
    },
    setOrder(order) { root.traverse(object => { object.renderOrder = object instanceof THREE.Group ? 0 : order }) },
  }
}

export function createCreatureModel(kind: number): AnimalModel {
  const root = new THREE.Group()
  root.name = ['cleaner-shrimp-3d', 'cerith-snail-3d', 'hermit-crab-3d', 'starfish-3d'][kind]
  const movers: { object: THREE.Object3D; axis: 'x' | 'y' | 'z'; base: number; amplitude: number; phase: number }[] = []
  const animatePart = (object: THREE.Object3D, axis: 'x' | 'y' | 'z', amplitude: number, phase: number) => movers.push({ object, axis, base: object.rotation[axis], amplitude, phase })
  const red = wet(0xb64022, 0.43), ivory = wet(0xd7c8a3, 0.52), dark = wet(0x030607, 0.13)
  if (kind === 0) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7
      const segment = ellipsoid(root, i % 3 === 0 ? ivory : red, v(0.10 - t * 0.39, 0.02 - t * t * 0.07, 0), v(0.064 - t * 0.025, 0.071 - t * 0.04, 0.058 - t * 0.029))
      animatePart(segment, 'z', 0.025, i * 0.3)
    }
    ellipsoid(root, red, v(0.13, 0.035, 0), v(0.14, 0.082, 0.067))
    curve(root, [v(-0.24, -0.018, 0), v(-0.04, 0.089, 0), v(0.25, 0.11, 0)], 0.012, ivory)
    const tail = new THREE.Group(); tail.position.set(-0.31, -0.065, 0); root.add(tail)
    fan(tail, v(0, 0, 0), Array.from({ length: 12 }, (_, i) => v(-0.11, Math.sin(i / 11 * Math.PI) * 0.035, (i / 11 - 0.5) * 0.15)), 0xb66649, 0.8)
    animatePart(tail, 'x', 0.1, 0.8)
    for (const side of [-1, 1]) {
      ellipsoid(root, dark, v(0.24, 0.105, side * 0.053), v(0.020, 0.024, 0.020))
      const antenna = new THREE.Group(); antenna.position.set(0.22, 0.10, side * 0.035); root.add(antenna)
      curve(antenna, [v(0, 0, 0), v(0.16, 0.17, side * 0.08), v(0.34, 0.28, side * 0.14), v(0.43, 0.26, side * 0.21)], 0.0035, ivory)
      curve(antenna, [v(0, 0, 0), v(0.21, 0.03, side * 0.16), v(0.37, -0.04, side * 0.26)], 0.0025, ivory)
      animatePart(antenna, 'y', 0.09, side)
      for (let i = 0; i < 5; i++) {
        const leg = new THREE.Group(); leg.position.set(0.14 - i * 0.045, -0.02, side * 0.045); root.add(leg)
        curve(leg, [v(0, 0, 0), v(0.035 - i * 0.008, -0.08, side * 0.10), v(0.08 - i * 0.015, -0.18, side * 0.13)], 0.004, i % 2 ? red : ivory, 8)
        animatePart(leg, 'z', 0.15, i * 1.2 + side)
      }
    }
  } else if (kind === 1 || kind === 2) {
    const shellMaterial = wet(0xffffff, 0.68); shellMaterial.vertexColors = true
    root.add(new THREE.Mesh(createShellGeometry(), shellMaterial))
    const foot = ellipsoid(root, kind === 1 ? wet(0x716650, 0.75) : red, v(0.14, -0.11, 0), v(kind === 1 ? 0.25 : 0.17, 0.066, 0.11))
    animatePart(foot, 'y', 0.035, 0)
    for (const side of [-1, 1]) {
      const eyeStalk = new THREE.Group(); eyeStalk.position.set(kind === 1 ? 0.31 : 0.22, -0.07, side * 0.054); root.add(eyeStalk)
      curve(eyeStalk, [v(0, 0, 0), v(0.045, 0.035, side * 0.015), v(0.065, kind === 1 ? 0.065 : 0.11, side * 0.03)], kind === 1 ? 0.006 : 0.009, kind === 1 ? ivory : red, 8)
      ellipsoid(eyeStalk, dark, v(0.065, kind === 1 ? 0.065 : 0.11, side * 0.03), v(0.010, 0.012, 0.010))
      animatePart(eyeStalk, 'y', 0.055, side)
      if (kind === 2) {
        for (let i = 0; i < 3; i++) {
          const leg = new THREE.Group(); leg.position.set(0.12 - i * 0.044, -0.10, side * 0.07); root.add(leg)
          curve(leg, [v(0, 0, 0), v(0.06 - i * 0.05, -0.075, side * 0.11), v(0.11 - i * 0.045, -0.21, side * 0.14)], 0.014 - i * 0.002, red, 9)
          ellipsoid(leg, ivory, v(0.06 - i * 0.05, -0.075, side * 0.11), v(0.019, 0.018, 0.020))
          animatePart(leg, 'z', 0.13, i * 1.8 + side)
        }
        const claw = new THREE.Group(); claw.position.set(0.20, -0.12, side * 0.12); root.add(claw)
        curve(claw, [v(0, 0, 0), v(0.065, -0.018, side * 0.045), v(0.14, -0.014, side * 0.025)], 0.020, red, 8)
        ellipsoid(claw, red, v(0.16, -0.015, side * 0.025), v(0.066, 0.036, 0.035))
        curve(claw, [v(0.17, 0, side * 0.02), v(0.24, 0.017, side * 0.015), v(0.265, -0.009, side * 0.015)], 0.010, ivory, 8)
        curve(claw, [v(0.17, -0.033, side * 0.02), v(0.235, -0.042, side * 0.015), v(0.26, -0.022, side * 0.015)], 0.010, red, 8)
        animatePart(claw, 'y', 0.11, side * 2)
      }
    }
  } else {
    root.add(new THREE.Mesh(createStarGeometry(), wet(0xcf6427, 0.79)))
    const tubercles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), wet(0xe3b87a, 0.81), 100)
    const dummy = new THREE.Object3D()
    for (let arm = 0; arm < 5; arm++) for (let i = 0; i < 20; i++) {
      const t = 0.12 + Math.floor(i / 3) * 0.12, theta = arm / 5 * Math.PI * 2 + ((i % 3) - 1) * 0.07
      const radius = t * 0.435
      dummy.position.set(Math.cos(theta) * radius, 0.018 + 0.067 * Math.pow(1 - t, 0.65), Math.sin(theta) * radius)
      dummy.scale.set(0.008, 0.007, 0.008); dummy.updateMatrix(); tubercles.setMatrixAt(arm * 20 + i, dummy.matrix)
    }
    root.add(tubercles)
  }
  root.rotation.x = kind === 3 ? 0.88 : 0.26
  root.rotation.y = kind === 0 ? -0.20 : kind === 1 ? 0.32 : -0.30
  return {
    root,
    animate(time, activity) {
      movers.forEach(mover => { mover.object.rotation[mover.axis] = mover.base + Math.sin(time * (mover.axis === 'z' ? 3 : 0.65) + mover.phase) * mover.amplitude * (0.30 + activity * 0.7) })
    },
    setOrder(order) { root.traverse(object => { object.renderOrder = object instanceof THREE.Group ? 0 : order }) },
  }
}
