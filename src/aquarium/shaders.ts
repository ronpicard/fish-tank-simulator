export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const tankLighting = /* glsl */ `
  vec3 tankLight(vec3 color, float mood, float light) {
    vec3 dusk = color * vec3(1.02, 0.78, 0.83);
    vec3 night = color * vec3(0.24, 0.41, 0.77);
    color = mix(color, dusk, clamp(mood, 0.0, 1.0));
    color = mix(color, night, clamp(mood - 1.0, 0.0, 1.0));
    return color * light;
  }
`

export const reefFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uSurfaceTime;
  uniform float uMood;
  uniform float uLight;
  varying vec2 vUv;
  ${tankLighting}
  void main() {
    vec2 uv = vUv;
    float water = smoothstep(0.085, 0.095, uv.x) * (1.0 - smoothstep(0.906, 0.917, uv.x));
    water *= smoothstep(0.19, 0.21, uv.y) * (1.0 - smoothstep(0.834, 0.849, uv.y));
    float surface = exp(-pow((uv.y - 0.846) * 115.0, 2.0));
    uv.y += sin(uv.x * 76.0 - uSurfaceTime * 4.0) * surface * 0.0015;
    vec3 color = texture2D(uTexture, uv).rgb;
    vec3 inside = tankLight(color, uMood, uLight);
    color = mix(color, inside, water);
    gl_FragColor = vec4(color, 1.0);
  }
`

// Static photographic silhouettes placed inside the fish's world depth range.
// Discard water pixels entirely so they never write an invisible wall into depth.
export const foregroundFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uMood;
  uniform float uLight;
  varying vec2 vUv;
  ${tankLighting}
  void main() {
    float y = 1.0 - vUv.y;
    if (vUv.x < 0.095 || vUv.x > 0.91 || y < 0.425 || y > 0.754) discard;
    vec3 color = texture2D(uTexture, vUv).rgb;
    // The clear water is blue; the photographed rocks and corals have warm detail.
    if (color.r < 0.09 || color.r - color.b * 0.48 < 0.018) discard;
    gl_FragColor = vec4(tankLight(color, uMood, uLight), 1.0);
  }
`

export const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAspect;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // A tiny stream of filter microbubbles, confined below the waterline.
    float travel = mod(uTime * (0.048 + aSize * 0.012) + aPhase, 1.0);
    p.x = (0.805 + sin(travel * 11.0 + aPhase * 6.0) * 0.008 - travel * 0.025) * 2.0 - 1.0;
    p.y = (1.0 - (0.73 - travel * 0.56) * 2.0);
    p.x *= uAspect;
    vAlpha = sin(travel * 3.14159) * 0.10;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`
export const particleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float rim = smoothstep(0.28, 0.37, d) * (1.0 - smoothstep(0.38, 0.5, d));
    gl_FragColor = vec4(0.81, 0.91, 0.93, rim * vAlpha);
  }
`
