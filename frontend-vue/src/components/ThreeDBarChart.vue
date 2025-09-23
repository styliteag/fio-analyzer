<template>
  <div ref="container" style="width:100%; height:400px"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';

const container = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, animId = 0;

onMounted(() => {
  if (!container.value) return;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 10, 20);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.value.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);

  // Simple demo bars
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 10; i++) {
    const material = new THREE.MeshStandardMaterial({ color: 0x3399ff });
    const bar = new THREE.Mesh(geometry, material);
    bar.scale.y = Math.random() * 10 + 1;
    bar.position.set(i - 5, bar.scale.y / 2, 0);
    scene.add(bar);
  }

  const animate = () => {
    animId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();
});

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId);
  if (renderer) renderer.dispose();
});
</script>


