import vertSource from './shaders/fullscreen.vert?raw';
import fragSource from './shaders/fractal.frag?raw';
import { createFullscreenQuad, createProgram } from './webgl.js';
import { SCENES } from './scenes.js';
import { mulberry32, pick, randRange, shuffle } from './random.js';

const MODE_ID = { julia: 0, mandelbrot: 1, newton: 2 };

const DEFAULTS = {
  maxZoomSpeed: 2,
  zoomMin: 0.05,
  zoomMax: 1e6,
  maxIterations: 140,
};

export const createFractalRenderer = (parent, options = {}) => {
  const opts = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.className = 'fractal-canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    zIndex: '0',
  });
  (parent || document.body).appendChild(canvas);

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    console.error('WebGL2 not available');
    return null;
  }

  const program = createProgram(gl, vertSource, fragSource);
  if (!program) return null;
  gl.useProgram(program);
  createFullscreenQuad(gl, program);

  const u = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    center: gl.getUniformLocation(program, 'u_center'),
    zoom: gl.getUniformLocation(program, 'u_zoom'),
    maxIterations: gl.getUniformLocation(program, 'u_max_iterations'),
    mode: gl.getUniformLocation(program, 'u_mode'),
    time: gl.getUniformLocation(program, 'u_time'),
    colorShift: gl.getUniformLocation(program, 'u_color_shift'),
    palette: gl.getUniformLocation(program, 'u_palette'),
    c: gl.getUniformLocation(program, 'u_c'),
    power: gl.getUniformLocation(program, 'u_power'),
    newtonPower: gl.getUniformLocation(program, 'u_newton_power'),
    relaxation: gl.getUniformLocation(program, 'u_relaxation'),
  };

  let rng = mulberry32(1);
  let dirty = true;
  let deck = [];
  let deckIndex = 0;

  const state = {
    seed: 0,
    sceneId: '',
    mode: 'mandelbrot',
    power: 2,
    zoom: 1,
    targetZoom: 1,
    autoZoomSpeed: 0,
    center: { x: 0, y: 0 },
    homeCenter: { x: 0, y: 0 },
    c: { cr: -0.7, ci: 0.27015 },
    cTarget: { cr: -0.7, ci: 0.27015 },
    palette: 0,
    colorShift: 1.2,
    colorShiftTarget: 1.2,
    newtonPower: 3,
    relaxation: 1,
    flowSpeed: 1,
    time: 0,
    hitPhase: 0,
  };

  const rebuildDeck = () => {
    deck = shuffle(
      rng,
      SCENES.map((_, i) => i).filter((i) => SCENES[i].id !== state.sceneId)
    );
    if (!deck.length) deck = shuffle(rng, SCENES.map((_, i) => i));
    deckIndex = 0;
  };

  const resize = (width = window.innerWidth, height = window.innerHeight) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = Math.max(2, Math.floor(width * dpr));
    const h = Math.max(2, Math.floor(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      dirty = true;
    }
  };

  const restyle = () => {
    state.palette = (rng() * 8) | 0;
    state.colorShift = randRange(rng, 0.85, 3.2);
    state.colorShiftTarget = state.colorShift;
    state.flowSpeed = randRange(rng, 0.6, 2.2);
    state.time += randRange(rng, 0.5, 2.0);
  };

  const applyScene = (scene, { jitter = true } = {}) => {
    state.sceneId = scene.id;
    state.mode = scene.mode;
    state.power = scene.power ?? 2;
    state.autoZoomSpeed = 0;

    const zoom = jitter ? scene.zoom * randRange(rng, 0.85, 1.25) : scene.zoom;
    const nudge = jitter ? 0.05 / zoom : 0;
    state.zoom = zoom;
    state.targetZoom = zoom;
    state.homeCenter = {
      x: scene.center.x + randRange(rng, -nudge, nudge),
      y: scene.center.y + randRange(rng, -nudge, nudge),
    };
    state.center = { ...state.homeCenter };

    if (scene.c) {
      const cJ = jitter ? 0.01 : 0;
      state.c = {
        cr: scene.c.cr + randRange(rng, -cJ, cJ),
        ci: Math.max(-0.7, Math.min(0.7, scene.c.ci + randRange(rng, -cJ, cJ))),
      };
      state.cTarget = { ...state.c };
    }
    if (scene.newtonPower != null) state.newtonPower = scene.newtonPower;
    if (scene.relaxation != null) {
      state.relaxation = scene.relaxation + (jitter ? randRange(rng, -0.08, 0.08) : 0);
    }

    restyle();
    dirty = true;
  };

  const jumpScene = () => {
    if (deckIndex >= deck.length) rebuildDeck();
    applyScene(SCENES[deck[deckIndex++]]);
  };

  const randomizeSession = (seed = (Math.random() * 1e9) | 0) => {
    state.seed = seed >>> 0;
    rng = mulberry32(state.seed);
    state.sceneId = '';
    rebuildDeck();
    jumpScene();
    state.hitPhase = 0;
    return state.seed;
  };

  const resetZoomAndChange = () => {
    jumpScene();
    state.autoZoomSpeed = 0;
    dirty = true;
  };

  const changeAndStartZoom = (speed = 1) => {
    jumpScene();
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const startZoom = (speed = 1) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const setZoomSpeed = (t) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, t)) * opts.maxZoomSpeed;
  };

  const draw = () => {
    gl.useProgram(program);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform2f(u.center, state.center.x, state.center.y);
    gl.uniform1f(u.zoom, state.zoom);
    gl.uniform1i(u.maxIterations, opts.maxIterations);
    gl.uniform1i(u.mode, MODE_ID[state.mode] ?? 1);
    gl.uniform1f(u.time, state.time);
    gl.uniform1f(u.colorShift, state.colorShift);
    gl.uniform1i(u.palette, state.palette);
    gl.uniform2f(u.c, state.c.cr, state.c.ci);
    gl.uniform1f(u.power, state.power);
    gl.uniform1f(u.newtonPower, state.newtonPower);
    gl.uniform1f(u.relaxation, state.relaxation);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    dirty = false;
  };

  const render = (dt, playing) => {
    if (playing) {
      if (state.autoZoomSpeed !== 0) {
        state.targetZoom = Math.min(
          opts.zoomMax,
          Math.max(opts.zoomMin, state.targetZoom * Math.exp(state.autoZoomSpeed * dt * 0.4))
        );
        state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 8);
      } else {
        state.zoom = state.targetZoom;
      }

      state.colorShift += (state.colorShiftTarget - state.colorShift) * Math.min(1, dt * 4);
      state.c.cr += (state.cTarget.cr - state.c.cr) * Math.min(1, dt * 3);
      state.c.ci += (state.cTarget.ci - state.c.ci) * Math.min(1, dt * 3);

      const drift = 0.02 / state.zoom;
      state.center.x = state.homeCenter.x + Math.sin(state.time * 0.19) * drift;
      state.center.y = state.homeCenter.y + Math.cos(state.time * 0.15) * drift;
      state.time += dt * 0.4 * state.flowSpeed;
      dirty = true;
    }

    if (dirty) draw();
  };

  randomizeSession();
  resize();
  draw();

  return {
    canvas,
    render,
    resize,
    setZoomSpeed,
    resetZoomAndChange,
    changeAndStartZoom,
    startZoom,
    randomizeSession,
    resetView: randomizeSession,
    state,
  };
};
