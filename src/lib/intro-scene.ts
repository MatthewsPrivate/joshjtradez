import * as THREE from "three";

// A small scene with shared geometry and no React hydration, shadow maps,
// reflection captures, or post-processing shader compilation on launch.
export async function mountIntroScene(host: HTMLElement): Promise<() => void> {
  const screen = host.closest<HTMLElement>('[data-intro-screen]');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0x08080a, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
  camera.position.set(0, .8, 11);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffe9b6, 0x17131e, 2.2));
  const key = new THREE.DirectionalLight(0xffdf91, 4);
  key.position.set(3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb4c5ed, 2.4);
  rim.position.set(-4, 2, 1); scene.add(rim);
  const group = new THREE.Group();
  group.rotation.set(.08, -.3, -.1); scene.add(group);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe5b344, metalness: .55, roughness: .26, emissive: 0x4a2b04, emissiveIntensity: .22 });
  const wickMaterial = new THREE.MeshBasicMaterial({ color: 0xb38b35 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffdd92, transparent: true, opacity: .24 });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(geometry);
  const bars: THREE.Group[] = [];
  const heights = [.8, 1.3, 1, 2.5, 1.6, 1.1, 1.9];
  heights.forEach((height, i) => {
    const bar = new THREE.Group();
    bar.position.set((i - 3) * .78, (i - 3) * .16, Math.abs(i - 3) * -.3);
    const body = new THREE.Mesh(geometry, gold);
    body.scale.set(i === 3 ? .54 : .3, height, i === 3 ? .54 : .3);
    const outline = new THREE.LineSegments(edges, edgeMaterial);
    outline.scale.copy(body.scale);
    const wick = new THREE.Mesh(geometry, wickMaterial);
    wick.scale.set(.018, height + .5, .018);
    bar.add(body, outline, wick); group.add(bar); bars.push(bar);
  });
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffe2a1 });
  const flameGeometry = new THREE.SphereGeometry(.09, 12, 8);
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.position.set(0, 1.67, 0); flame.scale.y = 1.8; group.add(flame);
  const ringGeometry = new THREE.TorusGeometry(3.15, .007, 3, 80);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd9ae4f, transparent: true, opacity: .2 });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.set(.7, .3, 0); group.add(ring);
  let raf = 0, visible = false, disposed = false, started = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const render = () => renderer.render(scene, camera);
  const tick = (now: number) => {
    if (!started) started = now;
    const t = (now - started) / 1000;
    group.rotation.y = -.3 + Math.sin(t * .18) * .16;
    group.position.y = Math.sin(t * .65) * .055;
    bars.forEach((bar, i) => { bar.position.y = (i - 3) * .16 + Math.sin(t * .7 + i * .8) * .055; });
    flame.scale.y = 1.8 + Math.sin(t * 7) * .12;
    ring.rotation.z = t * .04;
    render();
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(raf);
    if (!disposed && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(tick);
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  // Parallel shader compilation when supported avoids a first-frame GPU stall.
  try { await renderer.compileAsync(scene, camera); } catch { /* render remains the fallback */ }
  if (!host.isConnected) {
    renderer.dispose(); geometry.dispose(); edges.dispose(); flameGeometry.dispose(); ringGeometry.dispose();
    gold.dispose(); wickMaterial.dispose(); edgeMaterial.dispose(); flameMaterial.dispose(); ringMaterial.dispose();
    renderer.domElement.remove();
    return () => {};
  }
  render();
  screen?.setAttribute('data-scene-ready', '');
  const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; sync(); });
  observer.observe(host);
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(host);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  renderer.domElement.addEventListener('intro:capture-frame', render);
  return () => {
    disposed = true; cancelAnimationFrame(raf); observer.disconnect(); sizeObserver.disconnect();
    document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync);
    renderer.domElement.removeEventListener('intro:capture-frame', render);
    geometry.dispose(); edges.dispose(); flameGeometry.dispose(); ringGeometry.dispose();
    gold.dispose(); wickMaterial.dispose(); edgeMaterial.dispose(); flameMaterial.dispose(); ringMaterial.dispose();
    renderer.dispose(); renderer.domElement.remove(); screen?.removeAttribute('data-scene-ready');
  };
}