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
  const { data: speedTests, isLoading } = useQuery({
    queryKey: customerId 
      ? ["/api/speed-tests", customerId] 
      : ["/api/speed-tests"],
    queryFn: async () => {
      const response = await fetch(
        customerId 
          ? `/api/speed-tests?customerId=${encodeURIComponent(customerId)}` 
          : "/api/speed-tests"
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch speed test data");
      }
      
      return response.json() as Promise<SpeedTest[]>;
    }
  });

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

  // Sort data by timestamp (oldest to newest)
  const chartData = [...speedTests]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(test => ({
      ...test,
      timestamp: new Date(test.timestamp),
      formattedDate: format(new Date(test.timestamp), 'MM/dd/yyyy HH:mm')
    }));

  // Calculate 90th percentile for download and upload speeds
  const calcPercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    // For 90th percentile, we want the value at which 90% of values fall below
    // So we need to use ceiling or a different formula to get the correct index
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    // Make sure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };

  const downloadSpeeds = chartData.map(test => test.downloadSpeed);
  const uploadSpeeds = chartData.map(test => test.uploadSpeed);
  const percentile90Download = calcPercentile(downloadSpeeds, 90);
  const percentile90Upload = calcPercentile(uploadSpeeds, 90);

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
              tickFormatter={(value) => format(new Date(value), 'MM/dd')}
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
              y={percentile90Download} 
              yAxisId="left" 
              stroke="#3b82f6" 
              strokeDasharray="3 3" 
              label={{ 
                value: `90th %ile D: ${percentile90Download.toFixed(1)} Mbps`, 
                fill: '#3b82f6',
                position: 'right' 
              }} 
            />
            <ReferenceLine 
              y={percentile90Upload} 
              yAxisId="left" 
              stroke="#10b981" 
              strokeDasharray="3 3" 
              label={{ 
                value: `90th %ile U: ${percentile90Upload.toFixed(1)} Mbps`, 
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