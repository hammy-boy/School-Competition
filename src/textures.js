import * as THREE from 'three';

// Every surface in this game is painted into a canvas at boot. No image assets,
// so the whole build stays a folder of text files.

export function canvasTex(size, painter, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c, c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function blotch(ctx, s, count, alpha, hues, rmin, rmax) {
  for (let i = 0; i < count; i++) {
    const r = rmin + Math.random() * (rmax - rmin);
    const x = Math.random() * s, y = Math.random() * s;
    const h = hues[(Math.random() * hues.length) | 0];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${h[0]},${h[1]}%,${h[2]}%,${alpha})`);
    g.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}

export const concreteTex = () => canvasTex(512, (c, x, s) => {
  x.fillStyle = '#3a3630'; x.fillRect(0, 0, s, s);
  blotch(x, s, 220, 0.5, [[36, 8, 22], [30, 6, 30], [20, 10, 12], [45, 5, 38]], 12, 90);
  x.globalAlpha = 0.05;
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = i % 2 ? '#000' : '#cfc7b6';
    x.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  x.globalAlpha = 0.22;
  for (let i = 0; i < 12; i++) {           // oil stains
    x.fillStyle = '#100d09';
    x.beginPath();
    x.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 12 + Math.random() * 40, Math.random() * 3, 0, 7);
    x.fill();
  }
  x.globalAlpha = 1;
}, 4);

export const rustTex = () => canvasTex(256, (c, x, s) => {
  x.fillStyle = '#5b4a3c'; x.fillRect(0, 0, s, s);
  blotch(x, s, 130, 0.6, [[18, 55, 26], [10, 60, 16], [28, 40, 34], [0, 0, 12]], 6, 46);
  x.globalAlpha = 0.5;
  for (let i = 0; i < 60; i++) {           // rust runs
    x.strokeStyle = `hsl(${10 + Math.random() * 18},50%,${12 + Math.random() * 16}%)`;
    x.lineWidth = 1 + Math.random() * 2.5;
    const sx = Math.random() * s, sy = Math.random() * s * 0.5;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (Math.random() - 0.5) * 12, sy + 30 + Math.random() * 90); x.stroke();
  }
  x.globalAlpha = 1;
}, 2);

export const wallTex = () => canvasTex(512, (c, x, s) => {
  x.fillStyle = '#2e2a25'; x.fillRect(0, 0, s, s);
  blotch(x, s, 180, 0.45, [[24, 12, 18], [36, 8, 26], [12, 20, 12]], 16, 100);
  x.globalAlpha = 0.16;                   // damp rising up the stone
  const g = x.createLinearGradient(0, s, 0, 0);
  g.addColorStop(0, '#0a0d0c'); g.addColorStop(0.55, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.globalAlpha = 0.1;
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = '#000'; x.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * s;
    x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (Math.random() - 0.5) * 20); x.stroke();
  }
  x.globalAlpha = 1;
}, 3);

// ---- the silo ----

/** the wall of a hundred-metre shaft: rust running straight down, ring seams */
export const siloWallTex = () => canvasTex(512, (c, x, s) => {
  x.fillStyle = '#332a22'; x.fillRect(0, 0, s, s);
  blotch(x, s, 150, 0.5, [[20, 48, 20], [12, 55, 12], [30, 35, 26], [0, 0, 8]], 20, 120);
  for (let i = 0; i < 240; i++) {          // weather runs, always downward
    const sx = Math.random() * s, len = 40 + Math.random() * 260;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `hsla(${8 + Math.random() * 16},60%,${10 + Math.random() * 14}%,0.5)`);
    g.addColorStop(1, 'hsla(0,0%,0%,0)');
    x.strokeStyle = g; x.lineWidth = 1 + Math.random() * 5;
    x.beginPath(); x.moveTo(sx, Math.random() * s * 0.4); x.lineTo(sx + (Math.random() - 0.5) * 6, len); x.stroke();
  }
  x.globalAlpha = 0.55;                    // bolted ring seams
  for (let y = 0; y < s; y += 64) {
    x.fillStyle = '#100c09'; x.fillRect(0, y, s, 5);
    x.fillStyle = '#4a3d31'; x.fillRect(0, y + 5, s, 1.5);
    for (let bx = 12; bx < s; bx += 34) {
      x.fillStyle = '#0b0908'; x.beginPath(); x.arc(bx, y + 14, 2.6, 0, 7); x.fill();
    }
  }
  x.globalAlpha = 1;
}, 1);

/** steel grating: you have to be able to see the dark through the floor */
export const gratingTex = () => canvasTex(256, (c, x, s) => {
  x.fillStyle = '#050403'; x.fillRect(0, 0, s, s);      // the void below
  x.fillStyle = '#4b433a';
  const bar = 32, slot = 12;
  for (let gx = 0; gx < s; gx += bar) x.fillRect(gx, 0, bar - slot, s);
  x.fillStyle = '#3a332c';
  for (let gy = 0; gy < s; gy += 64) x.fillRect(0, gy, s, 9);   // cross bars
  x.globalAlpha = 0.5;                                    // rust eats the paint
  blotch(x, s, 70, 0.5, [[18, 55, 22], [10, 60, 13], [28, 40, 30]], 4, 26);
  x.globalAlpha = 0.35;
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? '#000' : '#8b8175';
    x.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  x.globalAlpha = 1;
}, 1);

export const smokeTex = () => canvasTex(64, (c, x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(210,205,195,0.5)');
  g.addColorStop(1, 'rgba(210,205,195,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});

/** soft white puff — steam, and the chemical exhaust the vents suck out */
export const puffTex = () => canvasTex(128, (c, x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});
