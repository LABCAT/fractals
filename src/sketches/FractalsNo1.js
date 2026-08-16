import p5 from "p5";
import "@lib/p5.audioReact.js";
import { createFractalRenderer } from "@lib/fractals/createFractalRenderer.js";

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/FractalsNo1.mp3';
const midi = base + 'audio/FractalsNo1.mid';

const sketch = (p) => {
  p.canvasWidth = window.innerWidth;
  p.canvasHeight = window.innerHeight;
  p.song = null;
  p.audioLoaded = false;
  p.renderer = null;
  p.prevNow = 0;

  p.setup = async () => {
    p.noCanvas();
    const host = document.getElementById('sketch-canvas') || document.body;
    p.renderer = createFractalRenderer(host);
    if (!p.renderer) return;

    p.canvas = p.renderer.canvas;
    p.canvas.classList.add('p5Canvas', 'p5Canvas--cursor-play');
    p.canvas.style.zIndex = '1';
    p.canvas.addEventListener('pointerdown', () => p.togglePlayback());
    document.getElementById('play-icon')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      p.togglePlayback();
    });
    p.renderer.resize(p.canvasWidth, p.canvasHeight);

    await p.loadSong(audio, midi, (midiData) => {
      if (!midiData) return;
      p.scheduleCueSet(midiData.tracks[2].notes, 'executeTrack2');
      // p.scheduleCueSet(midiData.tracks[9].controlChanges[74] ?? [], 'executeTrack9', true);
    });
  };

  p.draw = () => {
    if (!p.renderer) return;
    const now = performance.now();
    const dt = p.prevNow ? Math.min(0.05, (now - p.prevNow) / 1000) : 0.016;
    p.prevNow = now;
    p.renderer.render(dt, !!(p.song && p.song.isPlaying()));
  };

  p.executeTrack2 = (note) => {
    const step = (note.currentCue % 6);
    if (step === 1) {
      p.renderer?.resetZoomAndChange();
    } else if (step === 0) {
      p.renderer?.changeAndStartZoom(1);
    } else {
      p.renderer?.noteHit(note);
    }
  };

  p.executeTrack9 = (cc) => {
    p.renderer?.setZoomSpeed(cc.value ?? 0);
  };

  p.resetAnimation = () => {
    p.renderer?.randomizeSession();
  };

  p.windowResized = () => {
    p.canvasWidth = window.innerWidth;
    p.canvasHeight = window.innerHeight;
    p.renderer?.resize(p.canvasWidth, p.canvasHeight);
  };
};

new p5(sketch);
