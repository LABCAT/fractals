import vertSource from './shaders/fullscreen.vert?raw';
import fragSource from './shaders/fractal.frag?raw';
import invertSource from './shaders/invert.frag?raw';
import { createFullscreenQuad, createProgram } from './webgl.js';
import { SCENES } from './scenes.js';
import { mulberry32, pick, randRange, shuffle } from './random.js';

const MODE_ID = { julia: 0, mandelbrot: 1, newton: 2 };

const STILL = SCENES.filter((s) => s.zoom < 1);
const DIVE = SCENES.filter((s) => s.zoom >= 1);

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
  const invertProgram = createProgram(gl, vertSource, invertSource);
  if (!program || !invertProgram) return null;
  gl.useProgram(program);
  const quad = createFullscreenQuad(gl, program);

  const bindQuad = (prog) => {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };

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

  const iu = {
    resolution: gl.getUniformLocation(invertProgram, 'u_resolution'),
    time: gl.getUniformLocation(invertProgram, 'u_time'),
    hit: gl.getUniformLocation(invertProgram, 'u_hit'),
    drive: gl.getUniformLocation(invertProgram, 'u_drive'),
    kick: gl.getUniformLocation(invertProgram, 'u_kick'),
    home: gl.getUniformLocation(invertProgram, 'u_home'),
    palette: gl.getUniformLocation(invertProgram, 'u_palette'),
    colorShift: gl.getUniformLocation(invertProgram, 'u_color_shift'),
  };

  let rng = mulberry32(1);
  let dirty = true;
  let stillDeck = [];
  let diveDeck = [];

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
    view: 'set',
  };

  const overlay = {
    hit: 0,
    drive: 0.12,
    driveTarget: 0.12,
    kick: { x: 0, y: 0 },
    kickTarget: { x: 0, y: 0 },
    home: { x: 0.62, y: 0.18 },
    time: 0,
  };

  const take = (deck, pool) => {
    if (!deck.length) {
      deck.push(
        ...shuffle(
          rng,
          pool.map((_, i) => i).filter((i) => pool[i].id !== state.sceneId)
        )
      );
      if (!deck.length) deck.push(...shuffle(rng, pool.map((_, i) => i)));
    }
    return pool[deck.pop()];
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
    state.palette = (state.palette + 1 + ((rng() * 6) | 0)) % 8;
    state.colorShift = randRange(rng, 0.85, 3.2);
    state.colorShiftTarget = state.colorShift;
    state.flowSpeed = randRange(rng, 0.6, 2.2);
    state.time += randRange(rng, 0.5, 2.0);
  };

  const applyScene = (scene) => {
    state.sceneId = scene.id;
    state.mode = scene.mode;
    state.power = scene.power ?? 2;

    const zoom = scene.zoom * randRange(rng, 0.85, 1.25);
    const nudge = 0.05 / zoom;
    state.zoom = zoom;
    state.targetZoom = zoom;
    state.homeCenter = {
      x: scene.center.x + randRange(rng, -nudge, nudge),
      y: scene.center.y + randRange(rng, -nudge, nudge),
    };
    state.center = { ...state.homeCenter };

    if (scene.c) {
      state.c = {
        cr: scene.c.cr + randRange(rng, -0.01, 0.01),
        ci: Math.max(-0.7, Math.min(0.7, scene.c.ci + randRange(rng, -0.01, 0.01))),
      };
      state.cTarget = { ...state.c };
    }
    if (scene.newtonPower != null) state.newtonPower = scene.newtonPower;
    if (scene.relaxation != null) {
      state.relaxation = scene.relaxation + randRange(rng, -0.08, 0.08);
    }

    restyle();
    state.view = 'set';
    overlay.hit = 0;
    overlay.drive = 0.2;
    overlay.driveTarget = 0.2;
    overlay.kick = { x: 0, y: 0 };
    overlay.kickTarget = { x: 0, y: 0 };
    dirty = true;
  };

  const randomizeSession = (seed = (Math.random() * 1e9) | 0) => {
    state.seed = seed >>> 0;
    rng = mulberry32(state.seed);
    state.sceneId = '';
    stillDeck = [];
    diveDeck = [];
    applyScene(pick(rng, STILL));
    state.autoZoomSpeed = 0;
    return state.seed;
  };

  const resetZoomAndChange = () => {
    applyScene(take(stillDeck, STILL));
    state.autoZoomSpeed = 0;
    dirty = true;
  };

  const changeAndStartZoom = (speed = 1) => {
    const others = SCENES.filter((s) => s.mode !== state.mode && s.id !== state.sceneId);
    const pool = others.length ? others : DIVE;
    applyScene(pick(rng, pool));
    stillDeck = [];
    diveDeck = [];
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const noteHit = (note = {}) => {
    state.view = 'gasket';
    state.autoZoomSpeed = 0;
    const midi = Number.isFinite(note.midi) ? note.midi : 60;
    const vel = Number.isFinite(note.velocity) ? note.velocity : 0.85;
    const theta = (midi / 12) * Math.PI * 2;
    const r = 0.35 + vel * 0.85;
    overlay.kickTarget.x = Math.cos(theta) * r;
    overlay.kickTarget.y = Math.sin(theta) * r;
    overlay.hit = 1;
    overlay.drive = Math.max(overlay.drive, 0.7);
    overlay.driveTarget = 1;
    overlay.home = {
      x: 0.5 + randRange(rng, -0.15, 0.15),
      y: 0.2 + randRange(rng, -0.15, 0.15),
    };
    dirty = true;
  };

  const startZoom = (speed = 1) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const setZoomSpeed = (t) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, t)) * opts.maxZoomSpeed;
  };

  const drawSet = () => {
    bindQuad(program);
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
  };

  const drawGasket = () => {
    bindQuad(invertProgram);
    gl.uniform2f(iu.resolution, canvas.width, canvas.height);
    gl.uniform1f(iu.time, overlay.time);
    gl.uniform1f(iu.hit, overlay.hit);
    gl.uniform1f(iu.drive, overlay.drive);
    gl.uniform2f(iu.kick, overlay.kick.x, overlay.kick.y);
    gl.uniform2f(iu.home, overlay.home.x, overlay.home.y);
    gl.uniform1i(iu.palette, state.palette);
    gl.uniform1f(iu.colorShift, state.colorShift);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const draw = () => {
    gl.disable(gl.BLEND);
    if (state.view === 'gasket') drawGasket();
    else drawSet();
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

      overlay.drive += (overlay.driveTarget - overlay.drive) * Math.min(1, dt * 6);
      overlay.driveTarget += (0.55 - overlay.driveTarget) * dt * 0.45;
      overlay.kick.x += (overlay.kickTarget.x - overlay.kick.x) * Math.min(1, dt * 14);
      overlay.kick.y += (overlay.kickTarget.y - overlay.kick.y) * Math.min(1, dt * 14);
      overlay.kickTarget.x += (0 - overlay.kickTarget.x) * dt * 1.8;
      overlay.kickTarget.y += (0 - overlay.kickTarget.y) * dt * 1.8;
      overlay.hit += (0 - overlay.hit) * Math.min(1, dt * 5);
      overlay.time += dt * (0.4 + overlay.hit * 1.6);
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
    noteHit,
    startZoom,
    randomizeSession,
    resetView: randomizeSession,
    resetZoomAndChange,
    changeAndStartZoom,
    state,
  };
};
