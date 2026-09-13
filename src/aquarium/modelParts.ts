import * as THREE from 'three'

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
export const wet = (color: THREE.ColorRepresentation, roughness = 0.42) => new THREE.MeshPhysicalMaterial({
  color, roughness, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.31,
  depthWrite: true, envMapIntensity: 0.22,
})
export function ellipsoid(parent: THREE.Object3D, material: THREE.Material, center: THREE.Vector3, scale: THREE.Vector3) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material)
  mesh.position.copy(center); mesh.scale.copy(scale); parent.add(mesh)
  return mesh
}
export function curve(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 18) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 6, false), material)
  parent.add(mesh)
  return mesh
}
export function fan(parent: THREE.Object3D, origin: THREE.Vector3, tips: THREE.Vector3[], color: number, opacity = 0.63, pattern = 0) {
  const group = new THREE.Group(), vertices: number[] = [], uvs: number[] = [], indices: number[] = [], ribs: number[] = [], ribUvs: number[] = []
  const uniforms = { uFinTime: { value: 0 }, uFinRipple: { value: 0 }, uFinPattern: { value: pattern } }
  group.userData.finUniforms = uniforms
  const bendVertex = (source: string) => source.replace('#include <common>', `#include <common>
    varying vec2 vFinUv;
    uniform float uFinTime;
    uniform float uFinRipple;
  `).replace('#include <begin_vertex>', `#include <begin_vertex>
    vFinUv = uv;
    transformed.z += sin(uv.y * 8.0 - uFinTime * 1.6 + uv.x * 5.0) * uv.y * uv.y * uFinRipple;
  `)
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
        ribUvs.push(i / (tips.length - 1), (j - 1) / steps, i / (tips.length - 1), t)
      }
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  const material = wet(color, 0.53)
  material.side = THREE.DoubleSide; material.transparent = true; material.opacity = opacity; material.depthWrite = false
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = bendVertex(shader.vertexShader)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFinUv;\nuniform float uFinPattern;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float finEdge = smoothstep(0.88, 0.99, vFinUv.y);
        diffuseColor.rgb *= mix(1.0, 0.28, finEdge);
        diffuseColor.a *= 0.82 + sin(vFinUv.x * 210.0) * 0.14;
        if (uFinPattern > 0.5 && uFinPattern < 1.5) {
          float bands = smoothstep(-0.2, 0.2, sin(vFinUv.x * 94.0 + vFinUv.y * 12.0));
          diffuseColor.rgb = mix(vec3(0.13, 0.025, 0.012), vec3(0.58, 0.39, 0.22), bands);
          float spots = length(fract(vec2(vFinUv.x * 18.0, vFinUv.y * 9.0)) - 0.5);
          diffuseColor.rgb *= mix(0.28, 1.0, smoothstep(0.10, 0.20, spots));
        } else if (uFinPattern > 1.5) {
          diffuseColor.rgb = mix(vec3(0.008, 0.15, 0.32), vec3(0.44, 0.016, 0.075), smoothstep(0.25, 0.92, vFinUv.y));
          diffuseColor.rgb *= 0.65 + 0.35 * pow(abs(sin(vFinUv.x * 130.0)), 2.0);
        }
      `)
  }
  material.customProgramCacheKey = () => 'flowing-fin-rays-v2'
  group.add(new THREE.Mesh(geometry, material))
  const ribColor = new THREE.Color(color).multiplyScalar(0.42)
  const ribGeometry = new THREE.BufferGeometry()
  ribGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ribs, 3))
  ribGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(ribUvs, 2))
  const ribMaterial = new THREE.LineBasicMaterial({ color: ribColor, transparent: true, opacity: 0.42, depthWrite: false })
  ribMaterial.onBeforeCompile = shader => { Object.assign(shader.uniforms, uniforms); shader.vertexShader = bendVertex(shader.vertexShader) }
  ribMaterial.customProgramCacheKey = () => 'flowing-fin-ribs-v2'
  group.add(new THREE.LineSegments(ribGeometry, ribMaterial))
  parent.add(group)
  return group
}

export function animateFan(group: THREE.Group, time: number, ripple: number) {
  const uniforms = group.userData.finUniforms
  uniforms.uFinTime.value = time; uniforms.uFinRipple.value = ripple
}
