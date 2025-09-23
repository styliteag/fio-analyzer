<template>
  <BaseChart
    :data="undefined"
    :options="undefined"
    :height="height"
    :width="width"
    :loading="loading"
    :error="error"
  >
    <template #default>
      <div ref="chartContainer" class="threejs-container"></div>
    </template>
  </BaseChart>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import BaseChart from './BaseChart.vue'
import type { TestRun } from '@/types'

export interface ThreeDBarChartProps {
  testRuns: TestRun[]
  metric: 'iops' | 'latency' | 'bandwidth'
  height: number
  width: number
  loading: boolean
  error: string | null
}

const props = withDefaults(defineProps<ThreeDBarChartProps>(), {
  testRuns: () => [],
  metric: 'iops',
  height: 400,
  width: 400,
  loading: false,
  error: null
})

const chartContainer = ref<HTMLElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let animationId: number

const initThreeJS = () => {
  if (!chartContainer.value) return

  const container = chartContainer.value
  const width = container.clientWidth
  const height = container.clientHeight

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf9fafb)

  // Camera
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  container.appendChild(renderer.domElement)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  // Grid helper
  const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc)
  scene.add(gridHelper)

  // Create bars based on data
  createBars()

  // Animation loop
  animate()
}

const createBars = () => {
  if (!props.testRuns || props.testRuns.length === 0) return

  // Clear existing bars
  const barsToRemove = scene.children.filter(child => child.userData.isBar)
  barsToRemove.forEach(bar => scene.remove(bar))

  const colors = [
    0x3b82f6, // Blue
    0x10b981, // Green
    0xf56565, // Red
    0xfbbf24, // Yellow
    0x8b5cf6, // Purple
    0xec4899, // Pink
  ]

  props.testRuns.forEach((testRun, index) => {
    const x = (index % 5) * 3 - 6 // Position bars in a grid
    const z = Math.floor(index / 5) * 3 - 6

    let readValue = 0
    let writeValue = 0

    // Get values based on selected metric
    switch (props.metric) {
      case 'iops':
        readValue = testRun.iops_read / 1000 // Scale down for visualization
        writeValue = testRun.iops_write / 1000
        break
      case 'latency':
        readValue = Math.max(0, 50 - testRun.latency_read_avg) / 10 // Invert and scale
        writeValue = Math.max(0, 50 - testRun.latency_write_avg) / 10
        break
      case 'bandwidth':
        readValue = testRun.bandwidth_read / 100 // Scale down
        writeValue = testRun.bandwidth_write / 100
        break
    }

    // Create read bar
    const readGeometry = new THREE.BoxGeometry(0.8, Math.max(0.1, readValue), 0.8)
    const readMaterial = new THREE.MeshLambertMaterial({ color: colors[index % colors.length] })
    const readBar = new THREE.Mesh(readGeometry, readMaterial)
    readBar.position.set(x - 0.5, readValue / 2, z)
    readBar.castShadow = true
    readBar.receiveShadow = true
    readBar.userData = {
      isBar: true,
      hostname: testRun.hostname,
      metric: `Read ${props.metric}`,
      value: props.metric === 'iops' ? testRun.iops_read :
             props.metric === 'latency' ? testRun.latency_read_avg :
             testRun.bandwidth_read
    }
    scene.add(readBar)

    // Create write bar
    const writeGeometry = new THREE.BoxGeometry(0.8, Math.max(0.1, writeValue), 0.8)
    const writeMaterial = new THREE.MeshLambertMaterial({ color: colors[index % colors.length], opacity: 0.7, transparent: true })
    const writeBar = new THREE.Mesh(writeGeometry, writeMaterial)
    writeBar.position.set(x + 0.5, writeValue / 2, z)
    writeBar.castShadow = true
    writeBar.receiveShadow = true
    writeBar.userData = {
      isBar: true,
      hostname: testRun.hostname,
      metric: `Write ${props.metric}`,
      value: props.metric === 'iops' ? testRun.iops_write :
             props.metric === 'latency' ? testRun.latency_write_avg :
             testRun.bandwidth_write
    }
    scene.add(writeBar)

    // Add label
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    context.font = '20px Arial'
    context.fillStyle = '#333333'
    context.fillText(testRun.hostname, 0, 20)

    const texture = new THREE.CanvasTexture(canvas)
    const labelMaterial = new THREE.SpriteMaterial({ map: texture })
    const label = new THREE.Sprite(labelMaterial)
    label.position.set(x, -1, z)
    label.scale.set(2, 0.5, 1)
    label.userData = { isBar: true }
    scene.add(label)
  })
}

const animate = () => {
  animationId = requestAnimationFrame(animate)

  // Rotate camera around the scene
  const time = Date.now() * 0.0005
  camera.position.x = Math.cos(time) * 15
  camera.position.z = Math.sin(time) * 15
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!chartContainer.value || !camera || !renderer) return

  const width = chartContainer.value.clientWidth
  const height = chartContainer.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onMounted(() => {
  nextTick(() => {
    initThreeJS()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

watch(() => props.testRuns, () => {
  if (scene) {
    createBars()
  }
})

watch(() => props.metric, () => {
  if (scene) {
    createBars()
  }
})
</script>

<style scoped>
.threejs-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.threejs-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>