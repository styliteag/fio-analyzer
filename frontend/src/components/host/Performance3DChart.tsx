import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';

interface Performance3DChartProps {
    drives: DriveAnalysis[];
}

interface PerformancePoint {
    x: number;
    y: number;
    z: number;
    drive: string;
    blockSize: string;
    pattern: string;
    queueDepth: number;
    color: string;
    performanceScore: number;
}

// Component for individual data points in 3D space
const DataPoint: React.FC<{ 
    point: PerformancePoint; 
    position: [number, number, number];
    onHover: (point: PerformancePoint | null) => void;
}> = ({ point, position, onHover }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = React.useState(false);

    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.x += 0.005;
            meshRef.current.rotation.y += 0.005;
        }
    });

    const size = Math.max(0.1, Math.min(0.4, point.performanceScore * 0.3 + 0.1));

    return (
        <mesh
            ref={meshRef}
            position={position}
            onPointerOver={() => {
                setHovered(true);
                onHover(point);
            }}
            onPointerOut={() => {
                setHovered(false);
                onHover(null);
            }}
            scale={hovered ? 1.5 : 1}
        >
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial 
                color={point.color} 
                transparent 
                opacity={hovered ? 1 : 0.8}
                emissive={hovered ? point.color : '#000000'}
                emissiveIntensity={hovered ? 0.2 : 0}
            />
            {point.performanceScore > 0.7 && (
                <mesh>
                    <ringGeometry args={[size + 0.05, size + 0.1, 16]} />
                    <meshBasicMaterial color="gold" transparent opacity={0.6} />
                </mesh>
            )}
        </mesh>
    );
};

// Component for 3D axes
const Axes: React.FC<{ maxValues: { x: number; y: number; z: number } }> = ({ maxValues }) => {
    return (
        <group>
            {/* X Axis - IOPS */}
            <mesh position={[2.5, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 5]} />
                <meshBasicMaterial color="#ff6b6b" />
            </mesh>
            <mesh position={[5.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.1, 0.3]} />
                <meshBasicMaterial color="#ff6b6b" />
            </mesh>
            <Text
                position={[5.8, 0, 0]}
                fontSize={0.3}
                color="#ff6b6b"
                anchorX="left"
                anchorY="middle"
            >
                IOPS ({maxValues.x.toFixed(0)})
            </Text>

            {/* Y Axis - Latency */}
            <mesh position={[0, 2.5, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 5]} />
                <meshBasicMaterial color="#4ecdc4" />
            </mesh>
            <mesh position={[0, 5.2, 0]}>
                <coneGeometry args={[0.1, 0.3]} />
                <meshBasicMaterial color="#4ecdc4" />
            </mesh>
            <Text
                position={[0, 5.8, 0]}
                fontSize={0.3}
                color="#4ecdc4"
                anchorX="center"
                anchorY="bottom"
            >
                Latency ({maxValues.y.toFixed(1)}ms)
            </Text>

            {/* Z Axis - Bandwidth */}
            <mesh position={[0, 0, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 5]} />
                <meshBasicMaterial color="#45b7d1" />
            </mesh>
            <mesh position={[0, 0, 5.2]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.1, 0.3]} />
                <meshBasicMaterial color="#45b7d1" />
            </mesh>
            <Text
                position={[0, 0, 5.8]}
                fontSize={0.3}
                color="#45b7d1"
                anchorX="center"
                anchorY="middle"
            >
                Bandwidth ({maxValues.z.toFixed(0)} MB/s)
            </Text>

            {/* Grid lines */}
            <group>
                {[1, 2, 3, 4].map(i => (
                    <React.Fragment key={i}>
                        {/* X-Y grid */}
                        <mesh position={[i, 0, 0]}>
                            <cylinderGeometry args={[0.005, 0.005, 5]} />
                            <meshBasicMaterial color="#333333" transparent opacity={0.2} />
                        </mesh>
                        <mesh position={[0, i, 0]} rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.005, 0.005, 5]} />
                            <meshBasicMaterial color="#333333" transparent opacity={0.2} />
                        </mesh>
                        {/* X-Z grid */}
                        <mesh position={[i, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.005, 0.005, 5]} />
                            <meshBasicMaterial color="#333333" transparent opacity={0.2} />
                        </mesh>
                        <mesh position={[0, 0, i]} rotation={[0, Math.PI / 2, 0]}>
                            <cylinderGeometry args={[0.005, 0.005, 5]} />
                            <meshBasicMaterial color="#333333" transparent opacity={0.2} />
                        </mesh>
                    </React.Fragment>
                ))}
            </group>
        </group>
    );
};

