// Keep the cover and its controls available before downloading the 3D engine.
export function loadIntroScene() {
  const host = document.querySelector<HTMLElement>('[data-intro-scene]');
  if (!host || document.querySelector('[data-intro-video]')) return;
  const media = matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let loading = false, loaded = false, visible = false, timer = 0;
  let dispose: (() => void) | undefined;
  const transitioning = () => host.closest("[data-intro]")?.getAttribute("aria-busy") === "true";
  async function load() {
    if (loading || loaded || !visible || document.hidden || !media.matches || connection?.saveData || transitioning()) return;
    loading = true;
    try {
      const { mountIntroScene } = await import('./intro-scene');
      if (visible && !document.hidden && media.matches && !transitioning()) { dispose = await mountIntroScene(host!); loaded = true; }
    } catch { /* The animated CSS cover and shatter work without WebGL. */ }
    finally { loading = false; }
  }
  function schedule() {
    clearTimeout(timer);
    if (visible && !loaded && !loading && !document.hidden && media.matches && !connection?.saveData) {
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(() => { void load(); }, { timeout: 1800 });
        else void load();
      }, 900);
    }
  }
  const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; schedule(); });
  observer.observe(host);
  media.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    clearTimeout(timer); observer.disconnect(); media.removeEventListener('change', schedule);
    document.removeEventListener('visibilitychange', schedule); dispose?.();
  });
}