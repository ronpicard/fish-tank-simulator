import * as THREE from 'three'

export interface BodyProfile {
  height: number
  width: number
  head: number
}

/** A closed, ring-built body with its long axis along X and volume on both sides. */
export function createBodyGeometry(profile: BodyProfile) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const rings = 48, sides = 32
  for (let i = 0; i <= rings; i++) {
    const t = i / rings
    const x = -0.38 + t * 0.78
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.68)
    const fullness = 0.54 + t * profile.head
    for (let j = 0; j <= sides; j++) {
      const theta = j / sides * Math.PI * 2
      positions.push(x, Math.cos(theta) * envelope * profile.height * fullness, Math.sin(theta) * envelope * profile.width * fullness)
      uvs.push(t, j / sides)
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A tapered tube along a spiral centerline forms a solid, coiled shell. */
export function createShellGeometry() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const rings = 160, sides = 20
  const center = (t: number) => {
    const angle = t * Math.PI * 6.4, r = 0.008 + t * 0.12
    return new THREE.Vector3(-0.27 + t * 0.40, 0.065 + Math.cos(angle) * r, Math.sin(angle) * r)
  }
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, c = center(t)
    const tangent = center(t + 0.0001).sub(center(t - 0.0001)).normalize()
    const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
    const binormal = tangent.clone().cross(normal).normalize()
    const radius = 0.006 + Math.pow(t, 1.55) * 0.122
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2, ridge = 1 + Math.sin(t * 280) * 0.025
      const p = c.clone().addScaledVector(normal, Math.cos(angle) * radius * ridge).addScaledVector(binormal, Math.sin(angle) * radius * ridge)
      positions.push(p.x, p.y, p.z)
      const band = Math.pow(Math.max(0, Math.sin(t * 113 + Math.sin(angle * 5) * 0.6)), 5)
      colors.push(0.24 - band * 0.20, 0.125 - band * 0.10, 0.052 - band * 0.040)
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

/** Joined top, bottom and rim surfaces make five thick, tapered arms. */
export function createStarGeometry() {
  const positions: number[] = [], indices: number[] = []
  const spokes = 120, rings = 12
  for (let side = 0; side < 2; side++) {
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings
      for (let i = 0; i <= spokes; i++) {
        const angle = i / spokes * Math.PI * 2
        const radius = 0.135 + 0.30 * Math.pow((Math.cos(angle * 5) + 1) / 2, 2.1)
        const y = side === 0 ? 0.01 + 0.067 * Math.pow(1 - t, 0.65) : -0.012
        positions.push(Math.cos(angle) * radius * t, y, Math.sin(angle) * radius * t)
        if (ring < rings && i < spokes) {
          const a = side * (rings + 1) * (spokes + 1) + ring * (spokes + 1) + i, b = a + spokes + 1
          if (side === 0) indices.push(a, a + 1, b, a + 1, b + 1, b)
          else indices.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    }
  }
  const offset = (rings + 1) * (spokes + 1)
  for (let i = 0; i < spokes; i++) {
    const a = rings * (spokes + 1) + i, b = a + offset
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}
