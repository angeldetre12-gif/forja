// Gráfica de línea en canvas, sin librerías. Soporta HiDPI, área degradada y tooltip al tocar.
export function lineChart(canvas, points, { unit = 'kg', color = '#FF6B2C', format = (v) => v.toFixed(1) } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const css = getComputedStyle(document.documentElement);
  const mute = css.getPropertyValue('--mute').trim() || '#8E8D96';
  const line = css.getPropertyValue('--line').trim() || '#2A2A31';
  const text = css.getPropertyValue('--text').trim() || '#F2F1EE';
  let selected = points.length - 1;

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px system-ui, sans-serif';

    if (!points.length) {
      ctx.fillStyle = mute;
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos todavía', w / 2, h / 2);
      return;
    }
    const pad = { l: 44, r: 14, t: 34, b: 26 };
    const vals = points.map((p) => p.y);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= Math.max(1, min * 0.1); max += Math.max(1, max * 0.1); }
    const span = max - min;
    min = Math.max(0, min - span * 0.12);
    max += span * 0.12;
    const t0 = points[0].x, t1 = points[points.length - 1].x;
    const X = (t) => (points.length === 1 ? (pad.l + w - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0 || 1)) * (w - pad.l - pad.r));
    const Y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

    // Rejilla y eje Y
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.fillStyle = mute;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(Math.round(v).toLocaleString('es-MX'), pad.l - 8, y);
    }
    // Eje X: primera, media y última fecha
    ctx.textBaseline = 'alphabetic';
    const fmt = (t) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(t);
    const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    labelIdx.forEach((i, k) => {
      ctx.textAlign = labelIdx.length === 1 ? 'center' : k === 0 ? 'left' : k === labelIdx.length - 1 ? 'right' : 'center';
      ctx.fillText(fmt(points[i].x), X(points[i].x), h - 6);
    });

    // Área degradada
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.lineTo(X(t1), h - pad.b);
    ctx.lineTo(X(t0), h - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Puntos
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), i === selected ? 5.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === selected ? color : '#0B0B0D';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Tooltip
    if (selected >= 0) {
      const p = points[selected];
      const label = `${format(p.y)} ${unit} · ${fmt(p.x)}`;
      ctx.font = '600 12px system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 16;
      let x = X(p.x) - tw / 2;
      x = Math.max(4, Math.min(w - tw - 4, x));
      const y = 4;
      ctx.fillStyle = '#26262D';
      roundRect(ctx, x, y, tw, 22, 8);
      ctx.fill();
      ctx.fillStyle = text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 8, y + 11);
      ctx.strokeStyle = color + '66';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(p.x), y + 22); ctx.lineTo(X(p.x), Y(p.y) - 6); ctx.stroke();
      ctx.setLineDash([]);
    }
    canvas._X = X;
  }

  function pick(ev) {
    if (!points.length || !canvas._X) return;
    const r = canvas.getBoundingClientRect();
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(canvas._X(p.x) - x); if (d < bd) { bd = d; best = i; } });
    if (best !== selected) { selected = best; draw(); }
  }
  canvas.onpointerdown = pick;
  canvas.onpointermove = (e) => e.buttons && pick(e);
  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  return { destroy: () => ro.disconnect() };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
