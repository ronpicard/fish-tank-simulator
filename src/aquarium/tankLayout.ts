// One fixed world volume, shared by scenery, steering, and perspective projection.
// Normalized x/y retain the original species habitats; depth increases away from the glass.
export const WORLD = {
  halfHeight: Math.tan(Math.PI / 12) * 5.5,
  aspect: 1672 / 941,
  front: 0.55,
  back: -1.9,
  floor: -0.77,
  surface: 0.93,
  halfWidth: 1.96,
}
export const AXES = {
  x: WORLD.halfHeight * WORLD.aspect * 2,
  y: WORLD.halfHeight * 2,
  depth: WORLD.front - WORLD.back,
}
export function worldPosition(x: number, y: number, depth: number) {
  return { x: (x - 0.5) * AXES.x, y: (0.5 - y) * AXES.y, z: WORLD.front - depth * AXES.depth }
}

export interface Rock {
  center: readonly [number, number, number]
  radius: readonly [number, number, number]
  seed: number
}
// Approximate collision envelopes for the two photographed rock islands.
// Leave continuous swimming lanes both behind and in front of the two islands.
export const ROCKS: readonly Rock[] = [
  { center: [-1.18, -0.56, -0.62], radius: [0.47, 0.28, 0.40], seed: 11 },
  { center: [-0.76, -0.62, -0.37], radius: [0.38, 0.22, 0.34], seed: 27 },
  { center: [-1.10, -0.25, -0.64], radius: [0.37, 0.29, 0.31], seed: 34 },
  { center: [-0.47, -0.66, -0.49], radius: [0.30, 0.16, 0.28], seed: 58 },
  { center: [-1.50, -0.66, -0.18], radius: [0.26, 0.16, 0.23], seed: 62 },
  { center: [0.88, -0.56, -0.72], radius: [0.44, 0.27, 0.38], seed: 73 },
  { center: [1.24, -0.57, -0.30], radius: [0.37, 0.24, 0.33], seed: 83 },
  { center: [1.05, -0.28, -0.64], radius: [0.34, 0.27, 0.30], seed: 99 },
  { center: [0.51, -0.66, -0.78], radius: [0.27, 0.16, 0.29], seed: 101 },
  { center: [1.55, -0.67, -0.54], radius: [0.24, 0.15, 0.25], seed: 117 },
]

/** Body clearance in world units, including room for a sideways turn. */
export function bodyClearance(size: number) { return size * WORLD.halfHeight * 1.28 * 0.64 }

export function rockDistance(x: number, y: number, depth: number, rock: Rock, clearance = 0) {
  const point = worldPosition(x, y, depth)
  return Math.hypot(
    (point.x - rock.center[0]) / (rock.radius[0] + clearance),
    (point.y - rock.center[1]) / (rock.radius[1] + clearance),
    (point.z - rock.center[2]) / (rock.radius[2] + clearance),
  )
}
