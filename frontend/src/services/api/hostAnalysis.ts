import type { TestRun } from '../../types';
import { fetchTestRuns } from './testRuns';

export interface HostAnalysisData {
    hostname: string;
    totalTests: number;
    drives: DriveAnalysis[];
    testCoverage: TestCoverage;
    performanceSummary: PerformanceSummary;
}

export interface DriveAnalysis {
    drive_model: string;
    drive_type: string;
    protocol: string;
    hostname: string;
    testCount: number;
    configurations: TestConfiguration[];
    topPerformance: {
        maxIOPS: number;
        minLatency: number;
        maxBandwidth: number;
    };
}

export interface TestConfiguration {
    block_size: string;
    read_write_pattern: string;
    queue_depth: number;
    num_jobs: number | null | undefined;
    iops: number | null | undefined;
    avg_latency: number | null | undefined;
    bandwidth: number | null | undefined;
    p95_latency: number | null | undefined;
    p99_latency: number | null | undefined;
    timestamp: string;
}

export interface TestCoverage {
    blockSizes: string[];
    patterns: string[];
    queueDepths: number[];
    numJobs: number[];
    protocols: string[];
    hostDiskCombinations: string[];
}

export interface PerformanceSummary {
    avgIOPS: number;
    avgLatency: number;
    avgBandwidth: number;
    bestDrive: string;
    worstDrive: string;
}

