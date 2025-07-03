import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { Maximize, Minimize } from 'lucide-react';

// Data type
export type PerfDatum = {
  blocksize: string | number;
  queuedepth: string | number;
  iops?: number;
  latency?: number;
  throughput?: number;
};

const METRICS = [
  { key: 'iops', label: 'IOPS', color: '#6366f1' },
  { key: 'latency', label: 'Latency (ms)', color: '#f59e0b' },
  { key: 'throughput', label: 'Throughput', color: '#10b981' },
];

type MetricKey = 'iops' | 'latency' | 'throughput';

interface ThreeDBarChartProps {
  data: PerfDatum[];
  initialMetrics?: MetricKey[];
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}


export const ThreeDBarChart: React.FC<ThreeDBarChartProps> = ({ data, initialMetrics = ['iops'], isMaximized = false, onToggleMaximize }) => {
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(initialMetrics);
  const [hovered, setHovered] = useState<{x: number, y: number, metric: MetricKey} | null>(null);

  // Unique sorted axes
  const xVals = Array.from(new Set(data.map(d => d.blocksize))).sort((a, b) => (a as any) - (b as any));
  const yVals = Array.from(new Set(data.map(d => d.queuedepth))).sort((a, b) => (a as any) - (b as any));

  // Bar width/offset for multi-metric - thinner bars with more spacing
  const barWidth = 0.3;
  const metricOffset = (metricIdx: number) => (metricIdx - (selectedMetrics.length-1)/2) * (barWidth+0.3);

  // Axis lengths
  const xLen = xVals.length;
  const yLen = yVals.length;

  // Axis ticks
  const xTicks = xVals.map((v, i) => ({ v, i }));
  const yTicks = yVals.map((v, i) => ({ v, i }));

  // Show empty state if no data
  if (!data.length || selectedMetrics.length === 0) {
    return (
      <div className="theme-card rounded-lg shadow-md border p-6 bg-white dark:bg-gray-900">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🧊</div>
          <h3 className="text-lg font-semibold theme-text-primary mb-2">3D Performance Matrix</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {!data.length ? 'No performance data available' : 'Select at least one metric to visualize'}
          </p>
          {selectedMetrics.length === 0 && (
            <div className="flex gap-2 justify-center">
              {METRICS.map(m => (
                <button key={m.key} 
                  onClick={() => setSelectedMetrics([m.key as MetricKey])}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium">
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`theme-card rounded-lg shadow-md border p-4 bg-white dark:bg-gray-900 ${isMaximized ? "fixed inset-0 z-50 overflow-auto" : ""}`}>
      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold theme-text-primary">🧊 3D Performance Matrix</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Block Size × Queue Depth × Performance</p>
        </div>
        <div className="flex gap-3 items-center">
          {METRICS.map(m => (
            <label key={m.key} className={`group relative px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-all duration-200 ${selectedMetrics.includes(m.key as MetricKey) ? 'text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              style={selectedMetrics.includes(m.key as MetricKey) ? {backgroundColor: m.color} : {}}>
              <input
                type="checkbox"
                checked={selectedMetrics.includes(m.key as MetricKey)}
                onChange={() => setSelectedMetrics(sel => sel.includes(m.key as MetricKey) ? sel.filter(k => k !== m.key) : [...sel, m.key as MetricKey])}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: m.color}}></div>
                {m.label}
              </div>
            </label>
          ))}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="flex items-center px-3 py-2 theme-btn-secondary rounded transition-colors"
              title={isMaximized ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          )}
        </div>
      </div>
      {/* 3D Chart */}
      <div className={`w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg ${isMaximized ? "h-[calc(100vh-200px)]" : "h-96"}`}>
        <Canvas camera={{ position: [xLen + 3, 5, yLen + 4], fov: 40 }} shadows>
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[8, 12, 6]} 
            intensity={1.0} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={40}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
          />
          <directionalLight position={[-5, 8, -5]} intensity={0.3} color="#4f46e5" />
          {/* Custom positive quadrant grid */}
          <Grid args={[xLen+1, yLen+1]} position={[xLen/2-0.5, -0.01, yLen/2-0.5]} cellColor="#f1f5f9" sectionColor="#cbd5e1" infiniteGrid={false} fadeDistance={0} />
          {/* Floor plane for better depth perception */}
          <mesh position={[xLen/2-0.5, -0.05, yLen/2-0.5]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
            <planeGeometry args={[xLen+4, yLen+3]} />
            <meshStandardMaterial color="#f8fafc" opacity={0.9} transparent />
          </mesh>
          {/* Axis lines and tick marks */}
          <group>
            {/* X-axis line */}
            <mesh position={[xLen/2-0.5, -0.1, -0.5]} rotation={[0, 0, 0]}>
              <boxGeometry args={[xLen, 0.02, 0.02]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
            {/* Y-axis line */}
            <mesh position={[-0.5, -0.1, yLen/2-0.5]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.02, 0.02, yLen]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
            
            {/* X-axis tick marks */}
            {xTicks.map(({ i }) => (
              <mesh key={`x-tick-${i}`} position={[i, -0.1, -0.5]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.02, 0.1, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
            ))}
            
            {/* Y-axis tick marks */}
            {yTicks.map(({ i }) => (
              <mesh key={`y-tick-${i}`} position={[-0.5, -0.1, i]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.02, 0.1, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
            ))}
          </group>

          {/* X-axis labels as signs - closer to axis */}
          {xTicks.map(({ v, i }) => (
            <group key={`x-label-group-${i}`} position={[i, 0.01, yLen - 0.1]}>
              {/* Sign background */}
              <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[0.6, 0.3]} />
                <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
              </mesh>
              {/* Sign border */}
              <mesh position={[0, 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[0.65, 0.35]} />
                <meshBasicMaterial color="#374151" opacity={0.8} transparent />
              </mesh>
              {/* Text on the sign */}
              <Text
                position={[0, 0.002, 0]}
                fontSize={0.12}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
                rotation={[-Math.PI/2, 0, 0]}
              >
                {v.toString()}
              </Text>
            </group>
          ))}
          
          {/* Y-axis labels as signs - further from axis and flat */}
          {yTicks.map(({ v, i }) => (
            <group key={`y-label-group-${i}`} position={[-1.2, 0.01, i]}>
              {/* Sign background */}
              <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[0.6, 0.3]} />
                <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
              </mesh>
              {/* Sign border */}
              <mesh position={[0, 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[0.65, 0.35]} />
                <meshBasicMaterial color="#374151" opacity={0.8} transparent />
              </mesh>
              {/* Text on the sign */}
              <Text
                position={[0, 0.002, 0]}
                fontSize={0.12}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
                rotation={[-Math.PI/2, 0, 0]}
              >
                QD{v.toString()}
              </Text>
            </group>
          ))}

          {/* Axis titles as signs */}
          <group position={[xLen/2-0.5, 0.2, yLen + 0.2]}>
            {/* Title sign background */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
              <planeGeometry args={[1.5, 0.4]} />
              <meshBasicMaterial color="#f8fafc" opacity={0.95} transparent />
            </mesh>
            {/* Title sign border */}
            <mesh position={[0, 0, -0.001]} rotation={[0, 0, 0]}>
              <planeGeometry args={[1.6, 0.45]} />
              <meshBasicMaterial color="#1f2937" opacity={0.9} transparent />
            </mesh>
            {/* Title text */}
            <Text
              position={[0, 0, 0.002]}
              fontSize={0.15}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              rotation={[0, 0, 0]}
            >
              Block Size
            </Text>
          </group>
          
          <group position={[-1.6, 0.2, yLen/2-0.5]}>
            {/* Title sign background */}
            <mesh position={[0, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
              <planeGeometry args={[1.5, 0.4]} />
              <meshBasicMaterial color="#f8fafc" opacity={0.95} transparent />
            </mesh>
            {/* Title sign border */}
            <mesh position={[-0.001, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
              <planeGeometry args={[1.6, 0.45]} />
              <meshBasicMaterial color="#1f2937" opacity={0.9} transparent />
            </mesh>
            {/* Title text */}
            <Text
              position={[-0.002, 0, 0]}
              fontSize={0.15}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              rotation={[0, -Math.PI/2, 0]}
            >
              Queue Depth
            </Text>
          </group>
          <OrbitControls 
            enablePan 
            enableZoom 
            enableRotate 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2} 
            target={[xLen/2-0.5, 0, yLen/2-0.5]}
          />
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
                  scale={hovered?.x === x && hovered?.y === y && hovered?.metric === metric ? [1.1, 1, 1.1] : [1, 1, 1]}
                >
                  <boxGeometry args={[barWidth, height, barWidth]} />
                  <meshStandardMaterial 
                    color={METRICS.find(m => m.key === metric)?.color} 
                    opacity={hovered?.x === x && hovered?.y === y && hovered?.metric === metric ? 1.0 : 0.85} 
                    transparent 
                    roughness={0.2}
                    metalness={0.05}
                    emissive={hovered?.x === x && hovered?.y === y && hovered?.metric === metric ? METRICS.find(m => m.key === metric)?.color : '#000000'}
                    emissiveIntensity={hovered?.x === x && hovered?.y === y && hovered?.metric === metric ? 0.1 : 0}
                  />
                  {/* Enhanced tooltip using 3D Text */}
                  {hovered?.x === x && hovered?.y === y && hovered?.metric === metric && (
                    <group position={[0, height + 0.8, 0]}>
                      {/* Tooltip background */}
                      <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[1.2, 0.4, 0.1]} />
                        <meshBasicMaterial color="#000000" opacity={0.8} transparent />
                      </mesh>
                      {/* Tooltip text */}
                      <Text
                        position={[0, 0.15, 0.06]}
                        fontSize={0.08}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                        fontWeight="bold"
                      >
                        {METRICS.find(m => m.key === metric)?.label}: {value?.toLocaleString()}
                      </Text>
                      <Text
                        position={[0, 0.05, 0.06]}
                        fontSize={0.06}
                        color="#cccccc"
                        anchorX="center"
                        anchorY="middle"
                      >
                        {d.blocksize} • QD{d.queuedepth}
                      </Text>
                    </group>
                  )}
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