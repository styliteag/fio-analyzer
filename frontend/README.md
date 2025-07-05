# FIO Analyzer Frontend

## Enhanced Chart Tooltips

The chart hover tooltips have been significantly enhanced to provide comprehensive information about each data point. When you hover over any chart element, you'll now see detailed information including:

### **Basic Information**
- **Metric Value**: The primary metric (IOPS, Bandwidth, Latency) with proper units
- **Test Pattern**: Read/write pattern (e.g., randread, seqwrite)
- **Protocol**: Storage protocol (e.g., NVMe, SATA, iSCSI)
- **Queue Depth**: I/O queue depth (QD)
- **IO Size**: Block size used for the test
- **Hostname**: Server where the test was run
- **Test Name**: Name of the specific test
- **Drive Type**: Type of storage device (NVMe SSD, SATA SSD, HDD)
- **Timestamp**: When the test was executed

### **Additional Details**
- **Test Duration**: How long the test ran (in seconds)
- **Number of Jobs**: Parallel FIO jobs
- **IO Depth**: I/O depth setting
- **Test Size**: Size of test files/data
- **CPU Usage**: User and system CPU utilization
- **Latency Percentiles**: P95, P99, Min, Max latency values

### **Example Tooltip**
```
IOPS: 1,234 IOPS
Pattern: randread | Protocol: NVMe | QD: 32 | IO Size: 4K | Host: server01 | Type: NVMe SSD | Date: 7/5/2025 11:20:00 AM
Duration: 60s | Jobs: 4 | IO Depth: 32 | Test Size: 10G
Details: P95: 2.45ms, P99: 3.12ms, Min: 0.85ms, Max: 4.23ms, CPU User: 15.2%, CPU Sys: 8.7%
```

### **Implementation Details**

The enhanced tooltips are implemented by:
1. **Data Preservation**: Original `PerformanceData` objects are preserved in chart datasets
2. **Smart Formatting**: Information is only shown when available and relevant
3. **Unit Conversion**: Proper units are applied based on metric type
4. **Conditional Display**: Details are only shown if they differ from what's already in the chart label

### **Supported Chart Types**
- Performance Overview charts
- Block Size Impact charts  
- Read/Write Comparison charts
- IOPS vs Latency Dual-axis charts
- All other chart templates

The tooltips automatically adapt to the available data and only show relevant information for each specific data point. 