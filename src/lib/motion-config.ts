// Shared motion helpers. Imported by per-section <script> blocks.

export const EASE_CONFIDENT = "cubic-bezier(0.22, 1, 0.36, 1)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

// Run a callback on first scroll-into-view. Cheaper than spinning up GSAP
// ScrollTrigger when all we need is a single fire.
export function onceVisible(
  el: Element,
  cb: () => void,
  options: IntersectionObserverInit = { threshold: 0.25 },
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    cb();
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        cb();
        io.disconnect();
        break;
      }
    }
  }, options);
  io.observe(el);
  return () => io.disconnect();
}

// Lazy GSAP loader so non-animating pages (and reduced-motion) don't pay the cost.
export async function getGsap() {
  const gsap = (await import("gsap")).default;
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}