export const fetchHostAnalysis = async (hostname: string): Promise<HostAnalysisData> => {
    const response = await fetchTestRuns({ hostnames: [hostname] });
    
    // Handle API response wrapper
    if (!response.data) {
        throw new Error(`Failed to fetch test runs for host: ${hostname}`);
    }
    
    const testRuns = response.data;

    // Debug: Show what data we received
    console.log(`=== API DEBUG for ${hostname} ===`);
    console.log(`Total test runs received: ${testRuns.length}`);
    testRuns.forEach((run, index) => {
        console.log(`Run ${index}: hostname=${run.hostname}, protocol=${run.protocol}, drive_model=${run.drive_model}, drive_type=${run.drive_type}, iops=${run.iops}`);
    });

    // Filter out test runs with null performance data
    // Note: avg_latency is optional since it may not be available for all test data
    const validRuns = testRuns.filter((run: TestRun) =>
        run.iops !== null && run.bandwidth !== null
    );

    console.log(`Valid runs after filtering: ${validRuns.length}`);
    console.log('=== END API DEBUG ===');
    
    if (validRuns.length === 0) {
        throw new Error(`No valid performance data found for host: ${hostname}`);
    }
    
    // Group by protocol + drive model combination (not just drive model)
    const driveGroups = validRuns.reduce((acc: Record<string, TestRun[]>, run: TestRun) => {
        const protocol = run.protocol || 'unknown';
        const driveModel = run.drive_model || 'unknown';
        const key = `${protocol}-${driveModel}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(run);
        return acc;
    }, {} as Record<string, TestRun[]>);
    
    // Debug: Show drive grouping results
    console.log('=== DRIVE GROUPING DEBUG ===');
    console.log(`Number of drive groups: ${Object.keys(driveGroups).length}`);
    Object.entries(driveGroups).forEach(([key, runs]) => {
        console.log(`Group ${key}: ${runs.length} test runs`);
        console.log(`  Sample run: protocol=${runs[0].protocol}, drive_model=${runs[0].drive_model}, drive_type=${runs[0].drive_type}`);
    });
    console.log('=== END DRIVE GROUPING DEBUG ===');

    // Analyze each drive
    const drives: DriveAnalysis[] = Object.entries(driveGroups).map(([driveKey, runs]) => {
        const configurations: TestConfiguration[] = runs.map((run: TestRun) => ({
            block_size: String(run.block_size),
            read_write_pattern: run.read_write_pattern,
            queue_depth: run.queue_depth,
            num_jobs: run.num_jobs || null,
            iops: run.iops,
            avg_latency: run.avg_latency,
            bandwidth: run.bandwidth,
            p95_latency: run.p95_latency,
            p99_latency: run.p99_latency,
            timestamp: run.timestamp
        }));

        const validConfigs = configurations.filter(c => c.iops !== null);

        return {
            drive_model: runs[0].drive_model || 'unknown',
            drive_type: runs[0].drive_type,
            protocol: runs[0].protocol || 'unknown',
            hostname: runs[0].hostname || 'unknown',
            testCount: runs.length,
            configurations,
            topPerformance: {
                maxIOPS: Math.max(...validConfigs.map(c => c.iops || 0)),
                minLatency: Math.min(...validConfigs.filter(c => c.avg_latency !== null).map(c => c.avg_latency || Infinity)) || 0,
                maxBandwidth: Math.max(...validConfigs.map(c => c.bandwidth || 0))
            }
        };
    });
    
    // Calculate test coverage
    const testCoverage: TestCoverage = {
        blockSizes: [...new Set(validRuns.map((r: TestRun) => String(r.block_size)))].sort(),
        patterns: [...new Set(validRuns.map((r: TestRun) => r.read_write_pattern))].sort(),
        queueDepths: [...new Set(validRuns.map((r: TestRun) => r.queue_depth))].sort((a: number, b: number) => a - b),
        numJobs: [...new Set(validRuns.filter((r: TestRun) => r.num_jobs !== null && r.num_jobs !== undefined).map((r: TestRun) => r.num_jobs!))].sort((a: number, b: number) => a - b),
        protocols: [...new Set(validRuns.map((r: TestRun) => r.protocol || 'unknown'))].sort(),
        hostDiskCombinations: [...new Set(validRuns.map((r: TestRun) => 
            `${r.hostname} - ${r.protocol} - ${r.drive_model}`
        ))].sort()
    };
    
    // Calculate performance summary
    const allIOPS = validRuns.filter((r: TestRun) => r.iops !== null).map((r: TestRun) => r.iops!);
    const allLatencies = validRuns.filter((r: TestRun) => r.avg_latency !== null).map((r: TestRun) => r.avg_latency!);
    const allBandwidths = validRuns.filter((r: TestRun) => r.bandwidth !== null).map((r: TestRun) => r.bandwidth!);
    
    const drivePerformanceScores = drives.map(drive => ({
        drive_model: drive.drive_model,
        score: drive.topPerformance.maxIOPS / (drive.topPerformance.minLatency || 1)
    }));
    
    const bestDrive = drivePerformanceScores.reduce((best, current) => 
        current.score > best.score ? current : best
    );
    
    const worstDrive = drivePerformanceScores.reduce((worst, current) => 
        current.score < worst.score ? current : worst
    );
    
    const performanceSummary: PerformanceSummary = {
        avgIOPS: allIOPS.length > 0 ? allIOPS.reduce((sum: number, val: number) => sum + val, 0) / allIOPS.length : 0,
        avgLatency: allLatencies.length > 0 ? allLatencies.reduce((sum: number, val: number) => sum + val, 0) / allLatencies.length : 0,
        avgBandwidth: allBandwidths.length > 0 ? allBandwidths.reduce((sum: number, val: number) => sum + val, 0) / allBandwidths.length : 0,
        bestDrive: bestDrive.drive_model,
        worstDrive: worstDrive.drive_model
    };
    
    return {
        hostname,
        totalTests: validRuns.length,
        drives: drives.sort((a, b) => b.topPerformance.maxIOPS - a.topPerformance.maxIOPS),
        testCoverage,
        performanceSummary
    };
};

export const getHostList = async (): Promise<string[]> => {
    const response = await fetchTestRuns();
    
    if (!response.data) {
        throw new Error('Failed to fetch test runs');
    }
    
    const testRuns = response.data;
    const hostnames = [...new Set(testRuns.map((run: TestRun) => run.hostname).filter(Boolean))] as string[];
    return hostnames.sort();
};