// Main 3D Scene component
const Scene3D: React.FC<{ 
    points: PerformancePoint[]; 
    ranges: { x: [number, number]; y: [number, number]; z: [number, number] };
    onPointHover: (point: PerformancePoint | null) => void;
}> = ({ points, ranges, onPointHover }) => {
    const normalizeToRange = (value: number, range: [number, number], scale: number = 5) => {
        return ((value - range[0]) / (range[1] - range[0])) * scale;
    };

    const maxValues = {
        x: ranges.x[1],
        y: ranges.y[1],
        z: ranges.z[1]
    };

    return (
        <>
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            
            <Axes maxValues={maxValues} />
            
            {points.map((point, index) => {
                const x = normalizeToRange(point.x, ranges.x);
                const y = normalizeToRange(point.y, ranges.y);
                const z = normalizeToRange(point.z, ranges.z);
                
                return (
                    <DataPoint
                        key={index}
                        point={point}
                        position={[x, y, z]}
                        onHover={onPointHover}
                    />
                );
            })}
            
            <OrbitControls 
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={5}
                maxDistance={20}
                autoRotate={false}
                autoRotateSpeed={2}
            />
        </>
    );
};

const Performance3DChart: React.FC<Performance3DChartProps> = ({ drives }) => {
    const [hoveredPoint, setHoveredPoint] = React.useState<PerformancePoint | null>(null);
    
    const colors = [
        '#3B82F6', // blue
        '#10B981', // green
        '#F56565', // red
        '#8B5CF6', // purple
        '#F59E0B', // yellow
        '#EC4899', // pink
    ];

    // Prepare 3D data points
    const points = useMemo(() => {
        const allPoints: PerformancePoint[] = [];
        
        drives.forEach((drive, driveIndex) => {
            const validConfigs = drive.configurations.filter(c => 
                c.iops !== null && c.avg_latency !== null && c.bandwidth !== null &&
                c.iops !== undefined && c.avg_latency !== undefined && c.bandwidth !== undefined &&
                c.iops > 0 && c.avg_latency > 0 && c.bandwidth > 0
            );

            validConfigs.forEach(config => {
                const iops = config.iops || 0;
                const latency = config.avg_latency || 0;
                const bandwidth = config.bandwidth || 0;
                
                // Calculate performance score
                const maxIOPS = Math.max(...drives.flatMap(d => d.configurations.map(c => c.iops || 0)));
                const maxBandwidth = Math.max(...drives.flatMap(d => d.configurations.map(c => c.bandwidth || 0)));
                const minLatency = Math.min(...drives.flatMap(d => d.configurations.map(c => c.avg_latency || Infinity)));
                
                const performanceScore = (iops / maxIOPS) * (bandwidth / maxBandwidth) / ((latency / minLatency) || 1);
                
                allPoints.push({
                    x: iops,
                    y: latency,
                    z: bandwidth,
                    drive: drive.drive_model,
                    blockSize: config.block_size,
                    pattern: config.read_write_pattern,
                    queueDepth: config.queue_depth,
                    color: colors[driveIndex % colors.length],
                    performanceScore
                });
            });
        });

        return allPoints;
    }, [drives, colors]);

    // Calculate ranges for normalization
    const ranges = useMemo(() => {
        if (points.length === 0) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number], z: [0, 1] as [number, number] };

        const xValues = points.map(p => p.x);
        const yValues = points.map(p => p.y);
        const zValues = points.map(p => p.z);

        return {
            x: [Math.min(...xValues), Math.max(...xValues)] as [number, number],
            y: [Math.min(...yValues), Math.max(...yValues)] as [number, number],
            z: [Math.min(...zValues), Math.max(...zValues)] as [number, number]
        };
    }, [points]);

    return (
        <div className="w-full">
            <div className="mb-4">
                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                    Interactive 3D Performance Visualization
                </h4>
                <p className="text-sm theme-text-secondary mb-4">
                    Drag to rotate • Scroll to zoom • Hover points for details
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Interactive 3D Chart */}
                <div className="flex-1">
                    <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-4" style={{ height: '600px' }}>
                        <Canvas
                            camera={{ position: [8, 8, 8], fov: 50 }}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Scene3D 
                                points={points} 
                                ranges={ranges} 
                                onPointHover={setHoveredPoint}
                            />
                        </Canvas>
                        
                        {/* Floating hover info */}
                        {hoveredPoint && (
                            <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border max-w-sm z-10">
                                <h6 className="font-medium theme-text-primary mb-2">{hoveredPoint.drive}</h6>
                                <div className="text-xs theme-text-secondary space-y-1">
                                    <div>Config: {hoveredPoint.blockSize} {hoveredPoint.pattern} QD{hoveredPoint.queueDepth}</div>
                                    <div>IOPS: <span className="font-medium">{hoveredPoint.x.toFixed(0)}</span></div>
                                    <div>Latency: <span className="font-medium">{hoveredPoint.y.toFixed(2)}ms</span></div>
                                    <div>Bandwidth: <span className="font-medium">{hoveredPoint.z.toFixed(1)} MB/s</span></div>
                                    <div>Performance Score: <span className="font-medium">{hoveredPoint.performanceScore.toFixed(2)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Controls help */}
                        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                            <div className="text-xs theme-text-secondary space-y-1">
                                <div className="font-medium text-xs theme-text-primary mb-1">Controls:</div>
                                <div>• Left drag: Rotate view</div>
                                <div>• Right drag: Pan view</div>
                                <div>• Scroll: Zoom in/out</div>
                                <div>• Hover: Show details</div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border max-w-xs">
                            <h5 className="text-sm font-medium theme-text-primary mb-2">Drives</h5>
                            <div className="space-y-1">
                                {drives.map((drive, index) => (
                                    <div key={drive.drive_model} className="flex items-center gap-2 text-xs">
                                        <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: colors[index % colors.length] }}
                                        ></div>
                                        <span className="theme-text-secondary truncate">{drive.drive_model}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Summary */}
                <div className="lg:w-80">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                        <h5 className="text-lg font-medium theme-text-primary mb-4">Performance Summary</h5>
                        
                        <div className="space-y-4">
                            {drives.map((drive, index) => {
                                const drivePoints = points.filter(p => p.drive === drive.drive_model);
                                if (drivePoints.length === 0) return null;

                                const avgIOPS = drivePoints.reduce((sum, p) => sum + p.x, 0) / drivePoints.length;
                                const avgLatency = drivePoints.reduce((sum, p) => sum + p.y, 0) / drivePoints.length;
                                const avgBandwidth = drivePoints.reduce((sum, p) => sum + p.z, 0) / drivePoints.length;
                                const performanceScore = (avgIOPS * avgBandwidth) / (avgLatency * 1000);

                                return (
                                    <div key={drive.drive_model} className="border-l-4 pl-3" style={{ borderColor: colors[index % colors.length] }}>
                                        <h6 className="font-medium theme-text-primary text-sm">{drive.drive_model}</h6>
                                        <div className="mt-2 space-y-1 text-xs theme-text-secondary">
                                            <div>Avg IOPS: <span className="font-medium">{avgIOPS.toFixed(0)}</span></div>
                                            <div>Avg Latency: <span className="font-medium">{avgLatency.toFixed(2)}ms</span></div>
                                            <div>Avg Bandwidth: <span className="font-medium">{avgBandwidth.toFixed(1)} MB/s</span></div>
                                            <div>Score: <span className="font-medium">{performanceScore.toFixed(2)}</span></div>
                                            <div>Configs: <span className="font-medium">{drivePoints.length}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <h6 className="text-sm font-medium theme-text-primary mb-2">Top Configurations</h6>
                            <div className="space-y-2 text-xs">
                                {points
                                    .sort((a, b) => b.performanceScore - a.performanceScore)
                                    .slice(0, 3)
                                    .map((point, index) => (
                                        <div key={index} className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                            <div className="font-medium theme-text-primary">{point.drive}</div>
                                            <div className="theme-text-secondary">
                                                {point.blockSize} {point.pattern} QD{point.queueDepth}
                                            </div>
                                            <div className="theme-text-secondary">
                                                {point.x.toFixed(0)} IOPS, {point.y.toFixed(2)}ms, {point.z.toFixed(1)} MB/s
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Performance3DChart;