import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createBodyGeometry, createShellGeometry, createStarGeometry } from './animalGeometry.ts'
import { createFishModel, createCreatureModel } from './animalModels.ts'
import { SPECIES } from './simulation.ts'

function signedVolume(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position'), index = geometry.getIndex()!
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let volume = 0
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    volume += a.dot(b.cross(c)) / 6
  }
  return volume
}

test('fish and starfish meshes enclose volume with outward-facing triangles', () => {
  for (const geometry of [createBodyGeometry({ height: 0.18, width: 0.095, head: 0.55 }), createStarGeometry()]) {
    assert.ok(signedVolume(geometry) > 0.005, 'a flat sprite or inverted mesh cannot pass')
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    assert.ok(Math.min(size.x, size.y, size.z) > 0.08)
    geometry.dispose()
  }
})

test('generated surfaces have finite positions and normals', () => {
  for (const geometry of [createBodyGeometry({ height: 0.11, width: 0.083, head: 0.7 }), createShellGeometry(), createStarGeometry()]) {
    for (const name of ['position', 'normal']) assert.ok(Array.from(geometry.getAttribute(name).array).every(Number.isFinite))
    geometry.dispose()
  }
})

test('every species retains visible depth when turning toward the glass', () => {
  const models = [...SPECIES.map((_, i) => createFishModel(i)), ...Array.from({ length: 4 }, (_, i) => createCreatureModel(i))]
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  for (const model of models) {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      model.root.rotation.y = angle
      model.animate(4.2, 1.7)
      model.root.updateMatrixWorld(true)
      const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3())
      assert.ok([size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0.06), model.root.name)
    }
    model.root.traverse(object => {
      assert.equal(object instanceof THREE.Sprite, false)
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry)
        const list = Array.isArray(object.material) ? object.material : [object.material]
        list.forEach(material => materials.add(material))
      }
    })
  }
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
})
