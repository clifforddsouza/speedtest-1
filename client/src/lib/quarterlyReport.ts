import { format } from "date-fns";
import { SpeedTest } from "@shared/schema";

// Interface to handle both snake_case and camelCase fields from the API
interface SpeedTestWithSnakeCase extends SpeedTest {
  customer_id?: string;
  download_speed?: number; 
  upload_speed?: number;
  packet_loss?: number;
  internet_plan?: string;
}

/**
 * Converts an array of speed tests to a quarterly report with detailed test data
 * @param tests Array of SpeedTest objects
 * @param planFilter Optional internet plan name to filter by
 * @returns CSV formatted string with quarterly report including 80th percentile values
 */
export function generateQuarterlyPercentileReport(tests: SpeedTestWithSnakeCase[], planFilter?: string): string {
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
  
  // Sort tests by timestamp (newest first)
  const sortedTests = [...filteredTests].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  // Define CSV headers based on the format in the image
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
  
  // Format each test as a row
  const rows = sortedTests.map(test => {
    const testDate = new Date(test.timestamp);
    
    // Format date and time
    const date = format(testDate, "yy-MM-dd");
    const time = format(testDate, "HH:mm:ss");
    
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
      date,
      time,
      username,
      `${ping} ms`,
      `${packetLoss}%`,
      `${downloadSpeed} Mbps`,
      `${uploadSpeed} Mbps`,
      `${jitter} ms`
    ].join(",");
  });
  
  // Calculate 80th percentile for all metrics
  const calculatePercentile = (values: number[], percentile: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };
  
  // Extract metric values
  const pingValues = sortedTests.map(test => test.ping || 0);
  const packetLossValues = sortedTests.map(test => test.packetLoss || test.packet_loss || 0);
  const downloadValues = sortedTests.map(test => test.downloadSpeed || test.download_speed || 0);
  const uploadValues = sortedTests.map(test => test.uploadSpeed || test.upload_speed || 0);
  const jitterValues = sortedTests.map(test => test.jitter || 0);
  
  // Calculate 80th percentile
  const ping80 = calculatePercentile(pingValues, 80);
  const packetLoss80 = calculatePercentile(packetLossValues, 80);
  const download80 = calculatePercentile(downloadValues, 80);
  const upload80 = calculatePercentile(uploadValues, 80);
  const jitter80 = calculatePercentile(jitterValues, 80);
  
  // Helper function to safely format numbers and handle NaN values
  const safeFormat = (value: number, decimals: number = 2): string => {
    return isNaN(value) || !isFinite(value) ? "0.00" : value.toFixed(decimals);
  };
  
  // Format the 80th percentile summary row
  // Format matches the order in the headers: Test ID,Customer ID,Internet Plan,Date,Time,Username,Ping Latency,Packetdrop,Download Speed,Upload Speed,Jitter
  const percentileRow = [
    "80th PERCENTILE",
    "",
    "",
    "",
    "",
    "",
    `${safeFormat(ping80, 1)} ms`,
    `${safeFormat(packetLoss80, 2)}%`,
    `${safeFormat(download80, 2)} Mbps`,
    `${safeFormat(upload80, 2)} Mbps`,
    `${safeFormat(jitter80, 1)} ms`
  ].join(",");
  
  // Combine headers, data rows, blank row, and percentile row
  return [headers, ...rows, "", percentileRow].join("\n");
}