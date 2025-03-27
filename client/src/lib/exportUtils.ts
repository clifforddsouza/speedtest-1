import { SpeedTest } from "@shared/schema";
import { format } from "date-fns";

/**
 * Converts an array of speed test objects to CSV format
 * @param tests Array of SpeedTest objects
 * @returns CSV formatted string
 */
export function convertSpeedTestsToCSV(tests: SpeedTest[]): string {
  if (!tests || tests.length === 0) {
    return "No data to export";
  }
  
  // Define CSV headers based on requested format
  const headers = [
    "Test ID",
    "Customer ID",
    "Internet Plan",
    "Date",
    "Time",
    "Username",
    "Ping Latency",
    "Packetdrop",
    "Download Speed",
    "Upload Speed",
    "Jitter"
  ].join(",");
  
  // Format each row of data
  const rows = tests.map(test => {
    const timestamp = new Date(test.timestamp);
    
    return [
      test.id,
      test.customerId,
      test.internetPlan || "-",
      format(timestamp, "yyyy-MM-dd"),
      format(timestamp, "HH:mm:ss"),
      test.username || "-",
      `${test.ping} ms`,
      `${test.packetLoss}%`,
      `${test.downloadSpeed} Mbps`,
      `${test.uploadSpeed} Mbps`,
      `${test.jitter} ms`
    ].join(",");
  });
  
  // Combine headers and rows
  return [headers, ...rows].join("\n");
}

/**
 * Formats speed test data for PDF report generation
 * @param tests Array of SpeedTest objects
 * @returns Formatted data object for PDF generation
 */
export function formatSpeedTestDataForReport(tests: SpeedTest[], customerId?: string) {
  // Calculate averages
  const downloadSpeeds = tests.map(test => test.downloadSpeed);
  const uploadSpeeds = tests.map(test => test.uploadSpeed);
  const pings = tests.map(test => test.ping);
  const jitters = tests.map(test => test.jitter);
  const packetLosses = tests.map(test => test.packetLoss);
  
  const calculateAverage = (values: number[]) => {
    return values.length > 0 
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };
  
  const calculatePercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    // For Nth percentile, we want the value at which N% of values fall below
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    // Make sure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };
  
  // Find min/max dates
  const dates = tests.map(test => new Date(test.timestamp));
  const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
  
  return {
    customerId: customerId || "All Customers",
    testCount: tests.length,
    dateRange: {
      from: format(minDate, "MMM d, yyyy"),
      to: format(maxDate, "MMM d, yyyy")
    },
    averages: {
      download: calculateAverage(downloadSpeeds),
      upload: calculateAverage(uploadSpeeds),
      ping: calculateAverage(pings),
      jitter: calculateAverage(jitters),
      packetLoss: calculateAverage(packetLosses)
    },
    percentiles: {
      download80: calculatePercentile(downloadSpeeds, 80),
      upload80: calculatePercentile(uploadSpeeds, 80),
      download90: calculatePercentile(downloadSpeeds, 90),
      upload90: calculatePercentile(uploadSpeeds, 90),
      ping80: calculatePercentile(pings, 80),
      ping90: calculatePercentile(pings, 90),
      jitter80: calculatePercentile(jitters, 80),
      jitter90: calculatePercentile(jitters, 90),
      packetLoss80: calculatePercentile(packetLosses, 80),
      packetLoss90: calculatePercentile(packetLosses, 90)
    },
    tests: tests.map(test => ({
      ...test,
      formattedDate: format(new Date(test.timestamp), "MMM d, yyyy HH:mm:ss"),
      username: test.username || "Not recorded" // Ensure username is available in the report
    }))
  };
}

/**
 * Helper function to calculate performance score
 * @param test SpeedTest object
 * @returns Score from 0-100
 */
export function calculatePerformanceScore(test: SpeedTest): number {
  // Formula weighting different factors (adjust as needed)
  const downloadWeight = 0.35;
  const uploadWeight = 0.25;
  const pingWeight = 0.20; 
  const jitterWeight = 0.10;
  const packetLossWeight = 0.10;
  
  // Normalize each value (higher is better, except for ping/jitter/packet loss where lower is better)
  // These thresholds can be adjusted based on your specific needs
  const downloadScore = Math.min(100, (test.downloadSpeed / 100) * 100);
  const uploadScore = Math.min(100, (test.uploadSpeed / 20) * 100);
  
  // For ping, less is better (assume 20ms is perfect, 200ms is terrible)
  const pingScore = Math.max(0, 100 - (test.ping / 2));
  
  // For jitter, less is better (assume 5ms is perfect, 50ms is terrible)
  const jitterScore = Math.max(0, 100 - (test.jitter * 2));
  
  // For packet loss, less is better (0% is perfect, 5% is terrible)
  const packetLossScore = Math.max(0, 100 - (test.packetLoss * 20));
  
  // Calculate weighted average
  const weightedScore = 
    (downloadScore * downloadWeight) +
    (uploadScore * uploadWeight) +
    (pingScore * pingWeight) +
    (jitterScore * jitterWeight) +
    (packetLossScore * packetLossWeight);
  
  return Math.round(weightedScore);
}

