import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpeedTest } from "@shared/schema";
import { format, startOfMonth, endOfMonth, sub, isWithinInterval, startOfQuarter, endOfQuarter } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PercentileAnalysisProps {
  customerId?: string;
}

type PeriodType = "monthly" | "quarterly";

export default function PercentileAnalysis({ customerId }: PercentileAnalysisProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");

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
        <p className="text-gray-500">No test data available for percentile analysis.</p>
      </div>
    );
  }

  // Calculate 90th percentile
  const calcPercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[index];
  };

  // Group data by period (month or quarter)
  const groupDataByPeriod = (data: SpeedTest[], type: PeriodType) => {
    // Generate periods (last 6 months or quarters)
    interface Period {
      start: Date;
      end: Date;
      label: string;
    }
    
    const periods: Period[] = [];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      if (type === "monthly") {
        const monthStart = startOfMonth(sub(now, { months: i }));
        const monthEnd = endOfMonth(monthStart);
        periods.push({
          start: monthStart,
          end: monthEnd,
          label: format(monthStart, 'MMM yyyy')
        });
      } else {
        const quarterStart = startOfQuarter(sub(now, { months: i * 3 }));
        const quarterEnd = endOfQuarter(quarterStart);
        periods.push({
          start: quarterStart,
          end: quarterEnd,
          label: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`
        });
      }
    }

    // Sort periods from oldest to newest
    periods.reverse();

    // Initialize result array
    const result = periods.map(period => ({
      period: period.label,
      downloadTests: [] as number[],
      uploadTests: [] as number[],
      pingTests: [] as number[],
      jitterTests: [] as number[],
      packetLossTests: [] as number[]
    }));

    // Group tests by period
    data.forEach(test => {
      const testDate = new Date(test.timestamp);
      
      for (let i = 0; i < periods.length; i++) {
        if (isWithinInterval(testDate, { start: periods[i].start, end: periods[i].end })) {
          result[i].downloadTests.push(test.downloadSpeed);
          result[i].uploadTests.push(test.uploadSpeed);
          result[i].pingTests.push(test.ping);
          result[i].jitterTests.push(test.jitter);
          result[i].packetLossTests.push(test.packetLoss);
          break;
        }
      }
    });

    // Calculate percentiles
    return result.map(item => ({
      period: item.period,
      download90: calcPercentile(item.downloadTests, 90),
      upload90: calcPercentile(item.uploadTests, 90),
      ping90: calcPercentile(item.pingTests, 90),
      jitter90: calcPercentile(item.jitterTests, 90),
      packetLoss90: calcPercentile(item.packetLossTests, 90),
      testCount: item.downloadTests.length
    }));
  };

  const monthlyData = groupDataByPeriod(speedTests, "monthly");
  const quarterlyData = groupDataByPeriod(speedTests, "quarterly");
  
  const currentData = periodType === "monthly" ? monthlyData : quarterlyData;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-lg font-semibold">90th Percentile Analysis</h2>
        
        <Tabs value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)} className="mt-2 md:mt-0">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={currentData}
            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ value: 'Speed (Mbps)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === "download90") return [`${value} Mbps`, "Download (90th %ile)"];
                if (name === "upload90") return [`${value} Mbps`, "Upload (90th %ile)"];
                if (name === "ping90") return [`${value} ms`, "Ping (90th %ile)"];
                if (name === "jitter90") return [`${value} ms`, "Jitter (90th %ile)"];
                if (name === "packetLoss90") return [`${value}%`, "Packet Loss (90th %ile)"];
                if (name === "testCount") return [`${value}`, "Test Count"];
                return [value, name];
              }}
            />
            <Legend formatter={(value) => {
              if (value === "download90") return "Download (90th %ile)";
              if (value === "upload90") return "Upload (90th %ile)";
              if (value === "testCount") return "Test Count";
              return value;
            }} />
            <Bar dataKey="download90" name="download90" fill="#3b82f6" />
            <Bar dataKey="upload90" name="upload90" fill="#10b981" />
            <Bar dataKey="testCount" name="testCount" fill="#9ca3af" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Download (90th %ile)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload (90th %ile)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ping (90th %ile)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jitter (90th %ile)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Packet Loss (90th %ile)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test Count
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.period}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.download90.toFixed(1)} Mbps
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.upload90.toFixed(1)} Mbps
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.ping90.toFixed(1)} ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.jitter90.toFixed(1)} ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.packetLoss90.toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.testCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}