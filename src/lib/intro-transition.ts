import { prefersReducedMotion } from "./motion-config";

type Point = { x: number; y: number };
type Fragment = { points: Point[]; cx: number; cy: number; vx: number; vy: number; spin: number; delay: number; path: Path2D; left: number; top: number; width: number; height: number };
type ScrollBridge = { scrollTo: (target: HTMLElement | number, options: { offset: number; immediate: boolean; force: boolean }) => void; stop: () => void; start: () => void };

export function setupIntro() {
  const section = document.querySelector<HTMLElement>('[data-intro]');
  const screen = document.querySelector<HTMLElement>('[data-intro-screen]');
  const overlay = document.querySelector<HTMLCanvasElement>('[data-intro-fracture]');
  const play = document.querySelector<HTMLButtonElement>('[data-intro-play]');
  const skip = document.querySelector<HTMLButtonElement>('[data-intro-skip]');
  const video = document.querySelector<HTMLVideoElement>('[data-intro-video]');
  const status = document.querySelector<HTMLElement>('[data-intro-status]');
  const landing = document.querySelector<HTMLElement>('#top');
  if (!section || !screen || !overlay || !play || !skip || !landing) return;
  const ctx = overlay.getContext('2d');
  let busy = false;
  let frame = 0;
  let revealTimer = 0;
  let finishTimer = 0;
  const bridge = () => (window as unknown as { __lenis?: ScrollBridge }).__lenis;
  function revealLanding() {
    video?.pause();
    const offset = -(document.querySelector('header')?.getBoundingClientRect().height ?? 80);
    const lenis = bridge();
    if (lenis) lenis.scrollTo(window.scrollY + landing!.getBoundingClientRect().top + offset, { offset: 0, immediate: true, force: true });
    else {
      const html = document.documentElement;
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo({ top: landing!.getBoundingClientRect().top + window.scrollY + offset, behavior: 'instant' });
      html.style.scrollBehavior = previous;
    }
  }
  function finish() {
    cancelAnimationFrame(frame);
    clearTimeout(revealTimer);
    clearTimeout(finishTimer);
    overlay!.hidden = true;
    overlay!.width = 1;
    overlay!.height = 1;
    bridge()?.start();
    document.documentElement.style.removeProperty('overflow-y');
    play!.disabled = false;
    skip!.disabled = false;
    section!.removeAttribute('aria-busy');
    section!.removeAttribute('data-playing');
    if (status) status.textContent = 'You are in. Scroll back here to replay the experience.';
    const heading = landing!.querySelector<HTMLElement>('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    busy = false;
  }
  function shatter() {
    if (busy) return;
    busy = true;
    video?.pause();
    section!.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Opening the landing page…';
    play!.disabled = true;
    skip!.disabled = true;
    if (prefersReducedMotion() || !ctx) { revealLanding(); finish(); return; }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    overlay!.width = Math.round(width * dpr);
    overlay!.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const texture = document.createElement('canvas');
    texture.width = overlay!.width;
    texture.height = overlay!.height;
    const paint = texture.getContext('2d');
    if (!paint) { revealLanding(); finish(); return; }
    paint.scale(dpr, dpr);
    paint.fillStyle = '#08080a';
    paint.fillRect(0, 0, width, height);
    const box = screen!.getBoundingClientRect();
    const glow = paint.createRadialGradient(width * .6, height * .4, 0, width * .6, height * .4, width * .7);
    glow.addColorStop(0, '#342714'); glow.addColorStop(1, '#08080a');
    paint.fillStyle = glow; paint.fillRect(box.left, box.top, box.width, box.height);
    // Freeze the actual film or WebGL scene into the glass texture when available.
    const source = video && video.readyState >= 2 && !video.error ? video : screen!.querySelector('canvas');
    if (source) {
      if (source instanceof HTMLCanvasElement) source.dispatchEvent(new Event("intro:capture-frame"));
      const bounds = source.getBoundingClientRect();
      paint.save(); paint.beginPath(); paint.rect(box.left, box.top, box.width, box.height); paint.clip();
      try { paint.drawImage(source, bounds.left, bounds.top, bounds.width, bounds.height); } catch { /* Static cover remains available. */ }
      paint.restore();
    }
    if (!source) {
      paint.save(); paint.beginPath(); paint.rect(box.left, box.top, box.width, box.height); paint.clip();
      screen!.querySelectorAll<HTMLElement>('.intro-fallback > span').forEach(bar => {
        const bounds = bar.getBoundingClientRect();
        const style = getComputedStyle(bar);
        const w = parseFloat(style.width), h = parseFloat(style.height);
        paint.save(); paint.translate(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2); paint.rotate(-.24);
        const gold = paint.createLinearGradient(-w / 2, 0, w / 2, 0);
        gold.addColorStop(0, '#6b491b'); gold.addColorStop(.5, '#e8bf60'); gold.addColorStop(1, '#79521f');
        paint.globalAlpha = .5; paint.strokeStyle = '#d7af56'; paint.beginPath(); paint.moveTo(0, -h * .8); paint.lineTo(0, h * .8); paint.stroke();
        paint.fillStyle = gold; paint.fillRect(-w / 2, -h / 2, w, h); paint.restore();
      });
      paint.restore();
    }
    // Reconstruct the cover typography at its exact measured positions.
    const shade = paint.createLinearGradient(box.left, 0, box.right, 0);
    shade.addColorStop(0, '#08080ae0'); shade.addColorStop(1, '#08080a22');
    paint.fillStyle = shade; paint.fillRect(box.left, box.top, box.width, box.height);
    paint.strokeStyle = '#e5b34460'; paint.lineWidth = 1; paint.strokeRect(box.left, box.top, box.width, box.height);
    section!.querySelectorAll<HTMLElement>('[data-intro-text]').forEach(element => {
      if (section!.hasAttribute('data-playing') && element.closest('.intro-film-title, .intro-play, .intro-screen-bottom')) return;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      paint.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      (paint as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = style.letterSpacing;
      paint.fillStyle = style.color;
      paint.textBaseline = 'middle';
      paint.fillText(element.textContent?.trim() ?? '', rect.left, rect.top + rect.height * .5);
    });
    const playRing = play!.querySelector('.intro-play-ring')?.getBoundingClientRect();
    if (playRing && !section!.hasAttribute('data-playing')) {
      paint.strokeStyle = '#e5b344aa'; paint.beginPath(); paint.arc(playRing.x + playRing.width / 2, playRing.y + playRing.height / 2, playRing.width / 2, 0, Math.PI * 2); paint.stroke();
      paint.fillStyle = '#e6c277'; paint.beginPath(); paint.moveTo(playRing.x + playRing.width / 2 - 5, playRing.y + playRing.height / 2 - 9); paint.lineTo(playRing.x + playRing.width / 2 + 10, playRing.y + playRing.height / 2); paint.lineTo(playRing.x + playRing.width / 2 - 5, playRing.y + playRing.height / 2 + 9); paint.fill();
    }
    const impact = { x: playRing ? playRing.x + playRing.width / 2 : width * .6, y: playRing ? playRing.y + playRing.height / 2 : height * .45 };
    // A shared, jittered mesh has matching edges: no rectangular tile breakup.
    const cols = width < 768 ? 5 : 8;
    const rows = 5;
    const vertices: Point[][] = [];
    for (let row = 0; row <= rows; row++) {
      vertices[row] = [];
      for (let col = 0; col <= cols; col++) vertices[row]![col] = {
        x: col * width / cols + (col > 0 && col < cols ? (Math.random() - .5) * width / cols * .65 : 0),
        y: row * height / rows + (row > 0 && row < rows ? (Math.random() - .5) * height / rows * .65 : 0),
      };
    }
    const hitCol = Math.max(1, Math.min(cols - 1, Math.round(impact.x / width * cols)));
    const hitRow = Math.max(1, Math.min(rows - 1, Math.round(impact.y / height * rows)));
    vertices[hitRow]![hitCol] = impact;
    const fragments: Fragment[] = [];
    function add(points: Point[]) {
      const cx = points.reduce((sum, point) => sum + point.x, 0) / 3;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / 3;
      const distance = Math.hypot(cx - impact.x, cy - impact.y);
      const path = new Path2D(); points.forEach((point, i) => i ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y)); path.closePath();
      const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
      const width = Math.max(...points.map(p => p.x)) - left, height = Math.max(...points.map(p => p.y)) - top;
      fragments.push({ points, path, left, top, width, height, cx, cy, vx: (cx - impact.x) * (1.1 + Math.random()), vy: (cy - impact.y) * 1.1 - 80 - Math.random() * 110, spin: (Math.random() - .5) * 5, delay: distance / Math.hypot(width, height) * .12 });
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const a = vertices[row]![col]!, b = vertices[row]![col + 1]!, c = vertices[row + 1]![col]!, d = vertices[row + 1]![col + 1]!;
      if ((row + col) % 2) { add([a, b, c]); add([b, d, c]); } else { add([a, b, d]); add([a, d, c]); }
    }
    const drawTexture = () => ctx.drawImage(texture, 0, 0, texture.width, texture.height, 0, 0, width, height);
    overlay!.hidden = false;
    drawTexture();
    bridge()?.stop();
    document.documentElement.style.overflowY = 'hidden';
    // The destination moves underneath the opaque glass before the first gap opens.
    revealTimer = window.setTimeout(revealLanding, 260);
    finishTimer = window.setTimeout(() => { revealLanding(); finish(); }, 2400);
    let started: number | undefined;
    function tick(now: number) {
      if (!ctx || !busy) return;
      started ??= now;
      const elapsed = Math.max(0, (now - started) / 1000);
      ctx.clearRect(0, 0, width, height);
      if (elapsed < .38) {
        drawTexture();
        for (const piece of fragments) {
          const distance = Math.hypot(piece.cx - impact.x, piece.cy - impact.y) / Math.hypot(width, height);
          const growth = Math.max(0, Math.min(1, (elapsed - distance * .18) / .16));
          if (!growth) continue;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = piece.points[i]!, b = piece.points[(i + 1) % 3]!;
            ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * growth, a.y + (b.y - a.y) * growth);
          }
          ctx.strokeStyle = `rgba(255,220,150,${growth * .65})`; ctx.lineWidth = .8; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(impact.x, impact.y, 8 + elapsed * 140, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,232,184,${Math.max(0, 1 - elapsed * 3)})`; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        for (const piece of fragments) {
          const t = Math.max(0, elapsed - .38 - piece.delay);
          if (t > 1.3) continue;
          const flight = t * t * 1.4;
          const angle = piece.spin * t;
          // Perspective squash, spin and depth simulate rigid glass facets.
          const scale = 1 + t * .38;
          const sx = scale * Math.cos(t * piece.spin * .65);
          const sy = scale * Math.cos(t * piece.spin * .4);
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - .45) / .85);
          ctx.translate(piece.cx + piece.vx * flight, piece.cy + piece.vy * flight + 320 * t * t);
          ctx.rotate(angle); ctx.scale(sx, sy); ctx.translate(-piece.cx, -piece.cy);
          ctx.clip(piece.path);
          ctx.drawImage(texture, piece.left * dpr, piece.top * dpr, piece.width * dpr, piece.height * dpr, piece.left, piece.top, piece.width, piece.height);
          ctx.fillStyle = `rgba(245,205,120,${Math.abs(Math.sin(angle)) * .12})`; ctx.fill(piece.path);
          ctx.strokeStyle = 'rgba(255,224,160,.75)'; ctx.lineWidth = 1; ctx.stroke(piece.path); ctx.restore();
        }
      }
      if (elapsed < 1.85) frame = requestAnimationFrame(tick);
      else finish();
    }
    frame = requestAnimationFrame(tick);
  }
  play.addEventListener('click', () => {
    if (busy) return;
    if (video && !video.error) {
      video.muted = false; video.controls = true;
      video.currentTime = 0;
      video.play().then(() => { section.setAttribute('data-playing', ''); if (status) status.textContent = 'Now playing. Skip intro any time to enter the site.'; }).catch(() => { if (status) status.textContent = 'Video unavailable. Use Skip intro to enter the site.'; });
    } else shatter();
  });
  skip.addEventListener('click', shatter);
  video?.addEventListener('ended', shatter);
  video?.addEventListener('error', () => {
    video.hidden = true;
    section.removeAttribute('data-playing');
    if (status) status.textContent = 'The film is coming soon. Press play to explore the experience.';
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && busy) { revealLanding(); finish(); } });
  window.addEventListener('resize', () => { if (busy) { revealLanding(); finish(); } }, { passive: true });
  // A film may autoplay, but never keeps playing after the visitor leaves the intro.
  if (video) new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) video.pause(); }, { threshold: .1 }).observe(section);
}