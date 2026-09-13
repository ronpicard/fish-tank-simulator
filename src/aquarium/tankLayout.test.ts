import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { worldPosition, WORLD } from './tankLayout.ts'

test('depth changes world z and perspective size without rescaling or moving world x/y', () => {
  const front = worldPosition(0.65, 0.4, 0.06), back = worldPosition(0.65, 0.4, 0.94)
  assert.equal(front.x, back.x); assert.equal(front.y, back.y)
  assert.ok(front.z - back.z > 2)
  const camera = new THREE.PerspectiveCamera(30, WORLD.aspect, 0.1, 30)
  camera.position.z = 5.5; camera.updateMatrixWorld(true)
  const apparentSize = (point: typeof front) => {
    const a = new THREE.Vector3(point.x - 0.16, point.y, point.z).project(camera)
    const b = new THREE.Vector3(point.x + 0.16, point.y, point.z).project(camera)
    return b.x - a.x
  }
  assert.ok(apparentSize(front) > apparentSize(back) * 1.4)
})
