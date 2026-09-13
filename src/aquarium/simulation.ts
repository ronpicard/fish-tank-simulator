export const SPECIES = [
  { name: 'Clownfish', size: 0.17, speed: 0.024, level: 0.48, range: 0.14 },
  { name: 'Banggai cardinalfish', size: 0.22, speed: 0.012, level: 0.40, range: 0.11 },
  { name: 'Royal gramma', size: 0.16, speed: 0.027, level: 0.51, range: 0.14 },
  { name: 'Firefish', size: 0.17, speed: 0.021, level: 0.44, range: 0.14 },
  { name: 'Six-line wrasse', size: 0.18, speed: 0.040, level: 0.50, range: 0.16 },
  { name: 'Yellow watchman goby', size: 0.18, speed: 0.009, level: 0.69, range: 0.035 },
  { name: 'Blue-green chromis', size: 0.17, speed: 0.032, level: 0.34, range: 0.09 },
  { name: 'Mandarin dragonet', size: 0.19, speed: 0.012, level: 0.66, range: 0.055 },
  { name: 'Lawnmower blenny', size: 0.18, speed: 0.014, level: 0.61, range: 0.085 },
] as const

export const TANK = { left: 0.145, right: 0.855, top: 0.245, bottom: 0.735 }
export interface Swimmer {
  x: number; y: number; vx: number; vy: number; species: number; depth: number
  size: number; phase: number; facing: number; targetX: number; targetY: number
  targetDepth: number; behavior: number; decisionIn: number; speed: number
  activity: number; finTime: number; rng: number
}

