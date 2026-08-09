export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randRange = (rng, min, max) => min + rng() * (max - min);

export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

export const shuffle = (rng, list) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const JULIA_SEEDS = [
  { cr: -0.7, ci: 0.27015 },
  { cr: -0.7269, ci: 0.1889 },
  { cr: -0.123, ci: 0.745 },
  { cr: -0.39054, ci: -0.58679 },
  { cr: -0.4, ci: 0.6 },
  { cr: 0.285, ci: 0.01 },
  { cr: -0.835, ci: -0.2321 },
  { cr: -0.70176, ci: -0.3842 },
];

export const MANDEL_ANCHORS = [
  { x: -0.743643887037151, y: 0.13182590420533 },
  { x: 0.275, y: 0.0 },
  { x: -0.088, y: 0.654 },
  { x: -1.775, y: 0.0 },
  { x: -0.16, y: 1.0405 },
  { x: -0.761574, y: -0.0847596 },
  { x: -1.25066, y: 0.02012 },
];
