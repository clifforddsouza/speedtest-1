import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpeedTest } from "@shared/schema";
import { format, subDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BarChart2, LineChart, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";

interface SpeedTestComparisonProps {
  customerId?: string;
}

type ComparisonView = "metric" | "isp" | "location" | "connection";

export default function SpeedTestComparison({ customerId }: SpeedTestComparisonProps) {
  // States for filtering and comparison
  const [comparisonView, setComparisonView] = useState<ComparisonView>("metric");
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");
  const [filterText, setFilterText] = useState("");
  const [filterField, setFilterField] = useState<"customerId" | "testLocation" | "isp">("testLocation");
  const [timeFrame, setTimeFrame] = useState<"all" | "30days" | "90days">("30days");
  
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
        <p className="text-gray-500">No test data available for comparison.</p>
      </div>
    );
  }

  // Filter tests by time frame
  const filteredByTimeTests = speedTests.filter(test => {
    if (timeFrame === "all") return true;
    
    const testDate = new Date(test.timestamp);
    const now = new Date();
    const cutoffDate = timeFrame === "30days" 
      ? subDays(now, 30) 
      : subDays(now, 90);
    
    return testDate >= cutoffDate;
  });
  
  // Filter tests by search text
  const filteredTests = filteredByTimeTests.filter(test => {
    if (!filterText) return true;
    
    const searchText = filterText.toLowerCase();
    switch (filterField) {
      case "customerId":
        return test.customerId.toLowerCase().includes(searchText);
      case "testLocation":
        return (test.testLocation || "").toLowerCase().includes(searchText);
      case "isp":
        return (test.isp || "").toLowerCase().includes(searchText);
      default:
        return true;
    }
  });
  
  // Helper function to prepare comparison data
  const prepareComparisonData = () => {
    switch (comparisonView) {
      case "metric": {
        // Compare averaged metrics across all tests
        return [
          {
            name: "Download Speed",
            value: filteredTests.reduce((sum, test) => sum + test.downloadSpeed, 0) / filteredTests.length,
            fill: "#3b82f6"
          },
          {
            name: "Upload Speed",
            value: filteredTests.reduce((sum, test) => sum + test.uploadSpeed, 0) / filteredTests.length,
            fill: "#10b981"
          },
          {
            name: "Ping",
            value: filteredTests.reduce((sum, test) => sum + test.ping, 0) / filteredTests.length,
            fill: "#f97316",
            isInverted: true
          },
          {
            name: "Jitter",
            value: filteredTests.reduce((sum, test) => sum + test.jitter, 0) / filteredTests.length,
            fill: "#8b5cf6",
            isInverted: true
          },
          {
            name: "Packet Loss",
            value: filteredTests.reduce((sum, test) => sum + test.packetLoss, 0) / filteredTests.length,
            fill: "#ef4444",
            isInverted: true
          }
        ];
      }
      
      case "isp": {
        // Group by ISP and average metrics
        const ispGroups = filteredTests.reduce((groups, test) => {
          const isp = test.isp || "Unknown";
          if (!groups[isp]) {
            groups[isp] = {
              count: 0,
              download: 0,
              upload: 0,
              ping: 0,
              jitter: 0,
              packetLoss: 0
            };
          }
          
          groups[isp].count++;
          groups[isp].download += test.downloadSpeed;
          groups[isp].upload += test.uploadSpeed;
          groups[isp].ping += test.ping;
          groups[isp].jitter += test.jitter;
          groups[isp].packetLoss += test.packetLoss;
          
          return groups;
        }, {} as Record<string, { count: number, download: number, upload: number, ping: number, jitter: number, packetLoss: number }>);
        
        // Calculate averages and format for chart
        return Object.entries(ispGroups)
          .map(([isp, data]) => ({
            name: isp,
            download: data.download / data.count,
            upload: data.upload / data.count,
            ping: data.ping / data.count,
            jitter: data.jitter / data.count,
            packetLoss: data.packetLoss / data.count,
            count: data.count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);  // Top 5 ISPs by test count
      }
      
      case "location": {
        // Group by location and average metrics
        const locationGroups = filteredTests.reduce((groups, test) => {
          const location = test.testLocation || "Unspecified";
          if (!groups[location]) {
            groups[location] = {
              count: 0,
              download: 0,
              upload: 0,
              ping: 0,
              jitter: 0,
              packetLoss: 0
            };
          }
          
          groups[location].count++;
          groups[location].download += test.downloadSpeed;
          groups[location].upload += test.uploadSpeed;
          groups[location].ping += test.ping;
          groups[location].jitter += test.jitter;
          groups[location].packetLoss += test.packetLoss;
          
          return groups;
        }, {} as Record<string, { count: number, download: number, upload: number, ping: number, jitter: number, packetLoss: number }>);
        
        // Calculate averages and format for chart
        return Object.entries(locationGroups)
          .map(([location, data]) => ({
            name: location,
            download: data.download / data.count,
            upload: data.upload / data.count,
            ping: data.ping / data.count,
            jitter: data.jitter / data.count,
            packetLoss: data.packetLoss / data.count,
            count: data.count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);  // Top 5 locations by test count
      }
      
      case "connection": {
        // Split tests into groups by customer ID for comparison
        const customerGroups = filteredTests.reduce((groups, test) => {
          const id = test.customerId;
          if (!groups[id]) {
            groups[id] = {
              count: 0,
              download: 0,
              upload: 0,
              ping: 0,
              jitter: 0,
              packetLoss: 0
            };
          }
          
          groups[id].count++;
          groups[id].download += test.downloadSpeed;
          groups[id].upload += test.uploadSpeed;
          groups[id].ping += test.ping;
          groups[id].jitter += test.jitter;
          groups[id].packetLoss += test.packetLoss;
          
          return groups;
        }, {} as Record<string, { count: number, download: number, upload: number, ping: number, jitter: number, packetLoss: number }>);
        
        // Calculate averages and format for chart
        return Object.entries(customerGroups)
          .map(([id, data]) => ({
            name: `Customer ${id}`,
            download: data.download / data.count,
            upload: data.upload / data.count,
            ping: data.ping / data.count,
            jitter: data.jitter / data.count,
            packetLoss: data.packetLoss / data.count,
            count: data.count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);  // Top 5 customers by test count
      }
      
      default:
        return [];
    }
  };
  
  const comparisonData = prepareComparisonData();
  
  // Normalize data for radar chart (0-100 scale)
  const normalizeForRadar = (data: any[]) => {
    if (comparisonView === "metric") {
      // For metric view, we need special handling
      return data.map(item => {
        let normalized: number;
        
        if (item.name === "Download Speed") {
          // Higher is better, max reference 100 Mbps
          normalized = Math.min(100, (item.value / 100) * 100);
        } else if (item.name === "Upload Speed") {
          // Higher is better, max reference 20 Mbps
          normalized = Math.min(100, (item.value / 20) * 100);
        } else if (item.name === "Ping") {
          // Lower is better, 0-200ms range
          normalized = Math.max(0, 100 - (item.value / 2));
        } else if (item.name === "Jitter") {
          // Lower is better, 0-50ms range
          normalized = Math.max(0, 100 - (item.value * 2));
        } else if (item.name === "Packet Loss") {
          // Lower is better, 0-5% range
          normalized = Math.max(0, 100 - (item.value * 20));
        } else {
          normalized = 50; // default
        }
        
        return {
          ...item,
          value: item.value,
          normalizedValue: normalized
        };
      });
    } else {
      // For other views, handle multiple metrics
      return data.map(item => {
        return {
          ...item,
          // Normalize each metric
          downloadNorm: Math.min(100, (item.download / 100) * 100),
          uploadNorm: Math.min(100, (item.upload / 20) * 100),
          pingNorm: Math.max(0, 100 - (item.ping / 2)),
          jitterNorm: Math.max(0, 100 - (item.jitter * 2)),
          packetLossNorm: Math.max(0, 100 - (item.packetLoss * 20))
        };
      });
    }
  };
  
  const normalizedData = normalizeForRadar(comparisonData);
  
  return (
    <Card className="p-6">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Speed Test Comparison</h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={chartType} onValueChange={(value) => setChartType(value as "bar" | "radar")}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Chart Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar" className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span>Bar Chart</span>
              </SelectItem>
              <SelectItem value="radar" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                <span>Radar Chart</span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={timeFrame} onValueChange={(value) => setTimeFrame(value as "all" | "30days" | "90days")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Comparison View Tabs */}
      <Tabs className="mb-6" value={comparisonView} onValueChange={(value) => setComparisonView(value as ComparisonView)}>
        <TabsList className="mb-4">
          <TabsTrigger value="metric">Metrics</TabsTrigger>
          <TabsTrigger value="isp">ISP</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="connection">Connections</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Filter Controls */}
      {(comparisonView === "isp" || comparisonView === "location" || comparisonView === "connection") && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="filterField" className="mb-2 block">Filter by</Label>
            <Select 
              value={filterField}
              onValueChange={(value) => setFilterField(value as "customerId" | "testLocation" | "isp")}
            >
              <SelectTrigger id="filterField">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customerId">Customer ID</SelectItem>
                <SelectItem value="testLocation">Location</SelectItem>
                <SelectItem value="isp">ISP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[250px]">
            <Label htmlFor="filterText" className="mb-2 block">Search</Label>
            <div className="relative">
              <Input
                id="filterText"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={`Filter by ${filterField === "customerId" ? "customer ID" : filterField === "testLocation" ? "location" : "ISP"}...`}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      )}
      
      {/* Visualization */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={comparisonData}
              margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80} 
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === "download") return [`${Number(value).toFixed(2)} Mbps`, "Download"];
                  if (name === "upload") return [`${Number(value).toFixed(2)} Mbps`, "Upload"];
                  if (name === "ping") return [`${Number(value).toFixed(1)} ms`, "Ping"];
                  if (name === "jitter") return [`${Number(value).toFixed(1)} ms`, "Jitter"];
                  if (name === "packetLoss") return [`${Number(value).toFixed(2)}%`, "Packet Loss"];
                  if (name === "value") {
                    const metricName = (comparisonData[0] as any).name;
                    if (metricName === "Download Speed" || metricName === "Upload Speed") 
                      return [`${Number(value).toFixed(2)} Mbps`, metricName];
                    if (metricName === "Ping" || metricName === "Jitter") 
                      return [`${Number(value).toFixed(1)} ms`, metricName];
                    if (metricName === "Packet Loss") 
                      return [`${Number(value).toFixed(2)}%`, metricName];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              
              {comparisonView === "metric" ? (
                // For metric view
                <Bar dataKey="value" name="Value" fill="#3b82f6" />
              ) : (
                // For other views with multiple metrics
                <>
                  <Bar dataKey="download" name="download" fill="#3b82f6" />
                  <Bar dataKey="upload" name="upload" fill="#10b981" />
                </>
              )}
            </BarChart>
          ) : (
            // Radar Chart
            <RadarChart 
              cx="50%" 
              cy="50%" 
              outerRadius="70%" 
              data={comparisonView === "metric" ? normalizedData : normalizedData}
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis domain={[0, 100]} />
              
              {comparisonView === "metric" ? (
                <Radar
                  name="Performance"
                  dataKey="normalizedValue"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              ) : (
                normalizedData.map((entry, index) => (
                  <Radar
                    key={index}
                    name={entry.name}
                    dataKey="value"
                    stroke={`hsl(${index * 45}, 70%, 50%)`}
                    fill={`hsl(${index * 45}, 70%, 50%)`}
                    fillOpacity={0.5}
                  />
                ))
              )}
              <Tooltip />
              <Legend />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>
      
      {/* Data points count */}
      <div className="mt-4 text-sm text-gray-500">
        Based on {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} 
        {timeFrame !== "all" && ` from the last ${timeFrame === "30days" ? "30 days" : "90 days"}`}
      </div>
    </Card>
  );
}