/**
 * Helper function to get a performance grade based on score
 * @param score Number between 0-100
 * @returns Letter grade A+ through F
 */
export function getPerformanceGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

/**
 * Converts an array of speed tests to a monthly report with percentiles
 * @param tests Array of SpeedTest objects
 * @param planFilter Optional internet plan name to filter by
 * @returns CSV formatted string with monthly report including 80th percentile values
 */
export function generateMonthlyPercentileReport(tests: SpeedTest[], planFilter?: string): string {
  if (!tests || tests.length === 0) {
    return "No data to export";
  }
  
  // Apply plan filter if provided
  const filteredTests = planFilter 
    ? tests.filter(test => test.internetPlan === planFilter)
    : tests;
    
  if (filteredTests.length === 0) {
    return `No data found for the specified plan: ${planFilter}`;
  }
  
  // Group tests by month
  const testsByMonth = new Map<string, SpeedTest[]>();
  
  filteredTests.forEach(test => {
    const testDate = new Date(test.timestamp);
    const monthKey = format(testDate, "yyyy-MM"); // Format: 2023-01 for January 2023
    
    if (!testsByMonth.has(monthKey)) {
      testsByMonth.set(monthKey, []);
    }
    
    testsByMonth.get(monthKey)?.push(test);
  });
  
  // Calculate statistics for each month
  const monthlyStats = Array.from(testsByMonth.entries()).map(([month, monthTests]) => {
    const downloadSpeeds = monthTests.map(test => test.downloadSpeed);
    const uploadSpeeds = monthTests.map(test => test.uploadSpeed);
    const pings = monthTests.map(test => test.ping);
    const jitters = monthTests.map(test => test.jitter);
    const packetLosses = monthTests.map(test => test.packetLoss);
    
    const calculateAverage = (values: number[]) => {
      return values.length > 0 
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
    };
    
    const calculatePercentile = (values: number[], percentile: number) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      // For Nth percentile, calculate correctly
      const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
      const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
      return sorted[safeIndex];
    };
    
    // Format the month for display (e.g., "January 2023")
    const [year, monthNum] = month.split('-');
    const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthDisplay = format(monthDate, "MMMM yyyy");
    
    return {
      month: monthDisplay,
      testCount: monthTests.length,
      // Calculate averages
      downloadAvg: calculateAverage(downloadSpeeds),
      uploadAvg: calculateAverage(uploadSpeeds),
      pingAvg: calculateAverage(pings),
      jitterAvg: calculateAverage(jitters),
      packetLossAvg: calculateAverage(packetLosses),
      // Calculate 80th percentiles
      download80: calculatePercentile(downloadSpeeds, 80),
      upload80: calculatePercentile(uploadSpeeds, 80),
      ping80: calculatePercentile(pings, 80),
      jitter80: calculatePercentile(jitters, 80),
      packetLoss80: calculatePercentile(packetLosses, 80),
      // Calculate 90th percentiles
      download90: calculatePercentile(downloadSpeeds, 90),
      upload90: calculatePercentile(uploadSpeeds, 90),
      ping90: calculatePercentile(pings, 90),
      jitter90: calculatePercentile(jitters, 90),
      packetLoss90: calculatePercentile(packetLosses, 90)
    };
  });
  
  // Sort by month chronologically
  monthlyStats.sort((a, b) => {
    return new Date(a.month).getTime() - new Date(b.month).getTime();
  });
  
  // Define CSV headers
  const headers = [
    "Month",
    "Test Count",
    "Download Avg (Mbps)",
    "Download 80th (Mbps)",
    "Download 90th (Mbps)",
    "Upload Avg (Mbps)",
    "Upload 80th (Mbps)",
    "Upload 90th (Mbps)",
    "Ping Avg (ms)",
    "Ping 80th (ms)",
    "Ping 90th (ms)",
    "Jitter Avg (ms)",
    "Jitter 80th (ms)",
    "Jitter 90th (ms)",
    "Packet Loss Avg (%)",
    "Packet Loss 80th (%)",
    "Packet Loss 90th (%)"
  ].join(",");
  
  // Format each row
  const rows = monthlyStats.map(stat => {
    return [
      stat.month,
      stat.testCount,
      stat.downloadAvg.toFixed(2),
      stat.download80.toFixed(2),
      stat.download90.toFixed(2),
      stat.uploadAvg.toFixed(2),
      stat.upload80.toFixed(2),
      stat.upload90.toFixed(2),
      stat.pingAvg.toFixed(2),
      stat.ping80.toFixed(2),
      stat.ping90.toFixed(2),
      stat.jitterAvg.toFixed(2),
      stat.jitter80.toFixed(2),
      stat.jitter90.toFixed(2),
      stat.packetLossAvg.toFixed(2),
      stat.packetLoss80.toFixed(2),
      stat.packetLoss90.toFixed(2)
    ].join(",");
  });
  
  // Combine headers and rows
  return [headers, ...rows].join("\n");
}