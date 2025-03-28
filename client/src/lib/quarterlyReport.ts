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
  
  // Group tests by quarter - always show all 4 quarters for the current year
  const testsByQuarter = new Map<string, SpeedTestWithSnakeCase[]>();
  const currentYear = new Date().getFullYear();
  
  // Create entries for all 4 quarters of the current year
  for (let quarter = 1; quarter <= 4; quarter++) {
    const quarterKey = `${currentYear}-Q${quarter}`;
    testsByQuarter.set(quarterKey, []);
  }
  
  filteredTests.forEach(test => {
    try {
      // Handle various timestamp formats and null values
      if (!test.timestamp) {
        console.warn('Test is missing timestamp:', test);
        return; // Skip tests without timestamps
      }
      
      // Parse timestamp string safely
      let testDate: Date;
      
      if (typeof test.timestamp === 'string') {
        // Handle ISO format or SQL timestamp format
        testDate = new Date(test.timestamp);
      } else if (typeof test.timestamp === 'number') {
        // Handle unix timestamp (milliseconds)
        testDate = new Date(test.timestamp);
      } else {
        // Handle if timestamp is already a Date
        testDate = test.timestamp instanceof Date ? test.timestamp : new Date();
      }
      
      // Validate the date is valid
      if (isNaN(testDate.getTime())) {
        console.warn('Invalid date from timestamp:', test.timestamp);
        return; // Skip tests with invalid dates
      }
      
      const year = testDate.getFullYear();
      // Only include tests from the current year for the quarterly report
      if (year === currentYear) {
        const quarter = Math.floor(testDate.getMonth() / 3) + 1;
        const quarterKey = `${year}-Q${quarter}`; // Format: 2023-Q1
        
        // The key should always exist since we pre-populated the map
        testsByQuarter.get(quarterKey)?.push(test);
      }
    } catch (error) {
      console.error('Error processing test timestamp:', error, test);
    }
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
  
  // Define CSV headers - consolidated format without separate 80th percentile columns
  const headers = [
    "Quarter",
    "Test Count",
    "Download Speed (Mbps)",
    "Upload Speed (Mbps)",
    "Ping (ms)",
    "Jitter (ms)",
    "Packet Loss (%)"
  ].join(",");
  
  // Format each row with just the averages
  const rows = quarterlyStats.map(stat => {
    // Helper function to safely format numbers and handle NaN, null, or undefined values
    const safeFormat = (value: number | null | undefined, decimals: number = 2): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return "0.00";
      }
      // Handle edge cases like Infinity
      return isFinite(value) ? value.toFixed(decimals) : "0.00";
    };
    
    return [
      stat.quarter,
      stat.testCount,
      safeFormat(stat.downloadAvg),
      safeFormat(stat.uploadAvg),
      safeFormat(stat.pingAvg),
      safeFormat(stat.jitterAvg),
      safeFormat(stat.packetLossAvg)
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
  
  // Helper function to safely format numbers and handle NaN, null, or undefined values
  const safeFormat = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.00";
    }
    // Handle edge cases like Infinity
    return isFinite(value) ? value.toFixed(decimals) : "0.00";
  };
  
  // Add a blank row
  const blankRow = ["", "", "", "", "", "", ""].join(",");
  
  // Add summary section for 80th percentiles
  const summary80thTitle = ["80th PERCENTILE SUMMARY", "", "", "", "", "", ""].join(",");
  
  // Create separate rows for each metric's 80th percentile
  const download80Row = ["Download Speed (Mbps)", filteredTests.length, safeFormat(overallDownload80), "", "", "", ""].join(",");
  const upload80Row = ["Upload Speed (Mbps)", "", safeFormat(overallUpload80), "", "", "", ""].join(",");
  const ping80Row = ["Ping (ms)", "", "", "", safeFormat(overallPing80), "", ""].join(",");
  const jitter80Row = ["Jitter (ms)", "", "", "", "", safeFormat(overallJitter80), ""].join(",");
  const packetLoss80Row = ["Packet Loss (%)", "", "", "", "", "", safeFormat(overallPacketLoss80)].join(",");
  
  // Combine headers, data rows, blank row, and summary rows
  return [
    headers, 
    ...rows, 
    blankRow,
    summary80thTitle,
    download80Row,
    upload80Row,
    ping80Row,
    jitter80Row,
    packetLoss80Row
  ].join("\n");
}