import { createElement } from "react";
import { createRoot } from "react-dom/client";
import HeroScene from "../components/motion/HeroScene";

// Keep the original cinematic scene, but mount it only after the lightweight
// cover has painted and the idle/visibility checks in load-intro-scene pass.
export async function mountIntroScene(host: HTMLElement): Promise<() => void> {
  const screen = host.closest<HTMLElement>('[data-intro-screen]');
  const root = createRoot(host);
  let frame = 0;
  const observer = new MutationObserver(() => {
    if (!host.querySelector('canvas')) return;
    observer.disconnect();
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => screen?.setAttribute('data-scene-ready', ''));
    });
  });
  observer.observe(host, { childList: true, subtree: true });
  root.render(createElement(HeroScene));
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    root.unmount();
    screen?.removeAttribute('data-scene-ready');
  };
}