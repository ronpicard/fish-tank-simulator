import * as THREE from 'three'
import { createBodyGeometry, createShellGeometry, createStarGeometry } from './animalGeometry.ts'

export interface AnimalModel {
  root: THREE.Group
  animate: (time: number, activity: number) => void
}
import { v, wet, ellipsoid, curve, fan, animateFan } from './modelParts.ts'
import { createCuttlefishModel } from './cuttlefishModel.ts'
import { starArmMotion } from './bottomLife.ts'

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
    } else if (uSpecies < 8.5) {
      float mottling = hashFish(floor(vec2(x * 43.0, p.y * 46.0)));
      color = mix(vec3(0.14, 0.11, 0.07), vec3(0.55, 0.44, 0.28), mottling);
    } else if (uSpecies < 9.5) {
      float stripe = smoothstep(-0.15, 0.18, sin(x * 74.0 + p.y * 17.0 + sin(p.y * 29.0) * 0.7));
      color = mix(vec3(0.24, 0.045, 0.018), vec3(0.85, 0.69, 0.45), stripe);
    } else {
      color = mix(vec3(0.025, 0.055, 0.30), vec3(0.015, 0.54, 0.64), smoothstep(-0.08, 0.14, p.y));
      color = mix(color, vec3(0.55, 0.02, 0.11), (1.0 - smoothstep(-0.30, -0.05, x)) * 0.65);
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
  { height: 0.21, width: 0.115, head: 0.68, fin: 0xb28157 },
  { height: 0.16, width: 0.070, head: 0.53, fin: 0x22789c },
]
export function createFishModel(species: number): AnimalModel {
  if (species === 11) return createCuttlefishModel()
  const root = new THREE.Group(), profile = profiles[species]
  const lion = species === 9, betta = species === 10, finPattern = lion ? 1 : betta ? 2 : 0
  root.name = `fish-3d-${species}`
  const skin = wet(0xffffff, 0.40)
  skin.iridescence = betta ? 0.35 : species === 6 ? 0.18 : 0.045
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
  const tailFin = fan(tail, v(0, 0, 0), Array.from({ length: betta ? 49 : 17 }, (_, i) => {
    const t = i / (betta ? 24 : 8) - 1
    if (betta) return v(-0.03 - Math.sqrt(Math.max(0, 1 - t * t)) * 0.25, t * 0.35, Math.sin(t * 18) * 0.025)
    return v(forked ? -0.14 - Math.abs(t) * 0.14 : -0.26 + t * t * 0.045, t * profile.height * 0.97, Math.cos(t * Math.PI) * 0.008)
  }), tailColor, 0.80, finPattern)
  const dorsalHeight = lion ? 0.58 : betta ? 0.36 : species === 1 ? 0.46 : species === 3 ? 0.40 : profile.height * 1.72
  const dorsal = fan(root, v(-0.02, profile.height * 0.62, 0), Array.from({ length: 33 }, (_, i) => {
    const t = i / 32
    const crest = species === 3 ? Math.exp(-Math.pow((t - 0.86) / 0.065, 2)) : species === 1 ? Math.exp(-Math.pow((t - 0.68) / 0.19, 2)) : Math.sin(t * Math.PI)
    return v(-0.29 + t * 0.48, profile.height * 0.72 + crest * (dorsalHeight - profile.height * 0.72) * (lion && i % 2 ? 0.30 : 1), Math.sin(t * Math.PI) * 0.009)
  }), profile.fin, 0.62, finPattern)
  const anal = fan(root, v(-0.10, -profile.height * 0.58, 0), Array.from({ length: 12 }, (_, i) => {
    const t = i / 11
    return v((betta ? -0.42 : -0.27) + t * (betta ? 0.56 : 0.33), -profile.height * (0.65 + Math.sin(t * Math.PI) * (betta ? 1.75 : species === 1 ? 0.92 : 0.65)), 0)
  }), profile.fin, 0.56, finPattern)
  const pectorals: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(0.14, -0.035, side * profile.width * 0.83); root.add(hinge)
    fan(hinge, v(0, 0, 0), Array.from({ length: lion ? 25 : 10 }, (_, i) => {
      const t = i / (lion ? 24 : 9)
      if (lion) return v(-0.07 - Math.sin(t * Math.PI) * 0.36, 0.13 - t * 0.32, side * (0.08 + Math.sin(t * Math.PI) * 0.44) * (i % 2 ? 0.90 : 1))
      return v(-0.04 - Math.sin(t * Math.PI) * 0.15, -0.02 - t * 0.08, side * (0.035 + Math.sin(t * Math.PI) * 0.14))
    }), profile.fin, lion ? 0.72 : 0.40, finPattern)
    pectorals.push(hinge)
    const eyeX = species === 8 ? 0.29 : 0.27, eyeY = profile.height * 0.23, eyeZ = profile.width * 0.77
    ellipsoid(root, wet(0x9e8447, 0.30), v(eyeX, eyeY, side * eyeZ), v(0.031, 0.031, 0.023))
    ellipsoid(root, wet(0x020508, 0.13), v(eyeX + 0.004, eyeY, side * (eyeZ + 0.014)), v(0.021, 0.023, 0.013))
    curve(root, [v(0.17, profile.height * 0.70, side * profile.width * 0.60), v(0.12, 0, side * profile.width * 0.96), v(0.15, -profile.height * 0.57, side * profile.width * 0.69)], 0.0017, wet(0x44392f, 0.75))
    if (betta) curve(root, [v(0.12, -0.10, side * 0.03), v(0.03, -0.24, side * 0.05), v(-0.07, -0.39, side * 0.04)], 0.006, wet(0xaf204c), 12)
    if (lion) {
      curve(root, [v(0.27, 0.10, side * 0.08), v(0.26, 0.22, side * 0.11), v(0.23, 0.28, side * 0.12)], 0.008, wet(0xbc9c6e), 10)
      for (let i = 0; i < 11; i++) {
        const t = i / 10, x = -0.28 + t * 0.43
        curve(root, [v(x, 0.10, 0), v(x - 0.045, 0.25 + Math.sin(t * Math.PI) * 0.21, side * 0.015), v(x - 0.08, 0.27 + Math.sin(t * Math.PI) * 0.31, side * 0.025)], 0.003, wet(0xb29a74), 10)
      }
    }
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
      if (lion || betta) {
        animateFan(tailFin, time, betta ? 0.055 : 0.012)
        animateFan(dorsal, time * 0.8, betta ? 0.028 : 0.009)
        animateFan(anal, time * 0.9, betta ? 0.04 : 0.01)
        pectorals.forEach((hinge, i) => {
          hinge.rotation.x = Math.sin(time * 0.45 + i * Math.PI) * (lion ? 0.09 : 0.2)
          animateFan(hinge.children[0] as THREE.Group, time + i, lion ? 0.018 : 0.01)
        })
      }
    },
  }
}

