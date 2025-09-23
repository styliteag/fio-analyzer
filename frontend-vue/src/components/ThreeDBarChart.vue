<template>
  <div
    ref="container"
    style="width:100%; height:420px"
  />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as THREE from 'three';
const props = defineProps<{ items?: { label: string; value: number }[] }>();

const container = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let animId = 0;
let isDragging = false;
let lastX = 0;
let rotationY = 0;

function buildScene() {
  if (!container.value) return;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 10, 24);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.value.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 14, 10);
  scene.add(light);

  // Mouse drag rotation
  const onDown = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; };
  const onMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    rotationY += dx * 0.005;
    if (scene) scene.rotation.y = rotationY;
  };
  const onUp = () => { isDragging = false; };
  renderer.domElement.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // Resize handling
  const onResize = () => {
    if (!container?.value || !renderer || !camera) return;
    const w = container.value.clientWidth;
    const h = container.value.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // Cleanup listeners on unmount
  cleanup.push(() => {
    renderer?.domElement.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('resize', onResize);
  });
}

function renderItems() {
  if (!scene) return;
  // Clear previous meshes
  [...scene.children]
    .filter(obj => obj.type === 'Mesh')
    .forEach(obj => scene!.remove(obj));
  const items = props.items ?? [];
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const gap = 1.2;
  items.forEach((it, idx) => {
    const material = new THREE.MeshStandardMaterial({ color: 0x3399ff });
    const bar = new THREE.Mesh(geometry, material);
    const h = Math.max(0.1, it.value);
    bar.scale.y = h;
    bar.position.set((idx - items.length / 2) * gap, h / 2, 0);
    scene!.add(bar);
  });
}

function animate() {
  if (!renderer || !scene || !camera) return;
  animId = requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

onMounted(() => { buildScene(); renderItems(); animate(); });
watch(() => props.items, () => renderItems());

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId);
  if (renderer) renderer.dispose();
  renderer = null; scene = null; camera = null;
});

// simple cleanup registry
const cleanup: Array<() => void> = [];
onBeforeUnmount(() => cleanup.forEach(fn => fn()));
</script>


