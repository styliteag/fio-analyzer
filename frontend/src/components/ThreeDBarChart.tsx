import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Grid } from '@react-three/drei';
import * as THREE from 'three';

// Data type
export type PerfDatum = {
  blocksize: string | number;
  queuedepth: string | number;
  iops?: number;
  latency?: number;
  throughput?: number;
};

const METRICS = [
  { key: 'iops', label: 'IOPS', color: '#3B82F6' },
  { key: 'latency', label: 'Latency', color: '#F59E0B' },
  { key: 'throughput', label: 'Throughput', color: '#10B981' },
];

type MetricKey = 'iops' | 'latency' | 'throughput';

interface ThreeDBarChartProps {
  data: PerfDatum[];
  initialMetrics?: MetricKey[];
}

const axisLabelStyle =
  'bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded text-xs font-semibold shadow border';

export const ThreeDBarChart: React.FC<ThreeDBarChartProps> = ({ data, initialMetrics = ['iops'] }) => {
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(initialMetrics);
  const [hovered, setHovered] = useState<{x: number, y: number, metric: MetricKey} | null>(null);

  // Unique sorted axes
  const xVals = Array.from(new Set(data.map(d => d.blocksize))).sort((a, b) => (a as any) - (b as any));
  const yVals = Array.from(new Set(data.map(d => d.queuedepth))).sort((a, b) => (a as any) - (b as any));

  // Bar width/offset for multi-metric
  const barWidth = 0.6;
  const metricOffset = (metricIdx: number) => (metricIdx - (selectedMetrics.length-1)/2) * (barWidth+0.1);

  // Axis lengths
  const xLen = xVals.length;
  const yLen = yVals.length;
  const zLen = 3.5;

  // Axis ticks
  const xTicks = xVals.map((v, i) => ({ v, i }));
  const yTicks = yVals.map((v, i) => ({ v, i }));
  const zTicks = [0, 0.5, 1, 1.5, 2, 2.5, 3];

  return (
    <div className="theme-card rounded-lg shadow-md border p-4 bg-white dark:bg-gray-900">
      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold theme-text-primary">🧊 3D Performance Matrix</h3>
        <div className="flex gap-2">
          {METRICS.map(m => (
            <label key={m.key} className={`px-2 py-1 rounded cursor-pointer text-xs font-medium ${selectedMetrics.includes(m.key as MetricKey) ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
              <input
                type="checkbox"
                checked={selectedMetrics.includes(m.key as MetricKey)}
                onChange={() => setSelectedMetrics(sel => sel.includes(m.key as MetricKey) ? sel.filter(k => k !== m.key) : [...sel, m.key as MetricKey])}
                className="hidden"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>
      {/* 3D Chart */}
      <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 rounded">
        <Canvas camera={{ position: [xLen/2, 3, yLen*1.2], fov: 50 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 10]} intensity={0.7} castShadow />
          {/* Custom positive quadrant grid */}
          <Grid args={[xLen+1, yLen+1]} position={[xLen/2-0.5, -0.01, yLen/2-0.5]} cellColor="#e5e7eb" sectionColor="#a3a3a3" infiniteGrid={false} fadeDistance={0} />
          {/* Axis ticks (X) */}
          {xTicks.map(({ v, i }) => (
            <Html key={i} position={[i, 0.05, -0.7]} center className="text-xs text-gray-500 dark:text-gray-400">{v}</Html>
          ))}
          {/* Axis ticks (Y) */}
          {yTicks.map(({ v, i }) => (
            <Html key={i} position={[-0.7, 0.05, i]} center className="text-xs text-gray-500 dark:text-gray-400">{v}</Html>
          ))}
          {/* Axis ticks (Z) */}
          {zTicks.map((v, i) => (
            <Html key={i} position={[-0.7, v, -0.5]} center className="text-xs text-gray-500 dark:text-gray-400">{v}</Html>
          ))}
          <OrbitControls enablePan enableZoom enableRotate />
          {/* Bars */}
          {data.map((d, i) => (
            selectedMetrics.map((metric, mIdx) => {
              const value = d[metric];
              if (value == null) return null;
              // Normalize height for demo (should use max per metric)
              const max = Math.max(...data.map(dd => dd[metric] ?? 0));
              const height = max ? (value / max) * 3 : 0.1;
              const x = xVals.indexOf(d.blocksize) + metricOffset(mIdx);
              const y = yVals.indexOf(d.queuedepth);
              return (
                <mesh
                  key={`${i}-${metric}`}
                  position={[x, height/2, y]}
                  onPointerOver={() => setHovered({x, y, metric})}
                  onPointerOut={() => setHovered(null)}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[barWidth, height, barWidth]} />
                  <meshStandardMaterial color={METRICS.find(m => m.key === metric)?.color} opacity={0.85} transparent />
                  {/* Shadow plane for depth */}
                  <mesh position={[0, -height/2+0.01, 0]} rotation={[-Math.PI/2, 0, 0]}>
                    <circleGeometry args={[barWidth/2, 16]} />
                    <meshStandardMaterial color="#000" opacity={0.12} transparent />
                  </mesh>
                </mesh>
              );
            })
          ))}
        </Canvas>
      </div>
    </div>
  );
};

export default ThreeDBarChart; 