export function createCreatureModel(kind: number): AnimalModel {
  const root = new THREE.Group()
  root.name = ['cleaner-shrimp-3d', 'cerith-snail-3d', 'hermit-crab-3d', 'starfish-3d'][kind]
  const movers: { object: THREE.Object3D; axis: 'x' | 'y' | 'z'; base: number; amplitude: number; phase: number }[] = []
  const animatePart = (object: THREE.Object3D, axis: 'x' | 'y' | 'z', amplitude: number, phase: number) => movers.push({ object, axis, base: object.rotation[axis], amplitude, phase })
  const red = wet(0xb64022, 0.43), ivory = wet(0xd7c8a3, 0.52), dark = wet(0x030607, 0.13)
  let animateStar: ((time: number) => void) | undefined
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
    const geometry = createStarGeometry()
    const star = new THREE.Mesh(geometry, wet(0xb46630, 0.86)); star.name = 'resting-starfish-body'; root.add(star)
    const basePositions = new Float32Array(geometry.getAttribute('position').array)
    const tubercles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), wet(0xe3b87a, 0.81), 100)
    const dummy = new THREE.Object3D(), bumps: THREE.Vector3[] = []
    for (let arm = 0; arm < 5; arm++) for (let i = 0; i < 20; i++) {
      const t = 0.12 + Math.floor(i / 3) * 0.12, theta = arm / 5 * Math.PI * 2 + ((i % 3) - 1) * 0.07
      const radius = t * 0.435
      dummy.position.set(Math.cos(theta) * radius, 0.018 + 0.067 * Math.pow(1 - t, 0.65), Math.sin(theta) * radius)
      bumps.push(dummy.position.clone())
      dummy.scale.set(0.008, 0.007, 0.008); dummy.updateMatrix(); tubercles.setMatrixAt(arm * 20 + i, dummy.matrix)
    }
    root.add(tubercles)
    let previousAmount = 0
    animateStar = time => {
      const { arm, amount } = starArmMotion(time)
      if (amount === 0 && previousAmount === 0) return
      const curl = (x: number, z: number) => {
        const angle = Math.atan2(z, x) - arm / 5 * Math.PI * 2
        const alignment = Math.max(0, Math.cos(angle))
        const tip = THREE.MathUtils.smoothstep(Math.hypot(x, z), 0.19, 0.43)
        return amount * 0.048 * Math.pow(alignment, 24) * tip * tip
      }
      const position = geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) position.setY(i, basePositions[i * 3 + 1] + curl(basePositions[i * 3], basePositions[i * 3 + 2]))
      position.needsUpdate = true; geometry.computeVertexNormals()
      bumps.forEach((point, i) => {
        dummy.position.copy(point); dummy.position.y += curl(point.x, point.z)
        dummy.updateMatrix(); tubercles.setMatrixAt(i, dummy.matrix)
      })
      tubercles.instanceMatrix.needsUpdate = true
      previousAmount = amount
    }
  }
  return {
    root,
    animate(time, activity) {
      movers.forEach(mover => { mover.object.rotation[mover.axis] = mover.base + Math.sin(time * (mover.axis === 'z' ? 3 : 0.65) + mover.phase) * mover.amplitude * (0.06 + activity * 0.94) })
      animateStar?.(time)
    },
  }
}
