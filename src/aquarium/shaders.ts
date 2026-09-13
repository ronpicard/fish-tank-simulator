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
  uniform float uMood;
  uniform float uLight;
  varying vec2 vUv;
  ${tankLighting}
  void main() {
    vec2 uv = vUv;
    float water = smoothstep(0.085, 0.095, uv.x) * (1.0 - smoothstep(0.906, 0.917, uv.x));
    water *= smoothstep(0.19, 0.21, uv.y) * (1.0 - smoothstep(0.834, 0.849, uv.y));
    float coral = (1.0 - smoothstep(0.28, 0.59, uv.y)) * water;
    float surface = exp(-pow((uv.y - 0.846) * 115.0, 2.0));
    uv.x += sin(uv.y * 30.0 + uTime * 0.8) * coral * 0.00075;
    uv.y += sin(uv.x * 76.0 - uTime * 1.1) * surface * 0.0015;
    vec3 color = texture2D(uTexture, uv).rgb;
    vec3 inside = tankLight(color, uMood, uLight);
    float caustic = pow(max(0.0, sin(uv.x * 81.0 + sin(uv.y * 44.0 + uTime * 0.35) * 1.7)), 12.0);
    inside += vec3(0.25, 0.29, 0.25) * caustic * coral * 0.028;
    color = mix(color, inside, water);
    gl_FragColor = vec4(color, 1.0);
  }
`

// A copy of the photographed coral silhouettes occludes fish swimming farther back.
export const foregroundFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uMood;
  uniform float uLight;
  varying vec2 vUv;
  ${tankLighting}
  void main() {
    vec4 texel = texture2D(uTexture, vUv);
    float y = 1.0 - vUv.y;
    float left = smoothstep(0.13, 0.16, vUv.x) * (1.0 - smoothstep(0.45, 0.50, vUv.x));
    float right = smoothstep(0.55, 0.61, vUv.x) * (1.0 - smoothstep(0.85, 0.88, vUv.x));
    float rock = (left + right) * smoothstep(0.46, 0.61, y) * (1.0 - smoothstep(0.743, 0.763, y));
    // Water is blue and dark; the rock and coral have appreciable red-channel detail.
    float detail = smoothstep(0.09, 0.20, texel.r) * smoothstep(0.025, 0.085, texel.r - texel.b * 0.38);
    gl_FragColor = vec4(tankLight(texel.rgb, uMood, uLight), rock * detail);
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
