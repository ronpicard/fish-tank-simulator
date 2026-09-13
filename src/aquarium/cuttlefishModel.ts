import * as THREE from 'three'
import type { AnimalModel } from './animalModels.ts'
import { createBodyGeometry } from './animalGeometry.ts'
import { v, wet, ellipsoid, curve } from './modelParts.ts'

/** A broad mantle, paired ribbon fins, eight short arms, and lateral W-shaped pupils. */
export function createCuttlefishModel(): AnimalModel {
  const root = new THREE.Group(); root.name = 'cuttlefish-3d'
  const skin = wet(0xffffff, 0.67), clock = { value: 0 }
  skin.onBeforeCompile = shader => {
    shader.uniforms.uCuttleTime = clock
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMantle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMantle = position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMantle;
      uniform float uCuttleTime;
      float skinNoise(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    `).replace('#include <color_fragment>', `#include <color_fragment>
      float pattern = sin(vMantle.x * 46.0 + sin(vMantle.z * 34.0) * 2.8 + sin(uCuttleTime * 0.045) * 0.3);
      vec3 pigment = mix(vec3(0.13, 0.075, 0.037), vec3(0.53, 0.43, 0.29), smoothstep(-0.3, 0.5, pattern));
      pigment *= 0.83 + skinNoise(floor(vMantle * 220.0)) * 0.24;
      diffuseColor.rgb *= pigment;
    `)
  }
  skin.customProgramCacheKey = () => 'cuttlefish-chromatophores-v1'
  const mantle = new THREE.Mesh(createBodyGeometry({ height: 0.175, width: 0.235, head: 0.38 }), skin)
  mantle.name = 'solid-mantle'; mantle.position.x = -0.13; root.add(mantle)
  ellipsoid(root, skin, v(0.25, 0.005, 0), v(0.14, 0.13, 0.18))
  const fins: { mesh: THREE.Mesh; base: Float32Array }[] = []
  for (const side of [-1, 1]) {
    const positions: number[] = [], indices: number[] = []
    const rows = 48, columns = 4
    // Closed top and bottom layers give the delicate fin a small amount of thickness.
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
      const t = i / rows, u = j / columns, envelope = Math.pow(Math.sin(t * Math.PI), 0.64)
      positions.push(-0.50 + t * 0.69, (layer === 0 ? 0.007 : -0.007) * envelope, side * envelope * (0.13 + u * 0.12))
      if (i < rows && j < columns) {
        const a = layer * (rows + 1) * (columns + 1) + i * (columns + 1) + j, b = a + columns + 1
        if ((side === 1) === (layer === 0)) indices.push(a, b, a + 1, a + 1, b, b + 1)
        else indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
    const offset = (rows + 1) * (columns + 1)
    for (let i = 0; i < rows; i++) for (const edge of [0, columns]) {
      const a = i * (columns + 1) + edge, b = a + columns + 1
      if ((side === 1) === (edge === columns)) indices.push(a, a + offset, b, b, a + offset, b + offset)
      else indices.push(a, b, a + offset, b, b + offset, a + offset)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const fin = new THREE.Mesh(geometry, wet(0xb5a07b, 0.59)); fin.name = 'undulating-mantle-fin'
    root.add(fin); fins.push({ mesh: fin, base: new Float32Array(positions) })
    ellipsoid(root, wet(0xb29d6a, 0.31), v(0.29, 0.05, side * 0.151), v(0.066, 0.063, 0.045))
    const eyeZ = side * 0.194
    curve(root, [v(0.244, 0.063, eyeZ), v(0.263, 0.030, eyeZ + side * 0.005), v(0.285, 0.059, eyeZ + side * 0.01), v(0.307, 0.028, eyeZ + side * 0.005), v(0.334, 0.058, eyeZ)], 0.007, wet(0x080b08, 0.19), 12)
  }
  curve(root, [v(0.15, -0.10, 0), v(0.29, -0.135, 0), v(0.37, -0.12, 0)], 0.025, wet(0xa49a78), 12)
  const arms: THREE.Group[] = []
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2
    const arm = new THREE.Group(); arm.position.set(0.33, Math.cos(angle) * 0.063, Math.sin(angle) * 0.09)
    const extension = i < 2 ? 0.27 : 0.20 + (i % 3) * 0.015
    curve(arm, [v(0, 0, 0), v(0.10, -0.012 + Math.cos(angle) * 0.025, Math.sin(angle) * 0.04), v(extension, -0.025, Math.sin(angle) * 0.055), v(extension + 0.015, 0.006, Math.sin(angle) * 0.036)], 0.016 - (i % 2) * 0.003, skin, 18)
    for (let j = 0; j < 5; j++) ellipsoid(arm, wet(0xbaae8d, 0.8), v(0.035 + j * 0.034, -0.023, Math.sin(angle) * j * 0.006), v(0.006, 0.003, 0.006))
    root.add(arm); arms.push(arm)
  }
  return {
    root,
    animate(time, activity) {
      clock.value = time
      mantle.scale.y = 1 + Math.sin(time * 0.43) * 0.009
      fins.forEach((fin, side) => {
        const position = fin.mesh.geometry.getAttribute('position')
        for (let i = 0; i < position.count; i++) {
          const x = fin.base[i * 3], z = fin.base[i * 3 + 2]
          const edge = Math.min(1, Math.abs(z) / 0.24)
          position.setY(i, fin.base[i * 3 + 1] + Math.sin(x * 23 - time * 1.6 + side * 0.45) * edge * edge * (0.015 + Math.min(activity, 1) * 0.009))
        }
        position.needsUpdate = true; fin.mesh.geometry.computeVertexNormals()
      })
      arms.forEach((arm, i) => {
        arm.rotation.y = Math.sin(time * 0.37 + i * 0.9) * 0.065
        arm.rotation.z = Math.sin(time * 0.29 + i * 1.3) * 0.045
      })
    },
  }
}
