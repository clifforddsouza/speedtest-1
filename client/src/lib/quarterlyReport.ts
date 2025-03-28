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
 * Converts an array of speed tests to a quarterly report with percentiles
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
  
  // Group tests by quarter
  const testsByQuarter = new Map<string, SpeedTestWithSnakeCase[]>();
  
  filteredTests.forEach(test => {
    const testDate = new Date(test.timestamp);
    const year = testDate.getFullYear();
    const quarter = Math.floor(testDate.getMonth() / 3) + 1;
    const quarterKey = `${year}-Q${quarter}`; // Format: 2023-Q1
    
    if (!testsByQuarter.has(quarterKey)) {
      testsByQuarter.set(quarterKey, []);
    }
    
    testsByQuarter.get(quarterKey)?.push(test);
  });
  
  // Calculate statistics for each quarter
  const quarterlyStats = Array.from(testsByQuarter.entries()).map(([quarter, quarterTests]) => {
    // Handle both camelCase and snake_case field names
    const downloadSpeeds = quarterTests.map(test => test.downloadSpeed || test.download_speed || 0);
    const uploadSpeeds = quarterTests.map(test => test.uploadSpeed || test.upload_speed || 0);
    const pings = quarterTests.map(test => test.ping || 0);
    const jitters = quarterTests.map(test => test.jitter || 0);
    const packetLosses = quarterTests.map(test => test.packetLoss || test.packet_loss || 0);
    
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
    
    // Format the quarter for display (e.g., "Q1 2023")
    const [year, quarterLabel] = quarter.split('-');
    const quarterDisplay = `${quarterLabel} ${year}`;
    
    return {
      quarter: quarterDisplay,
      testCount: quarterTests.length,
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
  
  // Sort by quarter chronologically
  quarterlyStats.sort((a, b) => {
    // Extract year and quarter number for comparison
    const [aQuarter, aYear] = a.quarter.split(' ');
    const [bQuarter, bYear] = b.quarter.split(' ');
    
    // First compare years
    if (aYear !== bYear) {
      return parseInt(aYear) - parseInt(bYear);
    }
    
    // Then compare quarters within the same year
    const aQuarterNum = parseInt(aQuarter.replace('Q', ''));
    const bQuarterNum = parseInt(bQuarter.replace('Q', ''));
    return aQuarterNum - bQuarterNum;
  });
  
  // Define CSV headers
  const headers = [
    "Quarter",
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
  const rows = quarterlyStats.map(stat => {
    // Helper function to safely format numbers and handle NaN values
    const safeFormat = (value: number, decimals: number = 2): string => {
      return isNaN(value) ? "0.00" : value.toFixed(decimals);
    };
    
    return [
      stat.quarter,
      stat.testCount,
      safeFormat(stat.downloadAvg),
      safeFormat(stat.download80),
      safeFormat(stat.uploadAvg),
      safeFormat(stat.upload80),
      safeFormat(stat.pingAvg),
      safeFormat(stat.ping80),
      safeFormat(stat.jitterAvg),
      safeFormat(stat.jitter80),
      safeFormat(stat.packetLossAvg),
      safeFormat(stat.packetLoss80)
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
  
  // Calculate 80th percentiles for overall data
  const overallDownload80 = calculateOverallPercentile(allDownloadSpeeds, 80);
  const overallUpload80 = calculateOverallPercentile(allUploadSpeeds, 80);
  const overallPing80 = calculateOverallPercentile(allPings, 80);
  const overallJitter80 = calculateOverallPercentile(allJitters, 80);
  const overallPacketLoss80 = calculateOverallPercentile(allPacketLosses, 80);
  
  // Helper function to safely format numbers and handle NaN values
  const safeFormat = (value: number, decimals: number = 2): string => {
    return isNaN(value) ? "0.00" : value.toFixed(decimals);
  };
  
  // Add a blank row and then the 80th percentile summary row for all data
  const summaryRow = [
    "80th PERCENTILE ALL DATA",
    filteredTests.length,
    "",
    safeFormat(overallDownload80),
    "",
    safeFormat(overallUpload80),
    "",
    safeFormat(overallPing80),
    "",
    safeFormat(overallJitter80),
    "",
    safeFormat(overallPacketLoss80)
  ].join(",");
  
  // Combine headers, data rows, blank row, and summary row
  return [headers, ...rows, "", summaryRow].join("\n");
}