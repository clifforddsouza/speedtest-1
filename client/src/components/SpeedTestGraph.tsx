import { useQuery } from "@tanstack/react-query";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { SpeedTest } from "@shared/schema";
import { format } from "date-fns";

interface SpeedTestGraphProps {
  customerId?: string;
}

export default function SpeedTestGraph({ customerId }: SpeedTestGraphProps) {
  // Fetch test data
  const { data: response, isLoading } = useQuery({
    queryKey: customerId 
      ? ["/api/speed-tests", customerId] 
      : ["/api/speed-tests"],
    queryFn: async () => {
      const res = await fetch(
        customerId 
          ? `/api/speed-tests?customerId=${encodeURIComponent(customerId)}` 
          : "/api/speed-tests"
      );
      
      if (!res.ok) {
        throw new Error("Failed to fetch speed test data");
      }
      
      return res.json();
    }
  });
  
  // Extract the tests from the paginated response
  const speedTests = response?.data || [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-60 bg-gray-50 rounded-lg">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-opacity-50 border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!speedTests || speedTests.length === 0) {
    return (
      <div className="flex justify-center items-center h-60 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No test data available to display.</p>
      </div>
    );
  }

  // Sort data by timestamp (oldest to newest) and normalize field names
  const chartData = [...speedTests]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(test => {
      // Helper function to safely get field values with different naming conventions
      const getField = <T,>(test: any, camelCase: string, snakeCase: string, defaultValue: T): T => {
        return (test[camelCase] !== undefined && test[camelCase] !== null) 
          ? test[camelCase] 
          : (test[snakeCase] !== undefined && test[snakeCase] !== null)
            ? test[snakeCase]
            : defaultValue;
      };
      
      // Get timestamp and ensure it's a valid date
      const timestamp = new Date(test.timestamp);
      let formattedDate;
      try {
        formattedDate = format(timestamp, 'MM/dd/yyyy HH:mm');
      } catch (e) {
        console.error("Error formatting date:", e);
        formattedDate = "Invalid date";
      }
      
      return {
        ...test,
        // Normalize field names for consistent access
        downloadSpeed: getField(test, 'downloadSpeed', 'download_speed', 0),
        uploadSpeed: getField(test, 'uploadSpeed', 'upload_speed', 0),
        packetLoss: getField(test, 'packetLoss', 'packet_loss', 0),
        customerId: getField(test, 'customerId', 'customer_id', ""),
        internetPlan: getField(test, 'internetPlan', 'internet_plan', ""),
        timestamp: timestamp,
        formattedDate: formattedDate
      };
    });

  // Calculate 80th percentile for download and upload speeds
  const calcPercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    // For 80th percentile, we want the value at which 80% of values fall below
    // So we need to use ceiling or a different formula to get the correct index
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    // Make sure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };

  // Handle both camelCase and snake_case field names
  const downloadSpeeds = chartData.map(test => test.downloadSpeed || test.download_speed || 0);
  const uploadSpeeds = chartData.map(test => test.uploadSpeed || test.upload_speed || 0);
  const percentile80Download = calcPercentile(downloadSpeeds, 80);
  const percentile80Upload = calcPercentile(uploadSpeeds, 80);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Speed Test Trends</h2>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{fontSize: 12}}
              tickFormatter={(value) => {
                try {
                  // Only try to format if value is a valid date string
                  return typeof value === 'string' && !value.includes('Invalid') 
                    ? format(new Date(value), 'MM/dd') 
                    : value;
                } catch (e) {
                  console.error("Error formatting tick date:", e);
                  return value;
                }
              }}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'Speed (Mbps)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              labelFormatter={(value) => `Date: ${value}`}
              formatter={(value, name) => {
                if (name === 'Download') return [`${value} Mbps`, name];
                if (name === 'Upload') return [`${value} Mbps`, name];
                return [value, name];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="downloadSpeed"
              name="Download" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="uploadSpeed"
              name="Upload" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <ReferenceLine 
              y={percentile80Download} 
              yAxisId="left" 
              stroke="#3b82f6" 
              strokeDasharray="3 3" 
              label={{ 
                value: `80th %ile D: ${percentile80Download.toFixed(1)} Mbps`, 
                fill: '#3b82f6',
                position: 'right' 
              }} 
            />
            <ReferenceLine 
              y={percentile80Upload} 
              yAxisId="left" 
              stroke="#10b981" 
              strokeDasharray="3 3" 
              label={{ 
                value: `80th %ile U: ${percentile80Upload.toFixed(1)} Mbps`, 
                fill: '#10b981',
                position: 'right',
                offset: 20
              }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}