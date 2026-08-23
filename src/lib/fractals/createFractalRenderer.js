import vertSource from './shaders/fullscreen.vert?raw';
import fragSource from './shaders/fractal.frag?raw';
import invertSource from './shaders/invert.frag?raw';
import { createFullscreenQuad, createProgram } from './webgl.js';
import { SCENES } from './scenes.js';
import { mulberry32, pick, randRange, shuffle } from './random.js';

const MODE_ID = { julia: 0, mandelbrot: 1, newton: 2 };

const MODE_LABEL = {
  julia: 'Julia',
  mandelbrot: 'Mandelbrot',
  newton: 'Newton',
};

const STILL = SCENES.filter((s) => s.zoom < 1);
const DIVE = SCENES.filter((s) => s.zoom >= 1);

const DEFAULTS = {
  maxZoomSpeed: 5,
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

  const badge = document.getElementById('fractal-badge');
  const updateBadge = () => {
    if (!badge) return;
    badge.textContent =
      state.view === 'gasket' ? 'Inversion' : MODE_LABEL[state.mode] ?? state.mode;
  };

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
    reveal: gl.getUniformLocation(program, 'u_reveal'),
  };

  const iu = {
    resolution: gl.getUniformLocation(invertProgram, 'u_resolution'),
    time: gl.getUniformLocation(invertProgram, 'u_time'),
    hit: gl.getUniformLocation(invertProgram, 'u_hit'),
    drive: gl.getUniformLocation(invertProgram, 'u_drive'),
    bounce: gl.getUniformLocation(invertProgram, 'u_bounce'),
    span: gl.getUniformLocation(invertProgram, 'u_span'),
    scale: gl.getUniformLocation(invertProgram, 'u_scale'),
    fold: gl.getUniformLocation(invertProgram, 'u_fold'),
    kick: gl.getUniformLocation(invertProgram, 'u_kick'),
    home: gl.getUniformLocation(invertProgram, 'u_home'),
    palette: gl.getUniformLocation(invertProgram, 'u_palette'),
    colorShift: gl.getUniformLocation(invertProgram, 'u_color_shift'),
    reveal: gl.getUniformLocation(invertProgram, 'u_reveal'),
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
    reveal: 0.4,
    revealTarget: 0.4,
  };

  const overlay = {
    hit: 0,
    drive: 0.12,
    driveTarget: 0.12,
    kick: { x: 0, y: 0 },
    kickTarget: { x: 0, y: 0 },
    home: { x: 0.62, y: 0.18 },
    homeTarget: { x: 0.62, y: 0.18 },
    bounce: 0,
    bounceVel: 0,
    scale: 1.36,
    scaleTarget: 1.36,
    span: 6.5,
    spanTarget: 6.5,
    fold: 8,
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
    const nudge = scene.lockCenter ? 0 : 0.05 / zoom;
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
      state.relaxation = Math.max(0.9, Math.min(1.15, scene.relaxation + randRange(rng, -0.04, 0.04)));
    }

    restyle();
    state.view = 'set';
    overlay.hit = 0;
    overlay.drive = 0.2;
    overlay.driveTarget = 0.2;
    overlay.kick = { x: 0, y: 0 };
    overlay.kickTarget = { x: 0, y: 0 };
    overlay.homeTarget = { ...overlay.home };
    overlay.scaleTarget = overlay.scale;
    overlay.spanTarget = overlay.span;
    overlay.bounce = 0;
    overlay.bounceVel = 0;
    updateBadge();
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
    state.reveal = 0.4;
    state.revealTarget = 0.4;
    return state.seed;
  };

  const resetZoomAndChange = () => {
    applyScene(take(stillDeck, STILL));
    state.autoZoomSpeed = 0;
    dirty = true;
  };

  const changeAndStartZoom = (speed = 1) => {
    const others = SCENES.filter((s) => s.mode !== state.mode && s.id !== state.sceneId);
    const pool = others.length === 0 ? DIVE : others;
    applyScene(pick(rng, pool));
    stillDeck = [];
    diveDeck = [];
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const noteHit = (note = {}) => {
    state.view = 'gasket';
    state.autoZoomSpeed = 0;
    const vel = Number.isFinite(note.velocity) ? note.velocity : 0.85;
    const style = rng() < 0.8 ? 'open' : 'tight';
    const len = style === 'open' ? randRange(rng, 0.74, 0.86) : randRange(rng, 0.50, 0.58);
    const ang = rng() * Math.PI * 2;
    overlay.homeTarget = {
      x: Math.cos(ang) * len,
      y: Math.sin(ang) * len,
    };
    const rot = rng() * Math.PI * 2;
    overlay.kickTarget.x = Math.cos(rot) * 0.04;
    overlay.kickTarget.y = Math.sin(rot) * 0.04;
    overlay.hit = 1;
    overlay.drive = Math.max(overlay.drive, 0.55 + vel * 0.4);
    overlay.driveTarget = 0.85 + vel * 0.15;
    overlay.scaleTarget = randRange(rng, 1.3, 1.42);
    overlay.spanTarget = style === 'open' ? 6.5 : randRange(rng, 10.8, 11.6);
    overlay.fold = 8;
    overlay.bounce = -0.96;
    overlay.bounceVel = 8 * vel;
    updateBadge();
    dirty = true;
  };

  const startZoom = (speed = 1) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, speed)) * opts.maxZoomSpeed;
    dirty = true;
  };

  const setZoomSpeed = (t) => {
    state.autoZoomSpeed = Math.max(0, Math.min(1, t)) * opts.maxZoomSpeed;
  };

  const setReveal = (t) => {
    state.revealTarget = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
    dirty = true;
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
    gl.uniform1f(u.reveal, state.reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const drawGasket = () => {
    bindQuad(invertProgram);
    gl.uniform2f(iu.resolution, canvas.width, canvas.height);
    gl.uniform1f(iu.time, overlay.time);
    gl.uniform1f(iu.hit, overlay.hit);
    gl.uniform1f(iu.drive, overlay.drive);
    gl.uniform1f(iu.bounce, overlay.bounce);
    gl.uniform1f(iu.span, overlay.span);
    gl.uniform1f(iu.scale, overlay.scale);
    gl.uniform1i(iu.fold, overlay.fold);
    gl.uniform2f(iu.kick, overlay.kick.x, overlay.kick.y);
    gl.uniform2f(iu.home, overlay.home.x, overlay.home.y);
    gl.uniform1i(iu.palette, state.palette);
    gl.uniform1f(iu.colorShift, state.colorShift);
    gl.uniform1f(iu.reveal, state.reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const draw = () => {
    gl.disable(gl.BLEND);
    if (state.view === 'gasket') drawGasket();
    else drawSet();
    dirty = false;
  };

  const render = (dt, playing) => {
    if (Math.abs(state.reveal - state.revealTarget) > 1e-4) {
      state.reveal += (state.revealTarget - state.reveal) * Math.min(1, dt * 28);
      dirty = true;
    } else {
      state.reveal = state.revealTarget;
    }

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
      overlay.driveTarget += (0.75 - overlay.driveTarget) * dt * 0.35;
      overlay.kick.x += (overlay.kickTarget.x - overlay.kick.x) * Math.min(1, dt * 10);
      overlay.kick.y += (overlay.kickTarget.y - overlay.kick.y) * Math.min(1, dt * 10);
      const a0 = Math.atan2(overlay.home.y, overlay.home.x);
      const a1 = Math.atan2(overlay.homeTarget.y, overlay.homeTarget.x);
      let da = a1 - a0;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      const l0 = Math.hypot(overlay.home.x, overlay.home.y) || 0.8;
      const l1 = Math.hypot(overlay.homeTarget.x, overlay.homeTarget.y);
      const t = Math.min(1, dt * 7);
      const a = a0 + da * t;
      const l = l0 + (l1 - l0) * t;
      overlay.home.x = Math.cos(a) * l;
      overlay.home.y = Math.sin(a) * l;
      overlay.scale += (overlay.scaleTarget - overlay.scale) * t;
      overlay.span += (overlay.spanTarget - overlay.span) * t;
      overlay.hit += (0 - overlay.hit) * Math.min(1, dt * 4.5);

      // Squash → expand spring (low damp = more bounce)
      const bStiff = 140;
      const bDamp = 5.5;
      overlay.bounceVel += (-bStiff * overlay.bounce - bDamp * overlay.bounceVel) * dt;
      overlay.bounce += overlay.bounceVel * dt;
      overlay.bounce = Math.max(-0.98, Math.min(0.48, overlay.bounce));

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
    setReveal,
    noteHit,
    startZoom,
    randomizeSession,
    resetView: randomizeSession,
    resetZoomAndChange,
    changeAndStartZoom,
    state,
  };
};

