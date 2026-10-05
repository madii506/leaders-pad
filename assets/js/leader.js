// LEADERS: every leader's face, drawn in the browser from its coin. A small bot with its archetype's hat, wearing its
// coin on its chest. The same seed always draws the same leader, so its PFP, banner and coin picture always match.
(function () {
  'use strict';
  const COLORS = ['#ff5c1f', '#2fe6c8', '#ff8fb1', '#b6ff3b', '#8b7cff', '#ffd23f', '#ff4d6d', '#4dabff'];
  const GOLD = '#f6c03e', INK = '#f7f7f9', DARK = '#16161a', VISOR = '#060607', BG = '#0d0d0f';
  const ARCH = {
    king: { title: 'King', label: 'king' }, captain: { title: 'Captain', label: 'captain' }, general: { title: 'General', label: 'general' },
    president: { title: 'President', label: 'president' }, coach: { title: 'Coach', label: 'coach' }, boss: { title: 'Boss', label: 'boss' },
  };
  const FONT = '"PJ", "Poppins", ui-sans-serif, system-ui, sans-serif';
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const colorOf = o => o.color || COLORS[hash((o.seed || '') + (o.symbol || '')) % COLORS.length];
  const archOf = o => (ARCH[o.look] ? o.look : 'king');
  const title = o => `${ARCH[archOf(o)].title} ${o.name || o.symbol || 'Leader'}`;
  const handle = o => ('@' + (String(o.symbol || 'coin').toLowerCase().replace(/[^a-z0-9]/g, '') + ARCH[archOf(o)].label).slice(0, 15));
  const bio = o => `the AI leader of $${String(o.symbol || '').toUpperCase()}. no dev to wait for, no cto lead to beg: i post, rally and answer, all day. appointed on LEADERS.`.slice(0, 160);
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function poly(g, pts, fill) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); }
  function circ(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function star(g, x, y, r, fill) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); } poly(g, p, fill); }

  // the hats: (cx, top) is the middle of the head's top edge, w the head's width, h its height
  const HATS = {
    king(g, cx, top, w, h) {
      const cw = w * 0.62, ch = cw * 0.56, cb = top + h * 0.03, t = cb - ch, band = cw * 0.24;
      poly(g, [[cx - cw / 2, cb - band], [cx - cw / 2, t + ch * 0.22], [cx - cw * 0.22, t + ch * 0.55], [cx, t], [cx + cw * 0.22, t + ch * 0.55], [cx + cw / 2, t + ch * 0.22], [cx + cw / 2, cb - band]], GOLD);
      g.fillStyle = GOLD; g.fillRect(cx - cw / 2, cb - band, cw, band);
      [[cx - cw / 2 + cw * 0.025, t + ch * 0.22], [cx, t], [cx + cw / 2 - cw * 0.025, t + ch * 0.22]].forEach(([x, y]) => circ(g, x, y, cw * 0.08, GOLD));
    },
    captain(g, cx, top, w, h) {
      const cw = w * 0.86, ch = h * 0.42, y0 = top - ch + h * 0.06;
      rr(g, cx - cw / 2, y0, cw, ch, ch * 0.45); g.fillStyle = '#f2f2f4'; g.fill();
      g.fillStyle = '#111114'; g.fillRect(cx - cw * 0.44, top - h * 0.06, cw * 0.88, h * 0.1);
      rr(g, cx - cw * 0.4, top + h * 0.02, cw * 0.8, h * 0.07, h * 0.035); g.fillStyle = '#0b0b0d'; g.fill();
      circ(g, cx, y0 + ch * 0.48, ch * 0.2, GOLD); circ(g, cx, y0 + ch * 0.48, ch * 0.09, '#f2f2f4');
    },
    general(g, cx, top, w, h) {
      const cw = w * 0.94, ch = h * 0.4, y0 = top - ch + h * 0.06;
      poly(g, [[cx - cw / 2, y0], [cx + cw / 2, y0], [cx + cw * 0.42, top - h * 0.02], [cx - cw * 0.42, top - h * 0.02]], '#4c5c35');
      g.fillStyle = '#c0392b'; g.fillRect(cx - cw * 0.42, top - h * 0.12, cw * 0.84, h * 0.1);
      rr(g, cx - cw * 0.38, top + h * 0.0, cw * 0.76, h * 0.08, h * 0.04); g.fillStyle = '#0b0b0d'; g.fill();
      star(g, cx, y0 + ch * 0.4, ch * 0.3, GOLD);
    },
    president(g, cx, top, w, h, col) {
      const tw = w * 0.56, th = h * 0.86;
      rr(g, cx - tw / 2, top - th + h * 0.04, tw, th, w * 0.04); g.fillStyle = '#0e0e10'; g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(1.5, w * 0.03); g.stroke();
      g.fillStyle = col; g.fillRect(cx - tw / 2, top - h * 0.24, tw, h * 0.13);
      rr(g, cx - w * 0.46, top - h * 0.06, w * 0.92, h * 0.1, h * 0.05); g.fillStyle = '#0e0e10'; g.fill(); g.stroke();
    },
    coach(g, cx, top, w, h, col, o) {
      const cw = w * 0.84;
      g.beginPath(); g.ellipse(cx, top + h * 0.04, cw / 2, h * 0.36, 0, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill();
      rr(g, cx, top - h * 0.04, w * 0.66, h * 0.1, h * 0.05); g.fillStyle = col; g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx, top + h * 0.01, w * 0.66, h * 0.05);
      circ(g, cx, top - h * 0.31, w * 0.05, INK);
      g.fillStyle = '#0d0d0f'; g.font = `800 ${Math.round(h * 0.26)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String((o && o.symbol) || 'L').toUpperCase().slice(0, 1), cx - w * 0.12, top - h * 0.13);
    },
    boss(g, cx, top, w, h) {
      g.beginPath(); g.ellipse(cx, top + h * 0.02, w * 0.6, h * 0.11, 0, 0, Math.PI * 2); g.fillStyle = '#2b2b31'; g.fill();
      poly(g, [[cx - w * 0.34, top], [cx - w * 0.3, top - h * 0.44], [cx - w * 0.06, top - h * 0.36], [cx, top - h * 0.42], [cx + w * 0.06, top - h * 0.36], [cx + w * 0.3, top - h * 0.44], [cx + w * 0.34, top]], '#2b2b31');
      g.fillStyle = '#0b0b0d'; g.fillRect(cx - w * 0.335, top - h * 0.12, w * 0.67, h * 0.1);
    },
  };

  // the whole leader. o: {look, seed, symbol, color}; s = its height scale; f: {blink 0..1, gaze -1..1}
  function figure(g, cx, bottom, s, o, f) {
    f = f || {}; const col = colorOf(o), st = Math.max(1.5, s * 0.042);
    const bw = s * 0.62, bh = s * 0.36, hw = s * 0.78, hh = s * 0.56, bodyTop = bottom - bh, headBot = bodyTop - s * 0.05, headTop = headBot - hh;
    g.save(); g.lineJoin = 'round';
    g.fillStyle = '#2a2a30'; g.fillRect(cx - s * 0.08, headBot - 2, s * 0.16, bodyTop - headBot + 4);
    rr(g, cx - bw / 2, bodyTop, bw, bh, s * 0.12); g.fillStyle = DARK; g.fill(); g.strokeStyle = INK; g.lineWidth = st; g.stroke();
    const r = s * 0.14, cy = bodyTop + bh * 0.5; circ(g, cx, cy, r, col);
    g.fillStyle = '#0c0c0e'; g.font = `800 ${Math.round(s * 0.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('@', cx, cy + s * 0.008);
    rr(g, cx - hw / 2, headTop, hw, hh, s * 0.16); g.fillStyle = DARK; g.fill(); g.stroke();
    rr(g, cx - hw * 0.36, headTop + hh * 0.2, hw * 0.72, hh * 0.6, s * 0.1); g.fillStyle = VISOR; g.fill();
    const eh = (hh * 0.28) * (1 - 0.85 * (f.blink || 0)), gz = (f.gaze || 0) * s * 0.035;
    [-1, 1].forEach(sx => { const x = cx + sx * hw * 0.17 + gz; rr(g, x - s * 0.045, headTop + hh * 0.5 - eh / 2, s * 0.09, Math.max(2, eh), s * 0.045); g.fillStyle = INK; g.fill(); });
    (HATS[archOf(o)] || HATS.king)(g, cx, headTop, hw, hh, col, o);
    g.restore();
  }
  // a square picture: the leader on its own dark ground, a little light behind it in its coin's colour
  function picture(cv, o, f, opts) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, col = colorOf(o);
    g.clearRect(0, 0, W, H);
    if (!opts || opts.bg !== false) {
      g.fillStyle = BG; g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W / 2, H * 0.58, W * 0.05, W / 2, H * 0.58, W * 0.62); rg.addColorStop(0, col + '33'); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    const s = Math.min(W, H) * ((opts && opts.scale) || 0.5);
    figure(g, W / 2, H / 2 + s * 0.62, s, o, f);
  }
  function image(o, px) { const cv = document.createElement('canvas'); cv.width = cv.height = px || 768; picture(cv, o, {}, { scale: 0.52 }); return cv.toDataURL('image/jpeg', 0.92); }
  // the leader's X banner: 1500 x 500
  function banner(o) {
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 500; const g = cv.getContext('2d'), col = colorOf(o);
    g.fillStyle = BG; g.fillRect(0, 0, 1500, 500);
    const rg = g.createRadialGradient(1080, 300, 20, 1080, 300, 420); rg.addColorStop(0, col + '30'); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(0, 0, 1500, 500);
    figure(g, 1080, 430, 300, o, {});
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = INK; g.font = `800 92px ${FONT}`;
    const t = title(o); let fs = 92; while (g.measureText(t).width > 640 && fs > 40) { fs -= 4; g.font = `800 ${fs}px ${FONT}`; }
    g.fillText(t, 120, 250);
    g.font = `600 34px ${FONT}`; g.fillStyle = col; g.fillText('the leader of $' + String(o.symbol || '').toUpperCase(), 124, 312);
    return cv.toDataURL('image/png');
  }
  // a living leader on a canvas: it blinks now and then and glances around
  function live(cv, o, opts) {
    let gaze = 0, alive = true, tm = 0; const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * d) || cv.width, h = Math.round(cv.clientHeight * d) || cv.height; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } };
    const paint = b => { fit(); picture(cv, o, { blink: b, gaze }, opts); };
    paint(0);
    const tick = () => {
      if (!alive) return;
      if (!document.hidden && !calm) {
        if (Math.random() < 0.35) gaze = [-1, 0, 1][Math.floor(Math.random() * 3)];
        [0.5, 1, 0.5, 0].forEach((b, i) => setTimeout(() => alive && paint(b), i * 45));
      }
      tm = setTimeout(tick, 1800 + Math.random() * 3200);
    };
    tm = setTimeout(tick, 600 + Math.random() * 2000);
    return { stop() { alive = false; clearTimeout(tm); }, set(p) { Object.assign(o, p); paint(0); } };
  }
  const save = (url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 2000); };
  const ready = () => (document.fonts ? document.fonts.load(`800 40px ${FONT}`).catch(() => null) : Promise.resolve());
  const newSeed = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(10))) s += a[b % a.length]; return s; };
  window.Leader = { ARCH, COLORS, colorOf, archOf, title, handle, bio, figure, picture, image, banner, live, save, ready, newSeed };
})();
