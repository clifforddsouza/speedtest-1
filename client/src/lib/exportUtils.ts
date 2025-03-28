import { SpeedTest } from "@shared/schema";
import { format } from "date-fns";

// Interface to handle both snake_case and camelCase fields from the API
// to make TypeScript happy while we deal with the field format inconsistency
interface SpeedTestWithSnakeCase extends SpeedTest {
  customer_id?: string;
  download_speed?: number; 
  upload_speed?: number;
  packet_loss?: number;
  internet_plan?: string;
}

/**
 * Converts an array of speed test objects to CSV format
 * @param tests Array of SpeedTest objects
 * @returns CSV formatted string
 */
export function convertSpeedTestsToCSV(tests: SpeedTestWithSnakeCase[]): string {
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
    const timestamp = new Date(test.timestamp || test.timestamp);
    
    // Handle both camelCase and snake_case field names
    const customerId = test.customerId || test.customer_id || "-";
    const internetPlan = test.internetPlan || test.internet_plan || "-";
    const username = test.username || "-";
    const ping = test.ping || 0;
    const packetLoss = test.packetLoss || test.packet_loss || 0;
    const downloadSpeed = test.downloadSpeed || test.download_speed || 0;
    const uploadSpeed = test.uploadSpeed || test.upload_speed || 0;
    const jitter = test.jitter || 0;
    
    return [
      test.id,
      customerId,
      internetPlan,
      format(timestamp, "yyyy-MM-dd"),
      format(timestamp, "HH:mm:ss"),
      username,
      `${ping} ms`,
      `${packetLoss}%`,
      `${downloadSpeed} Mbps`,
      `${uploadSpeed} Mbps`,
      `${jitter} ms`
    ].join(",");
  });
  
  // Calculate 80th percentile values for metrics
  const calculatePercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };
  
  // Extract values for percentile calculations
  const pingValues = tests.map(test => test.ping || 0);
  const packetLossValues = tests.map(test => test.packetLoss || test.packet_loss || 0);
  const downloadValues = tests.map(test => test.downloadSpeed || test.download_speed || 0);
  const uploadValues = tests.map(test => test.uploadSpeed || test.upload_speed || 0);
  const jitterValues = tests.map(test => test.jitter || 0);
  
  // Calculate 80th percentile
  const ping80 = calculatePercentile(pingValues, 80);
  const packetLoss80 = calculatePercentile(packetLossValues, 80);
  const download80 = calculatePercentile(downloadValues, 80);
  const upload80 = calculatePercentile(uploadValues, 80);
  const jitter80 = calculatePercentile(jitterValues, 80);
  
  // Add a blank row and then the 80th percentile summary row
  const summaryRow = [
    "",
    "80th PERCENTILE",
    "",
    "",
    "",
    "",
    `${ping80.toFixed(1)} ms`,
    `${packetLoss80.toFixed(1)}%`,
    `${download80.toFixed(2)} Mbps`,
    `${upload80.toFixed(2)} Mbps`,
    `${jitter80.toFixed(1)} ms`
  ].join(",");
  
  // Combine headers, data rows, blank row, and summary row
  return [headers, ...rows, "", summaryRow].join("\n");
}

/**
 * Formats speed test data for PDF report generation
 * @param tests Array of SpeedTest objects
 * @returns Formatted data object for PDF generation
 */
