/* eslint-disable react/no-unknown-property */
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { generateUniqueColorsForChart } from '../../utils/colorMapping';

interface Performance3DChartProps {
    drives: DriveAnalysis[];
    allDrives?: DriveAnalysis[]; // Original unfiltered data for axis scaling
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
    p70_latency?: number | null;
    p90_latency?: number | null;
    p95_latency?: number | null;
    p99_latency?: number | null;
    timestamp: string;
    driveType: string;
    protocol: string;
}

// Component for dynamic camera control that works with OrbitControls
const CameraController: React.FC<{
    cameraMode: 'perspective' | 'orthographic';
    fov: number;
    position: [number, number, number];
}> = React.memo(function CameraController({ cameraMode, fov, position }) {
    const { camera, size, set } = useThree();
    const controlsRef = useRef<any>(null);
    
    useEffect(() => {
        if (cameraMode === 'perspective') {
            if (!(camera instanceof THREE.PerspectiveCamera)) {
                // Create new perspective camera
                const newCamera = new THREE.PerspectiveCamera(fov, size.width / size.height, 0.1, 1000);
                newCamera.position.set(...position);
                set({ camera: newCamera });
            } else {
                // Update existing perspective camera
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        } else {
            if (!(camera instanceof THREE.OrthographicCamera)) {
                // Create new orthographic camera
                const aspect = size.width / size.height;
                const newCamera = new THREE.OrthographicCamera(-6 * aspect, 6 * aspect, 6, -6, 0.1, 1000);
                newCamera.position.set(...position);
                set({ camera: newCamera });
            }
        }
    }, [cameraMode, fov, camera, size, set, position]);
    
    // Handle position updates separately to work with OrbitControls
    useEffect(() => {
        if (controlsRef.current) {
            // Update the controls to move to new position
            controlsRef.current.object.position.set(...position);
            controlsRef.current.update();
        }
    }, [position]);
    
    return (
        <OrbitControls 
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={20}
            autoRotate={false}
            autoRotateSpeed={2}
        />
    );
}, (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
        prevProps.cameraMode === nextProps.cameraMode &&
        prevProps.fov === nextProps.fov &&
        prevProps.position[0] === nextProps.position[0] &&
        prevProps.position[1] === nextProps.position[1] &&
        prevProps.position[2] === nextProps.position[2]
    );
});

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

    const size = Math.max(0.05, Math.min(0.2, point.performanceScore * 0.15 + 0.05));

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
                opacity={hovered ? 1 : 0.95}
                emissive={point.color}
                emissiveIntensity={hovered ? 0.3 : 0.1}
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
const Axes: React.FC<{ 
    maxValues: { x: number; y: number; z: number };
    colorScheme: any;
}> = ({ maxValues, colorScheme }) => {
    return (
        <group>
            {/* X Axis - Latency */}
            <mesh position={[2.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
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
                Latency ({maxValues.x.toFixed(1)}ms)
            </Text>

            {/* Y Axis - IOPS */}
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
                IOPS ({maxValues.y.toFixed(0)})
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

            {/* Floor */}
            <mesh position={[2.5, 0, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[5, 5]} />
                <meshBasicMaterial 
                    color={colorScheme.floor} 
                    transparent 
                    opacity={0.3}
                    side={2}
                />
            </mesh>
            
            {/* Floor grid pattern */}
            <group>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map(i => (
                    <React.Fragment key={`floor-${i}`}>
                        {/* Grid lines along X */}
                        <mesh position={[2.5, 0.001, i]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                            <planeGeometry args={[5, 0.04]} />
                            <meshBasicMaterial color={colorScheme.floorGrid} transparent opacity={0.4} />
                        </mesh>
                        {/* Grid lines along Z */}
                        <mesh position={[i, 0.001, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[5, 0.04]} />
                            <meshBasicMaterial color={colorScheme.floorGrid} transparent opacity={0.4} />
                        </mesh>
                    </React.Fragment>
                ))}
            </group>

            {/* Back Wall (X-Y plane at Z=0) */}
            <mesh position={[2.5, 2.5, 0]}>
                <planeGeometry args={[5, 5]} />
                <meshBasicMaterial 
                    color={colorScheme.walls} 
                    transparent 
                    opacity={0.25}
                    side={2}
                />
            </mesh>
            
            {/* Side Wall (Y-Z plane at X=0) */}
            <mesh position={[0, 2.5, 2.5]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[5, 5]} />
                <meshBasicMaterial 
                    color={colorScheme.walls} 
                    transparent 
                    opacity={0.25}
                    side={2}
                />
            </mesh>

            {/* Wall grid patterns */}
            <group>
                {/* Back wall grid */}
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map(i => (
                    <React.Fragment key={`back-wall-${i}`}>
                        {/* Horizontal lines */}
                        <mesh position={[2.5, i, 0.001]}>
                            <planeGeometry args={[5, 0.03]} />
                            <meshBasicMaterial color={colorScheme.wallGrid} transparent opacity={0.3} />
                        </mesh>
                        {/* Vertical lines */}
                        <mesh position={[i, 2.5, 0.001]}>
                            <planeGeometry args={[0.03, 5]} />
                            <meshBasicMaterial color={colorScheme.wallGrid} transparent opacity={0.3} />
                        </mesh>
                    </React.Fragment>
                ))}
                
                {/* Side wall grid */}
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map(i => (
                    <React.Fragment key={`side-wall-${i}`}>
                        {/* Horizontal lines */}
                        <mesh position={[0.001, i, 2.5]} rotation={[0, Math.PI / 2, 0]}>
                            <planeGeometry args={[5, 0.03]} />
                            <meshBasicMaterial color={colorScheme.wallGrid} transparent opacity={0.3} />
                        </mesh>
                        {/* Vertical lines */}
                        <mesh position={[0.001, 2.5, i]} rotation={[0, Math.PI / 2, 0]}>
                            <planeGeometry args={[0.03, 5]} />
                            <meshBasicMaterial color={colorScheme.wallGrid} transparent opacity={0.3} />
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
    colorScheme: any;
    cameraMode: 'perspective' | 'orthographic';
    fov: number;
    cameraPosition: [number, number, number];
}> = ({ points, ranges, onPointHover, colorScheme, cameraMode, fov, cameraPosition }) => {
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
            <CameraController 
                cameraMode={cameraMode} 
                fov={fov} 
                position={cameraPosition} 
            />
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            
            <Axes maxValues={maxValues} colorScheme={colorScheme} />
            
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
            
        </>
    );
};

const Performance3DChart: React.FC<Performance3DChartProps> = ({ drives, allDrives }) => {
    const [hoveredPoint, setHoveredPoint] = React.useState<PerformancePoint | null>(null);
    const [isMaximized, setIsMaximized] = React.useState<boolean>(false);
    const [colorScheme, setColorScheme] = React.useState<string>('vibrant');
    const [cameraMode, setCameraMode] = React.useState<'perspective' | 'orthographic'>('perspective');
    const [fov, setFov] = React.useState<number>(30);
    const [cameraPosition, setCameraPosition] = React.useState<[number, number, number]>([12, 12, 12]);
    
    // Memoize camera position to prevent unnecessary re-renders
    const memoizedCameraPosition = useMemo(() => cameraPosition, [cameraPosition]);
    
    const colorSchemes = {
        vibrant: {
            name: 'Vibrant',
            drives: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
            floor: '#2C3E50',
            walls: '#34495E',
            floorGrid: '#4A6741',
            wallGrid: '#5D6D7E',
            corners: '#7F8C8D'
        },
        neon: {
            name: 'Neon',
            drives: ['#FF073A', '#39FF14', '#00FFFF', '#FF69B4', '#FFD700', '#8A2BE2'],
            floor: '#0D1B2A',
            walls: '#1B263B',
            floorGrid: '#00F5FF',
            wallGrid: '#FF1493',
            corners: '#32CD32'
        },
        professional: {
            name: 'Professional',
            drives: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#592E83', '#3A5998'],
            floor: '#F8F9FA',
            walls: '#E9ECEF',
            floorGrid: '#6C757D',
            wallGrid: '#ADB5BD',
            corners: '#495057'
        },
        ocean: {
            name: 'Ocean',
            drives: ['#006D75', '#19A7CE', '#61A3FE', '#B088F9', '#FF6B9D', '#C9F2C7'],
            floor: '#001F3F',
            walls: '#0074D9',
            floorGrid: '#7FDBFF',
            wallGrid: '#B10DC9',
            corners: '#3D9970'
        },
        sunset: {
            name: 'Sunset',
            drives: ['#FF4136', '#FF851B', '#FFDC00', '#2ECC40', '#0074D9', '#B10DC9'],
            floor: '#2C1810',
            walls: '#4A2C2A',
            floorGrid: '#FF851B',
            wallGrid: '#FFDC00',
            corners: '#FF4136'
        }
    };
    
    const currentScheme = colorSchemes[colorScheme as keyof typeof colorSchemes];

    // Generate intelligent colors for drives based on hostname and drive model
    const driveColors = useMemo(() => {
        const uniqueColors = generateUniqueColorsForChart(
            drives.map(drive => ({
                hostname: drive.hostname,
                driveModel: drive.drive_model,
                label: drive.drive_model
            })),
            'primary'
        );
        
        // Convert RGBA colors to hex format for three.js
        const hexColors = uniqueColors.map(color => {
            if (color.startsWith('rgba')) {
                const match = color.match(/rgba?\(([^)]+)\)/);
                if (match) {
                    const [r, g, b] = match[1].split(',').map(n => parseInt(n.trim()));
                    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                }
            }
            return color;
        });
        
        return hexColors;
    }, [drives]);

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
                
                // Calculate performance score using fixed ranges from all data
                const dataSource = allDrives || drives;
                const maxIOPS = Math.max(...dataSource.flatMap(d => d.configurations.map(c => c.iops || 0)));
                const maxBandwidth = Math.max(...dataSource.flatMap(d => d.configurations.map(c => c.bandwidth || 0)));
                const minLatency = Math.min(...dataSource.flatMap(d => d.configurations.map(c => c.avg_latency || Infinity)));
                
                const performanceScore = (iops / maxIOPS) * (bandwidth / maxBandwidth) / ((latency / minLatency) || 1);
                
                allPoints.push({
                    x: latency,
                    y: iops,
                    z: bandwidth,
                    drive: drive.drive_model,
                    blockSize: config.block_size,
                    pattern: config.read_write_pattern,
                    queueDepth: config.queue_depth,
                    color: driveColors[driveIndex] || currentScheme.drives[driveIndex % currentScheme.drives.length],
                    performanceScore,
                    p70_latency: config.p70_latency,
                    p90_latency: config.p90_latency,
                    p95_latency: config.p95_latency,
                    p99_latency: config.p99_latency,
                    timestamp: config.timestamp,
                    driveType: drive.drive_type,
                    protocol: drive.protocol
                });
            });
        });

        return allPoints;
    }, [drives, currentScheme.drives, allDrives, driveColors]);

    // Calculate fixed ranges based on ALL original data (not filtered data) for consistent scaling
    const ranges = useMemo(() => {
        // Use original unfiltered data if available, otherwise fall back to current drives
        const dataSource = allDrives || drives;
        
        // Get all possible values from all drives, not just current filtered points
        const allConfigs = dataSource.flatMap(drive => drive.configurations);
        const validConfigs = allConfigs.filter(c => 
            c.iops !== null && c.avg_latency !== null && c.bandwidth !== null &&
            c.iops !== undefined && c.avg_latency !== undefined && c.bandwidth !== undefined &&
            c.iops > 0 && c.avg_latency > 0 && c.bandwidth > 0
        );

        if (validConfigs.length === 0) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number], z: [0, 1] as [number, number] };

        const xValues = validConfigs.map(c => c.avg_latency || 0);
        const yValues = validConfigs.map(c => c.iops || 0);
        const zValues = validConfigs.map(c => c.bandwidth || 0);

        return {
            x: [0, Math.max(...xValues)] as [number, number], // Start from 0 for Latency
            y: [0, Math.max(...yValues)] as [number, number], // Start from 0 for IOPS
            z: [0, Math.max(...zValues)] as [number, number]  // Start from 0 for Bandwidth
        };
    }, [allDrives, drives]); // Depends on original data, not filtered points

    return (
        <div className="w-full">
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-semibold theme-text-primary">
                        Interactive 3D Performance Visualization
                    </h4>
                    <button
                        onClick={() => setIsMaximized(true)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Maximize visualization"
                    >
                        <svg className="w-5 h-5 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                </div>
                <p className="text-sm theme-text-secondary mb-4">
                    Drag to rotate • Scroll to zoom • Hover points for details
                </p>
                
                {/* Color Scheme Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm theme-text-secondary mr-2">Color Scheme:</span>
                    {Object.entries(colorSchemes).map(([key, scheme]) => (
                        <button
                            key={key}
                            onClick={() => setColorScheme(key)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                colorScheme === key
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                            }`}
                        >
                            {scheme.name}
                        </button>
                    ))}
                </div>
                
                {/* Camera Mode Toggle */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm theme-text-secondary mr-2">Camera Mode:</span>
                    <button
                        onClick={() => setCameraMode('perspective')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                            cameraMode === 'perspective'
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                        }`}
                    >
                        Perspective
                    </button>
                    <button
                        onClick={() => setCameraMode('orthographic')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                            cameraMode === 'orthographic'
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                        }`}
                    >
                        Orthographic
                    </button>
                </div>
                
                {/* Camera Controls */}
                <div className="flex flex-wrap gap-4 mb-4">
                    {/* FOV Slider (only for perspective mode) */}
                    {cameraMode === 'perspective' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm theme-text-secondary">FOV:</span>
                            <input
                                type="range"
                                min="15"
                                max="60"
                                value={fov}
                                onChange={(e) => setFov(Number(e.target.value))}
                                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs theme-text-secondary">{fov}°</span>
                        </div>
                    )}
                    
                    {/* Preset Camera Positions */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm theme-text-secondary">View:</span>
                        <button
                            onClick={() => setCameraPosition([12, 12, 12])}
                            className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                        >
                            Isometric
                        </button>
                        <button
                            onClick={() => setCameraPosition([15, 5, 5])}
                            className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                        >
                            Front
                        </button>
                        <button
                            onClick={() => setCameraPosition([5, 15, 5])}
                            className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                        >
                            Side
                        </button>
                        <button
                            onClick={() => setCameraPosition([5, 5, 15])}
                            className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                        >
                            Top
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Interactive 3D Chart */}
                <div className="flex-1">
                    <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-4" style={{ height: '600px' }}>
                        <Canvas
                            camera={{ position: memoizedCameraPosition, fov: fov }}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Scene3D 
                                points={points} 
                                ranges={ranges} 
                                onPointHover={setHoveredPoint}
                                colorScheme={currentScheme}
                                cameraMode={cameraMode}
                                fov={fov}
                                cameraPosition={memoizedCameraPosition}
                            />
                        </Canvas>
                        
                        {/* Floating hover info */}
                        {hoveredPoint && (
                            <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border max-w-sm z-10">
                                <div className="space-y-3">
                                    {/* Drive Info */}
                                    <div>
                                        <h6 className="font-medium theme-text-primary text-sm">{hoveredPoint.drive}</h6>
                                        <p className="text-xs theme-text-secondary">{hoveredPoint.driveType} - {hoveredPoint.protocol}</p>
                                    </div>
                                    
                                    {/* Test Configuration */}
                                    <div>
                                        <h6 className="font-medium theme-text-primary text-xs mb-1">Test Configuration</h6>
                                        <div className="text-xs theme-text-secondary space-y-1">
                                            <div>Block Size: <span className="font-medium">{hoveredPoint.blockSize}</span></div>
                                            <div>Pattern: <span className="font-medium">{hoveredPoint.pattern}</span></div>
                                            <div>Queue Depth: <span className="font-medium">{hoveredPoint.queueDepth}</span></div>
                                        </div>
                                    </div>
                                    
                                    {/* Performance Metrics */}
                                    <div>
                                        <h6 className="font-medium theme-text-primary text-xs mb-1">Performance Metrics</h6>
                                        <div className="text-xs theme-text-secondary space-y-1">
                                            <div>Latency: <span className="font-medium">{hoveredPoint.x.toFixed(2)}ms</span></div>
                                            <div>IOPS: <span className="font-medium">{hoveredPoint.y.toFixed(0)}</span></div>
                                            <div>Bandwidth: <span className="font-medium">{hoveredPoint.z.toFixed(1)} MB/s</span></div>
                                            <div>70th Percentile: <span className="font-medium">{hoveredPoint.p70_latency !== null && hoveredPoint.p70_latency !== undefined ? hoveredPoint.p70_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                            <div>90th Percentile: <span className="font-medium">{hoveredPoint.p90_latency !== null && hoveredPoint.p90_latency !== undefined ? hoveredPoint.p90_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                            <div>95th Percentile: <span className="font-medium">{hoveredPoint.p95_latency !== null && hoveredPoint.p95_latency !== undefined ? hoveredPoint.p95_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                            <div>99th Percentile: <span className="font-medium">{hoveredPoint.p99_latency !== null && hoveredPoint.p99_latency !== undefined ? hoveredPoint.p99_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                            <div>Score: <span className="font-medium">{hoveredPoint.performanceScore.toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                    
                                    {/* Test Date */}
                                    <div>
                                        <h6 className="font-medium theme-text-primary text-xs mb-1">Test Date</h6>
                                        <div className="text-xs theme-text-secondary">
                                            {new Date(hoveredPoint.timestamp).toLocaleDateString()} {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
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
                                    <div key={`${drive.hostname || 'unknown'}-${drive.protocol}-${drive.drive_type}-${drive.drive_model}-${index}`} className="flex items-center gap-2 text-xs">
                                        <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: currentScheme.drives[index % currentScheme.drives.length] }}
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
                                    <div key={`${drive.hostname || 'unknown'}-${drive.protocol}-${drive.drive_type}-${drive.drive_model}-summary-${index}`} className="border-l-4 pl-3" style={{ borderColor: currentScheme.drives[index % currentScheme.drives.length] }}>
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
                                                {point.x.toFixed(2)}ms, {point.y.toFixed(0)} IOPS, {point.z.toFixed(1)} MB/s
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Maximized Visualization Modal */}
            {isMaximized && (
                <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-hidden">
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold theme-text-primary">
                                Interactive 3D Performance Visualization - Maximized
                            </h2>
                            <button
                                onClick={() => setIsMaximized(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Exit fullscreen"
                            >
                                <svg className="w-6 h-6 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Controls */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex flex-wrap gap-4 items-center">
                                {/* Color Scheme */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm theme-text-secondary">Color:</span>
                                    {Object.entries(colorSchemes).map(([key, scheme]) => (
                                        <button
                                            key={key}
                                            onClick={() => setColorScheme(key)}
                                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                                colorScheme === key
                                                    ? 'bg-blue-500 text-white shadow-md'
                                                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                                            }`}
                                        >
                                            {scheme.name}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Camera Mode */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm theme-text-secondary">Camera:</span>
                                    <button
                                        onClick={() => setCameraMode('perspective')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                            cameraMode === 'perspective'
                                                ? 'bg-green-500 text-white shadow-md'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                                        }`}
                                    >
                                        Perspective
                                    </button>
                                    <button
                                        onClick={() => setCameraMode('orthographic')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                            cameraMode === 'orthographic'
                                                ? 'bg-green-500 text-white shadow-md'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary'
                                        }`}
                                    >
                                        Orthographic
                                    </button>
                                </div>
                                
                                {/* FOV Slider */}
                                {cameraMode === 'perspective' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm theme-text-secondary">FOV:</span>
                                        <input
                                            type="range"
                                            min="15"
                                            max="60"
                                            value={fov}
                                            onChange={(e) => setFov(Number(e.target.value))}
                                            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-xs theme-text-secondary">{fov}°</span>
                                    </div>
                                )}
                                
                                {/* Preset Views */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm theme-text-secondary">View:</span>
                                    <button
                                        onClick={() => setCameraPosition([12, 12, 12])}
                                        className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                                    >
                                        Isometric
                                    </button>
                                    <button
                                        onClick={() => setCameraPosition([15, 5, 5])}
                                        className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                                    >
                                        Front
                                    </button>
                                    <button
                                        onClick={() => setCameraPosition([5, 15, 5])}
                                        className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                                    >
                                        Side
                                    </button>
                                    <button
                                        onClick={() => setCameraPosition([5, 5, 15])}
                                        className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 theme-text-secondary"
                                    >
                                        Top
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* 3D Visualization */}
                        <div className="flex-1 relative bg-gray-50 dark:bg-gray-900">
                            <Canvas
                                camera={{ position: memoizedCameraPosition, fov: fov }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <Scene3D 
                                    points={points} 
                                    ranges={ranges} 
                                    onPointHover={setHoveredPoint}
                                    colorScheme={currentScheme}
                                    cameraMode={cameraMode}
                                    fov={fov}
                                    cameraPosition={memoizedCameraPosition}
                                />
                            </Canvas>
                            
                            {/* Hover info in maximized view */}
                            {hoveredPoint && (
                                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border max-w-sm z-10">
                                    <div className="space-y-3">
                                        {/* Drive Info */}
                                        <div>
                                            <h6 className="font-medium theme-text-primary text-sm">{hoveredPoint.drive}</h6>
                                            <p className="text-xs theme-text-secondary">{hoveredPoint.driveType} - {hoveredPoint.protocol}</p>
                                        </div>
                                        
                                        {/* Test Configuration */}
                                        <div>
                                            <h6 className="font-medium theme-text-primary text-xs mb-1">Test Configuration</h6>
                                            <div className="text-xs theme-text-secondary space-y-1">
                                                <div>Block Size: <span className="font-medium">{hoveredPoint.blockSize}</span></div>
                                                <div>Pattern: <span className="font-medium">{hoveredPoint.pattern}</span></div>
                                                <div>Queue Depth: <span className="font-medium">{hoveredPoint.queueDepth}</span></div>
                                            </div>
                                        </div>
                                        
                                        {/* Performance Metrics */}
                                        <div>
                                            <h6 className="font-medium theme-text-primary text-xs mb-1">Performance Metrics</h6>
                                            <div className="text-xs theme-text-secondary space-y-1">
                                                <div>Latency: <span className="font-medium">{hoveredPoint.x.toFixed(2)}ms</span></div>
                                                <div>IOPS: <span className="font-medium">{hoveredPoint.y.toFixed(0)}</span></div>
                                                <div>Bandwidth: <span className="font-medium">{hoveredPoint.z.toFixed(1)} MB/s</span></div>
                                                <div>95th Percentile: <span className="font-medium">{hoveredPoint.p95_latency !== null && hoveredPoint.p95_latency !== undefined ? hoveredPoint.p95_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                                <div>99th Percentile: <span className="font-medium">{hoveredPoint.p99_latency !== null && hoveredPoint.p99_latency !== undefined ? hoveredPoint.p99_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                                <div>Score: <span className="font-medium">{hoveredPoint.performanceScore.toFixed(2)}</span></div>
                                            </div>
                                        </div>
                                        
                                        {/* Test Date */}
                                        <div>
                                            <h6 className="font-medium theme-text-primary text-xs mb-1">Test Date</h6>
                                            <div className="text-xs theme-text-secondary">
                                                {new Date(hoveredPoint.timestamp).toLocaleDateString()} {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Help text in maximized view */}
                            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                                <div className="text-xs theme-text-secondary space-y-1">
                                    <div className="font-medium text-xs theme-text-primary mb-1">Controls:</div>
                                    <div>• Left drag: Rotate view</div>
                                    <div>• Right drag: Pan view</div>
                                    <div>• Scroll: Zoom in/out</div>
                                    <div>• Hover: Show details</div>
                                    <div>• ESC: Exit fullscreen</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Performance3DChart;