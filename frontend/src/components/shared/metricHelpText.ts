// Plain-language explanations of FIO metrics and parameters, keyed by field name
export const METRIC_HELP: Readonly<Record<string, string>> = {
    iops: 'I/O operations per second. How many read/write requests the storage completes each second. Higher is better; matters most for small random I/O (databases, VMs).',
    bandwidth: 'Throughput in MB/s. How much data moves per second. Higher is better; matters most for large sequential I/O (backups, streaming).',
    avg_latency: 'Average time in milliseconds for one I/O to complete. Lower is better. Averages hide spikes, so also check the percentiles.',
    p70_latency: '70% of all I/Os finished within this time (ms). Lower is better.',
    p90_latency: '90% of all I/Os finished within this time (ms). Lower is better.',
    p95_latency: '95% of all I/Os finished within this time (ms). Common SLA target; shows tail latency that users notice.',
    p99_latency: '99% of all I/Os finished within this time (ms). Worst-case behaviour; high values mean occasional stalls.',
    responsiveness: 'Derived from latency (1 / latency). Higher means the storage answers faster.',
    queue_depth: 'Number of I/Os kept in flight at once (iodepth × jobs). Higher queue depth raises IOPS until the device saturates, then only adds latency.',
    block_size: 'Size of each I/O request. Small blocks (4K) stress IOPS, large blocks (1M) stress bandwidth.',
    saturation: 'The queue depth where IOPS stop growing while latency keeps rising. Beyond this point the device is saturated.',
};
