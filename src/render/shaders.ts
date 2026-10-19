const NOISE = `
float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7)) + seed * 0.013) * 43758.5453); }
// Value noise that repeats every 'period' cells, so tiles join seamlessly.
float noise(float2 p, float2 period) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float2 j = mod(i + 1.0, period);
  i = mod(i, period);
  return mix(mix(hash(i), hash(float2(j.x, i.y)), f.x), mix(hash(float2(i.x, j.y)), hash(j), f.x), f.y);
}`;

/** Weave tile in logical units: 80 plain-weave threads per 96-unit tile, seamless. */
export const LINEN_TILE = 96;
export const LINEN = `
uniform float seed;
${NOISE}
half4 main(float2 p) {
  float2 q = p / 1.2;
  float row = noise(float2(floor(q.y) * 1.0, q.x * 0.05), float2(80.0, 4.0));
  float col = noise(float2(floor(q.x) * 1.0 + 7.0, q.y * 0.05), float2(80.0, 4.0));
  float slub = smoothstep(0.7, 0.95, noise(float2(floor(q.y), q.x * 0.1), float2(80.0, 8.0)));
  float wx = 0.5 + 0.5 * cos(6.2831 * q.x);
  float wy = 0.5 + 0.5 * cos(6.2831 * q.y);
  float over = step(0.5, fract((floor(q.x) + floor(q.y)) * 0.5));
  float thread = mix(wy, wx, over);
  float hole = (1.0 - wx) * (1.0 - wy);
  float shade = (thread - 0.5) * 0.075 - hole * 0.075 + (row - 0.5) * 0.05 + (col - 0.5) * 0.03 + slub * 0.035;
  float3 base = float3(0.902, 0.874, 0.808);
  return half4(half3(base + shade), 1.0);
}`;

/** Broad uneven light and dye on the cloth; premultiplied tint over the weave. */
export const MOTTLE = `
uniform float seed;
${NOISE}
half4 main(float2 p) {
  float n = noise(p * 0.011, float2(1000.0)) * 0.6 + noise(p * 0.03, float2(1000.0)) * 0.4;
  float a = abs(n - 0.5) * 0.22;
  float3 tint = n > 0.5 ? float3(1.0, 0.99, 0.96) : float3(0.45, 0.38, 0.28);
  return half4(half3(tint * a), a);
}`;

/** Uneven condensation haze; output is premultiplied fog colour. */
export const FOG = `
uniform float seed;
uniform float density;
uniform float3 tint;
${NOISE}
half4 main(float2 p) {
  float n = noise(p * 0.006, float2(1000.0)) * 0.55 + noise(p * 0.018, float2(1000.0)) * 0.3 + noise(p * 0.06, float2(1000.0)) * 0.15;
  float a = clamp(density * (0.65 + n * 0.7), 0.0, 1.0);
  return half4(half3(tint * a), a);
}`;
