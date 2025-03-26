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
  
  // Define CSV headers
  const headers = [
    "ID",
    "Customer ID",
    "Date",
    "Time",
    "Download Speed (Mbps)",
    "Upload Speed (Mbps)",
    "Ping (ms)",
    "Jitter (ms)",
    "Packet Loss (%)",
    "Location",
    "ISP",
    "Server",
    "Notes"
  ].join(",");
  
  // Format each row of data
  const rows = tests.map(test => {
    const timestamp = new Date(test.timestamp);
    
    return [
      test.id,
      test.customerId,
      format(timestamp, "yyyy-MM-dd"),
      format(timestamp, "HH:mm:ss"),
      test.downloadSpeed,
      test.uploadSpeed,
      test.ping,
      test.jitter,
      test.packetLoss,
      test.testLocation || "-",
      test.isp || "-",
      test.server || "-",
      `"${(test.notes || "").replace(/"/g, '""')}"`  // Handle quotes in notes field
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
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[index];
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
      download90: calculatePercentile(downloadSpeeds, 90),
      upload90: calculatePercentile(uploadSpeeds, 90),
      ping90: calculatePercentile(pings, 90),
      jitter90: calculatePercentile(jitters, 90),
      packetLoss90: calculatePercentile(packetLosses, 90)
    },
    tests: tests.map(test => ({
      ...test,
      formattedDate: format(new Date(test.timestamp), "MMM d, yyyy HH:mm:ss")
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