export function seededRandom(seed = 47) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}
function next(fish: Swimmer) {
  fish.rng = (Math.imul(fish.rng, 1664525) + 1013904223) >>> 0
  return fish.rng / 4294967296
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** One individual per species: increasing population never creates a duplicate. */
export function createSchool(count: number, random = Math.random): Swimmer[] {
  return SPECIES.slice(0, clamp(Math.floor(count), 0, SPECIES.length)).map((species, index) => {
    const x = 0.20 + random() * 0.60
    const y = clamp(species.level + (random() - 0.5) * species.range, TANK.top, TANK.bottom)
    const direction = random() > 0.5 ? 1 : -1
    return {
      x, y, vx: direction * species.speed * 0.5, vy: 0, species: index,
      depth: 0.2 + random() * 0.55, size: species.size, phase: random() * Math.PI * 2,
      facing: direction, targetX: clamp(x + direction * 0.13, TANK.left, TANK.right), targetY: y,
      targetDepth: 0.2 + random() * 0.55, behavior: 1, decisionIn: 0.4 + random() * 5,
      speed: species.speed, activity: 0.5, finTime: random() * 20,
      rng: Math.floor(random() * 0xffffffff),
    }
  })
}

function chooseBehavior(fish: Swimmer) {
  const species = SPECIES[fish.species]
  const draw = next(fish)
  // Hovering, exploring, a short dart, or a close inspection; each fish has its own clock.
  fish.behavior = draw < 0.29 ? 0 : draw < 0.74 ? 1 : draw < 0.87 ? 2 : 3
  fish.decisionIn = fish.behavior === 2 ? 0.5 + next(fish) * 0.9 : 1.8 + next(fish) * 6.5
  const radius = fish.behavior === 0 ? 0.012 : fish.behavior === 3 ? 0.07 : 0.36
  fish.targetX = clamp(fish.x + (next(fish) - 0.5) * radius * 2, TANK.left + 0.025, TANK.right - 0.025)
  fish.targetY = clamp(species.level + (next(fish) - 0.5) * species.range * 2, TANK.top + 0.02, TANK.bottom - 0.012)
  if (fish.behavior === 0) fish.targetY = clamp(fish.y + (next(fish) - 0.5) * 0.015, TANK.top, TANK.bottom)
  fish.speed = species.speed * (fish.behavior === 0 ? 0.07 : fish.behavior === 2 ? 2.7 : fish.behavior === 3 ? 0.33 : 0.55 + next(fish) * 0.8)
  fish.targetDepth = 0.12 + next(fish) * 0.76
}

/** Small integration steps keep decisions and acceleration consistent across frame rates. */
export function stepSchool(fish: Swimmer[], elapsed: number, time: number, current: number) {
  let remaining = clamp(elapsed, 0, 0.05) * Math.max(0, current)
  if (!Number.isFinite(remaining)) return
  while (remaining > 0.0000001) {
    const dt = Math.min(remaining, 1 / 120)
    remaining -= dt
    const previous = fish.map(f => ({ x: f.x, y: f.y, depth: f.depth }))
    fish.forEach((swimmer, index) => {
      swimmer.decisionIn -= dt
      if (swimmer.decisionIn <= 0) chooseBehavior(swimmer)
      const dx = swimmer.targetX - swimmer.x
      const dy = swimmer.targetY - swimmer.y
      const distance = Math.hypot(dx, dy)
      const arrival = Math.min(1, distance / 0.065)
      let desiredX = distance > 0.001 ? dx / distance * swimmer.speed * arrival : 0
      let desiredY = distance > 0.001 ? dy / distance * swimmer.speed * arrival * 0.62 : 0
      previous.forEach((other, i) => {
        if (i === index || Math.abs(other.depth - swimmer.depth) > 0.35) return
        const sx = swimmer.x - other.x, sy = swimmer.y - other.y
        const d = Math.hypot(sx, sy)
        if (d > 0.0001 && d < 0.07) {
          const strength = (0.07 - d) * 0.38
          desiredX += sx / d * strength
          desiredY += sy / d * strength
        }
      })
      // Different individuals continually make tiny corrections with their pectoral fins.
      desiredY += Math.sin(time * 1.2 + swimmer.phase) * 0.0007
      const acceleration = swimmer.behavior === 2 ? 3.2 : 1.1
      const ease = 1 - Math.exp(-acceleration * dt)
      swimmer.vx += (desiredX - swimmer.vx) * ease
      swimmer.vy += (desiredY - swimmer.vy) * ease
      const speed = Math.hypot(swimmer.vx, swimmer.vy)
      if (speed > 0.12) { swimmer.vx *= 0.12 / speed; swimmer.vy *= 0.12 / speed }
      swimmer.x = clamp(swimmer.x + swimmer.vx * dt, TANK.left, TANK.right)
      swimmer.y = clamp(swimmer.y + swimmer.vy * dt, TANK.top, TANK.bottom)
      if ((swimmer.x === TANK.left && swimmer.vx < 0) || (swimmer.x === TANK.right && swimmer.vx > 0)) swimmer.vx *= -0.3
      if ((swimmer.y === TANK.top && swimmer.vy < 0) || (swimmer.y === TANK.bottom && swimmer.vy > 0)) swimmer.vy *= -0.3
      if (Math.abs(swimmer.vx) > 0.0018) {
        swimmer.facing += (Math.sign(swimmer.vx) - swimmer.facing) * (1 - Math.exp(-4.1 * dt))
      }
      swimmer.depth += (swimmer.targetDepth - swimmer.depth) * (1 - Math.exp(-0.16 * dt))
      swimmer.activity += (clamp(speed / SPECIES[swimmer.species].speed, 0.05, 2.8) - swimmer.activity) * ease
      swimmer.finTime += dt * (1.5 + swimmer.activity * 5.2)
    })
  }
}

export interface BottomDweller {
  x: number; y: number; targetX: number; targetY: number; speed: number
  decisionIn: number; kind: number; rng: number; localTime: number
}
export function createBottomLife(random = Math.random): BottomDweller[] {
  return [0, 1, 2, 3].map(kind => ({
    x: [0.33, 0.59, 0.77, 0.49][kind], y: [0.671, 0.763, 0.755, 0.775][kind],
    targetX: [0.33, 0.59, 0.77, 0.49][kind], targetY: [0.671, 0.763, 0.755, 0.775][kind],
    speed: 0, decisionIn: 0.5 + random() * 9, kind, rng: Math.floor(random() * 0xffffffff), localTime: random() * 10,
  }))
}
export function stepBottomLife(animals: BottomDweller[], elapsed: number, current: number) {
  const dt = clamp(elapsed, 0, 0.05) * Math.max(0, current)
  if (!Number.isFinite(dt) || dt === 0) return
  animals.forEach(animal => {
    const random = () => {
      animal.rng = (Math.imul(animal.rng, 1664525) + 1013904223) >>> 0
      return animal.rng / 4294967296
    }
    animal.decisionIn -= dt
    if (animal.decisionIn <= 0) {
      const moving = random() > (animal.kind === 0 ? 0.50 : 0.22)
      animal.speed = moving ? [0.006, 0.00065, 0.0023, 0.00008][animal.kind] * (0.6 + random()) : 0
      animal.decisionIn = [3, 15, 6, 50][animal.kind] * (0.7 + random() * 1.7)
      if (animal.kind === 0) {
        const perches = [[0.33, 0.671], [0.37, 0.662], [0.26, 0.686], [0.41, 0.713]]
        const perch = perches[Math.floor(random() * perches.length)]
        animal.targetX = perch[0]; animal.targetY = perch[1]
      } else {
        animal.targetX = [0, 0.49, 0.67, 0.46][animal.kind] + random() * [0, 0.20, 0.17, 0.10][animal.kind]
        animal.targetY = [0, 0.763, 0.755, 0.774][animal.kind] + (random() - 0.5) * 0.006
      }
    }
    const dx = animal.targetX - animal.x, dy = animal.targetY - animal.y
    const distance = Math.hypot(dx, dy)
    const move = Math.min(distance, animal.speed * dt)
    if (distance > 0) { animal.x += dx / distance * move; animal.y += dy / distance * move }
    animal.localTime += dt * (animal.speed > 0 ? 1 : 0.35)
  })
}
