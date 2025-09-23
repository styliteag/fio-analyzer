<template>
  <div ref="root" class="fs-wrapper" :style="wrapperStyle">
    <div class="fs-controls">
      <button class="button" @click="toggle">{{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}</button>
    </div>
    <div class="fs-content"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';

const root = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

function toggle() {
  const el = root.value as FullscreenElement | null;
  if (!el) return;
  const doc = document as FullscreenDocument;
  if (!isFullscreen.value) {
    (el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen)?.call(el);
  } else {
    (doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen)?.call(doc);
  }
}

function onChange() {
  const doc = document as FullscreenDocument;
  const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
  isFullscreen.value = fsEl !== null;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    const doc = document as FullscreenDocument;
    (doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen)?.call(doc);
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange as EventListener);
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onChange);
  document.removeEventListener('webkitfullscreenchange', onChange as EventListener);
  window.removeEventListener('keydown', onKey);
});

const wrapperStyle = computed(() => ({ position: 'relative' }));
</script>

<style>
.fs-wrapper { width: 100%; height: 100%; }
.fs-controls { position: absolute; top: 8px; right: 8px; z-index: 2; }
.fs-content { width: 100%; height: 100%; }
</style>