export function formatSpeedTestDataForReport(tests: SpeedTestWithSnakeCase[], customerId?: string) {
  // Calculate averages - handle both camelCase and snake_case field names
  const downloadSpeeds = tests.map(test => test.downloadSpeed || test.download_speed || 0);
  const uploadSpeeds = tests.map(test => test.uploadSpeed || test.upload_speed || 0);
  const pings = tests.map(test => test.ping || 0);
  const jitters = tests.map(test => test.jitter || 0);
  const packetLosses = tests.map(test => test.packetLoss || test.packet_loss || 0);
  
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
      ping80: calculatePercentile(pings, 80),
      jitter80: calculatePercentile(jitters, 80),
      packetLoss80: calculatePercentile(packetLosses, 80)
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
export function calculatePerformanceScore(test: SpeedTestWithSnakeCase): number {
  // Formula weighting different factors (adjust as needed)
  const downloadWeight = 0.35;
  const uploadWeight = 0.25;
  const pingWeight = 0.20; 
  const jitterWeight = 0.10;
  const packetLossWeight = 0.10;
  
  // Handle both camelCase and snake_case field names
  const downloadSpeed = test.downloadSpeed || test.download_speed || 0;
  const uploadSpeed = test.uploadSpeed || test.upload_speed || 0;
  const ping = test.ping || 0;
  const jitter = test.jitter || 0;
  const packetLoss = test.packetLoss || test.packet_loss || 0;
  
  // Normalize each value (higher is better, except for ping/jitter/packet loss where lower is better)
  // These thresholds can be adjusted based on your specific needs
  const downloadScore = Math.min(100, (downloadSpeed / 100) * 100);
  const uploadScore = Math.min(100, (uploadSpeed / 20) * 100);
  
  // For ping, less is better (assume 20ms is perfect, 200ms is terrible)
  const pingScore = Math.max(0, 100 - (ping / 2));
  
  // For jitter, less is better (assume 5ms is perfect, 50ms is terrible)
  const jitterScore = Math.max(0, 100 - (jitter * 2));
  
  // For packet loss, less is better (0% is perfect, 5% is terrible)
  const packetLossScore = Math.max(0, 100 - (packetLoss * 20));
  
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
export function generateMonthlyPercentileReport(tests: SpeedTestWithSnakeCase[], planFilter?: string): string {
  if (!tests || tests.length === 0) {
    return "No data to export";
  }
  
  // Apply plan filter if provided - handle both camelCase and snake_case
  const filteredTests = planFilter 
    ? tests.filter(test => (test.internetPlan || test.internet_plan) === planFilter)
    : tests;
    
  if (filteredTests.length === 0) {
    return `No data found for the specified plan: ${planFilter}`;
  }
  
  // Group tests by month
  const testsByMonth = new Map<string, SpeedTestWithSnakeCase[]>();
  
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
    // Handle both camelCase and snake_case field names
    const downloadSpeeds = monthTests.map(test => test.downloadSpeed || test.download_speed || 0);
    const uploadSpeeds = monthTests.map(test => test.uploadSpeed || test.upload_speed || 0);
    const pings = monthTests.map(test => test.ping || 0);
    const jitters = monthTests.map(test => test.jitter || 0);
    const packetLosses = monthTests.map(test => test.packetLoss || test.packet_loss || 0);
    
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
      // Calculate 80th percentiles only
      download80: calculatePercentile(downloadSpeeds, 80),
      upload80: calculatePercentile(uploadSpeeds, 80),
      ping80: calculatePercentile(pings, 80),
      jitter80: calculatePercentile(jitters, 80),
      packetLoss80: calculatePercentile(packetLosses, 80)
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
    "Upload Avg (Mbps)",
    "Upload 80th (Mbps)",
    "Ping Avg (ms)",
    "Ping 80th (ms)",
    "Jitter Avg (ms)",
    "Jitter 80th (ms)",
    "Packet Loss Avg (%)",
    "Packet Loss 80th (%)"
  ].join(",");
  
  // Format each row
  const rows = monthlyStats.map(stat => {
    return [
      stat.month,
      stat.testCount,
      stat.downloadAvg.toFixed(2),
      stat.download80.toFixed(2),
      stat.uploadAvg.toFixed(2),
      stat.upload80.toFixed(2),
      stat.pingAvg.toFixed(2),
      stat.ping80.toFixed(2),
      stat.jitterAvg.toFixed(2),
      stat.jitter80.toFixed(2),
      stat.packetLossAvg.toFixed(2),
      stat.packetLoss80.toFixed(2)
    ].join(",");
  });
  
  // Calculate 80th percentile for all data
  const calculateOverallPercentile = (values: number[], percentile: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };
  
  // Gather all metrics from all tests for overall percentile calculation
  const allDownloadSpeeds = filteredTests.map(test => test.downloadSpeed || test.download_speed || 0);
  const allUploadSpeeds = filteredTests.map(test => test.uploadSpeed || test.upload_speed || 0);
  const allPings = filteredTests.map(test => test.ping || 0);
  const allJitters = filteredTests.map(test => test.jitter || 0);
  const allPacketLosses = filteredTests.map(test => test.packetLoss || test.packet_loss || 0);
  
  // Calculate 80th percentile values for all data
  const download80 = calculateOverallPercentile(allDownloadSpeeds, 80);
  const upload80 = calculateOverallPercentile(allUploadSpeeds, 80);
  const ping80 = calculateOverallPercentile(allPings, 80);
  const jitter80 = calculateOverallPercentile(allJitters, 80);
  const packetLoss80 = calculateOverallPercentile(allPacketLosses, 80);
  
  // Add a blank row and then the 80th percentile summary row for all data
  const summaryRow = [
    "80th PERCENTILE ALL DATA",
    filteredTests.length,
    "",
    download80.toFixed(2),
    "",
    upload80.toFixed(2),
    "",
    ping80.toFixed(2),
    "",
    jitter80.toFixed(2),
    "",
    packetLoss80.toFixed(2)
  ].join(",");
  
  // Combine headers, data rows, blank row, and summary row
  return [headers, ...rows, "", summaryRow].join("\n");
}