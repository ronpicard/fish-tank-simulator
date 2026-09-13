import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createBottomLife, stepBottomLife, substrateAt, starArmMotion } from './bottomLife.ts'
import { seededRandom, SPECIES } from './simulation.ts'
import { AXES, WORLD } from './tankLayout.ts'
import { createCreatureModel, createFishModel } from './animalModels.ts'

test('shrimp, snail, and crab explore depth while remaining on their supporting surfaces', () => {
  const animals = createBottomLife(seededRandom(24))
  const initial = structuredClone(animals), depths = animals.map(a => [a.depth, a.depth])
  for (let frame = 0; frame < 24000; frame++) {
    stepBottomLife(animals, 1 / 30, 1)
    animals.forEach((animal, i) => {
      depths[i][0] = Math.min(depths[i][0], animal.depth); depths[i][1] = Math.max(depths[i][1], animal.depth)
      const surface = substrateAt(animal.x, animal.depth)
      assert.ok(Math.abs((0.5 - animal.y) * AXES.y - surface.y) < 1e-9)
      assert.ok(Math.abs(Math.hypot(surface.nx, surface.ny, surface.nz) - 1) < 1e-9)
      assert.ok(surface.y >= WORLD.floor && surface.ny > 0)
    })
  }
  for (let i = 0; i < 3; i++) assert.ok(depths[i][1] - depths[i][0] > 0.28, `bottom creature ${i} needs real depth travel`)
  for (const coordinate of ['x', 'y', 'depth', 'heading'] as const) assert.equal(animals[3][coordinate], initial[3][coordinate])
})

test('bottom movement is frame-rate independent and capped after a delayed frame', () => {
  const low = createBottomLife(seededRandom(18)), high = structuredClone(low)
  for (let i = 0; i < 1800; i++) stepBottomLife(low, 1 / 30, 1)
  for (let i = 0; i < 3600; i++) stepBottomLife(high, 1 / 60, 1)
  low.forEach((a, i) => assert.ok(Math.hypot(a.x - high[i].x, a.y - high[i].y, a.depth - high[i].depth) < 0.0001))
  const before = structuredClone(low)
  stepBottomLife(low, 120, 1.8)
  low.forEach((a, i) => assert.ok(Math.hypot(a.x - before[i].x, a.y - before[i].y, a.depth - before[i].depth) < 0.004))
})

test('the resting starfish only curls one arm occasionally and returns exactly to rest', () => {
  let active = 0
  for (let t = 0; t < 380; t += 0.1) if (starArmMotion(t).amount > 0) active++
  assert.ok(active > 0 && active / 3800 < 0.13)
  const model = createCreatureModel(3)
  const body = model.root.getObjectByName('resting-starfish-body') as THREE.Mesh
  const positions = body.geometry.getAttribute('position'), initial = new Float32Array(positions.array)
  model.animate(5, 0)
  assert.deepEqual(positions.array, initial)
  model.animate(11.25, 0)
  let lifted = 0
  for (let i = 0; i < positions.count; i++) {
    assert.equal(positions.getX(i), initial[i * 3]); assert.equal(positions.getZ(i), initial[i * 3 + 2])
    const lift = positions.getY(i) - initial[i * 3 + 1]
    if (lift > 0.0001) lifted++
    assert.ok(lift >= 0 && lift <= 0.049)
  }
  assert.ok(lifted > 0 && lifted < positions.count / 5)
  model.animate(20, 0)
  assert.deepEqual(positions.array, initial)
  assert.equal(model.root.rotation.x, 0)
})

test('new species have distinct anatomy and their fins or arms animate in depth', () => {
  assert.deepEqual(SPECIES.slice(9).map(s => s.name), ['Lionfish', 'Betta', 'Cuttlefish'])
  const lion = createFishModel(9), betta = createFishModel(10), cuttle = createFishModel(11)
  const bounds = (model: typeof lion) => new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3())
  assert.ok(bounds(lion).z > 0.8, 'lionfish needs spread pectoral fins')
  assert.ok(bounds(betta).y > 0.6, 'betta needs long flowing fins')
  assert.ok(cuttle.root.getObjectByName('solid-mantle'))
  const fin = cuttle.root.getObjectByName('undulating-mantle-fin') as THREE.Mesh
  const initial = new Float32Array(fin.geometry.getAttribute('position').array)
  cuttle.animate(3, 0.8)
  assert.notDeepEqual(fin.geometry.getAttribute('position').array, initial)
  assert.ok(Array.from(fin.geometry.getAttribute('normal').array).every(Number.isFinite))
})
