import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpeedTest } from "@shared/schema";
import { format, startOfMonth, endOfMonth, sub, isWithinInterval, 
  startOfQuarter, endOfQuarter, add, isBefore, isSameMonth, parse } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Scatter
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Download, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { convertSpeedTestsToCSV } from "../lib/exportUtils";

interface AdvancedAnalyticsProps {
  customerId?: string;
  adminView?: boolean;
}

type AnalysisMetric = "download" | "upload" | "ping" | "jitter" | "packetLoss";
type AnalysisView = "trend" | "comparison" | "distribution";
type TimeRangeType = "all" | "30days" | "90days" | "6months" | "1year" | "custom";
type ChartType = "line" | "bar" | "area" | "scatter";

export default function AdvancedAnalytics({ customerId, adminView = false }: AdvancedAnalyticsProps) {
  // Visualization state
  const [analysisMetric, setAnalysisMetric] = useState<AnalysisMetric>("download");
  const [analysisView, setAnalysisView] = useState<AnalysisView>("trend");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [timeRange, setTimeRange] = useState<TimeRangeType>("30days");
  const [compareWithPrevious, setCompareWithPrevious] = useState<boolean>(false);
  
  // Date range state
  const [startDate, setStartDate] = useState<Date | undefined>(sub(new Date(), { days: 30 }));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  
  // Aggregation options
  const [aggregationMethod, setAggregationMethod] = useState<"daily" | "weekly" | "monthly">("daily");
  
  // Fetch test data with pagination support
  const { data: speedTestsResponse, isLoading } = useQuery({
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
      
      return response.json();
    }
  });
  
  // Extract actual tests array from the paginated response
  const speedTests = speedTestsResponse?.data || [];

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
        <p className="text-gray-500">No test data available for analysis.</p>
      </div>
    );
  }

  // Calculate date range based on selected time range
  const getDateRangeFromSelection = (): [Date, Date] => {
    const now = new Date();
    
    switch (timeRange) {
      case "30days":
        return [sub(now, { days: 30 }), now];
      case "90days":
        return [sub(now, { days: 90 }), now];
      case "6months":
        return [sub(now, { months: 6 }), now];
      case "1year":
        return [sub(now, { years: 1 }), now];
      case "custom":
        return [startDate || sub(now, { days: 30 }), endDate || now];
      case "all":
      default:
        // For "all", find min and max dates in the data
        const dates = speedTests.map((test: SpeedTest) => new Date(test.timestamp));
        const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
        return [minDate, now];
    }
  };

  // Filter tests by date range
  const [rangeStart, rangeEnd] = getDateRangeFromSelection();
  
  const filteredTests = speedTests.filter((test: SpeedTest) => {
    const testDate = new Date(test.timestamp);
    return testDate >= rangeStart && testDate <= rangeEnd;
  }).sort((a: SpeedTest, b: SpeedTest) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Helper functions for data analysis
  const calcPercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    // For 80th percentile, we want the value at which 90% of values fall below
    // So we need to use ceiling or a different formula to get the correct index
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    // Make sure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
  };

  const getMetricValue = (test: SpeedTest, metric: AnalysisMetric): number => {
    switch (metric) {
      case "download": return test.downloadSpeed;
      case "upload": return test.uploadSpeed;
      case "ping": return test.ping;
      case "jitter": return test.jitter;
      case "packetLoss": return test.packetLoss;
    }
  };

  const getMetricLabel = (metric: AnalysisMetric): string => {
    switch (metric) {
      case "download": return "Download Speed (Mbps)";
      case "upload": return "Upload Speed (Mbps)";
      case "ping": return "Ping (ms)";
      case "jitter": return "Jitter (ms)";
      case "packetLoss": return "Packet Loss (%)";
    }
  };

  const getMetricColor = (metric: AnalysisMetric): string => {
    switch (metric) {
      case "download": return "#3b82f6"; // blue
      case "upload": return "#10b981"; // green
      case "ping": return "#f97316"; // orange
      case "jitter": return "#8b5cf6"; // purple
      case "packetLoss": return "#ef4444"; // red
    }
  };

  // Data aggregation by time period
  const aggregateData = (data: SpeedTest[], method: "daily" | "weekly" | "monthly") => {
    const aggregated = new Map<string, { 
      date: Date, 
      values: number[], 
      avg: number,
      min: number,
      max: number,
      median: number,
      p80: number,
      count: number,
      compareValues?: number[],
      compareAvg?: number,
      compareDiff?: number
    }>();
    
    data.forEach(test => {
      const testDate = new Date(test.timestamp);
      let key: string;
      
      switch (method) {
        case "weekly":
          // Get the start of the week (Sunday)
          const startOfWeek = new Date(testDate);
          startOfWeek.setDate(testDate.getDate() - testDate.getDay());
          key = format(startOfWeek, 'yyyy-MM-dd');
          break;
        case "monthly":
          key = format(testDate, 'yyyy-MM');
          break;
        case "daily":
        default:
          key = format(testDate, 'yyyy-MM-dd');
          break;
      }
      
      const metricValue = getMetricValue(test, analysisMetric);
      
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.values.push(metricValue);
      } else {
        aggregated.set(key, { 
          date: testDate, 
          values: [metricValue],
          avg: 0,
          min: 0,
          max: 0,
          median: 0,
          p80: 0,
          count: 1
        });
      }
    });
    
    // Calculate statistics for each aggregated entry
    for (const [key, entry] of aggregated.entries()) {
      const values = entry.values;
      if (values.length > 0) {
        entry.avg = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
        entry.min = Math.min(...values);
        entry.max = Math.max(...values);
        entry.median = calcPercentile(values, 50);
        entry.p80 = calcPercentile(values, 80);
        entry.count = values.length;
      }
    }
    
    // Convert Map to array and sort by date
    return Array.from(aggregated.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(entry => {
        const formattedDate = method === "monthly" 
          ? format(entry.date, 'MMM yyyy')
          : method === "weekly"
            ? `Week of ${format(entry.date, 'MMM d')}`
            : format(entry.date, 'MMM d');
        
        return {
          date: formattedDate,
          rawDate: entry.date,
          [analysisMetric]: entry.avg,
          [`${analysisMetric}Min`]: entry.min,
          [`${analysisMetric}Max`]: entry.max,
          [`${analysisMetric}Median`]: entry.median,
          [`${analysisMetric}80th`]: entry.p80,
          count: entry.count
        };
      });
  };

  // Process data for comparison with previous period
  const processDataForComparison = (data: SpeedTest[]) => {
    // Calculate the previous time range
    const rangeDuration = rangeEnd.getTime() - rangeStart.getTime();
    const previousRangeStart = new Date(rangeStart.getTime() - rangeDuration);
    const previousRangeEnd = new Date(rangeEnd.getTime() - rangeDuration);
    
    // Get data from previous period
    const previousPeriodTests = speedTests.filter((test: SpeedTest) => {
      const testDate = new Date(test.timestamp);
      return testDate >= previousRangeStart && testDate <= previousRangeEnd;
    });
    
    // Aggregate current period data
    const currentData = aggregateData(data, aggregationMethod);
    
    // Aggregate previous period data
    const previousData = aggregateData(previousPeriodTests, aggregationMethod);
    
    // Combine into comparison data
    return currentData.map(current => {
      // Find the corresponding previous period entry (approximate by position)
      const currentIndex = currentData.indexOf(current);
      const relativeIndex = Math.min(currentIndex, previousData.length - 1);
      const previous = previousData[relativeIndex];
      
      const currentVal = current[analysisMetric] as number;
      const previousVal = previous ? (previous[analysisMetric] as number) : 0;
      
      return {
        ...current,
        [`${analysisMetric}Previous`]: previous ? previousVal : null,
        [`${analysisMetric}Change`]: previous ? currentVal - previousVal : null,
        [`${analysisMetric}ChangePercent`]: previous && previousVal !== 0 
          ? ((currentVal - previousVal) / previousVal * 100)
          : null
      };
    });
  };

  // Prepare chart data based on selected view
  const getChartData = () => {
    if (compareWithPrevious && analysisView === "comparison") {
      return processDataForComparison(filteredTests);
    }
    
    return aggregateData(filteredTests, aggregationMethod);
  };

  const chartData = getChartData();

  // Stats for summary
  const metricValues = filteredTests.map((test: SpeedTest) => getMetricValue(test, analysisMetric));
  const avgValue = metricValues.length > 0 
    ? metricValues.reduce((sum: number, val: number) => sum + val, 0) / metricValues.length 
    : 0;
  const minValue = metricValues.length > 0 ? Math.min(...metricValues) : 0;
  const maxValue = metricValues.length > 0 ? Math.max(...metricValues) : 0;
  const medianValue = calcPercentile(metricValues, 50);
  const p80Value = calcPercentile(metricValues, 80);
  
  // Calculate trend (simple: are the last 3 data points trending up or down)
  const trendData = chartData.slice(-3);
  let trendDirection = "steady";
  if (trendData.length === 3 && 
      trendData[0] && trendData[2] && 
      trendData[0][analysisMetric] !== undefined && 
      trendData[2][analysisMetric] !== undefined) {
    const firstValue = trendData[0][analysisMetric] || 0;
    const lastValue = trendData[2][analysisMetric] || 0;
    if (lastValue > firstValue) {
      trendDirection = "up";
    } else if (lastValue < firstValue) {
      trendDirection = "down";
    }
  }
  
  // Function to handle exporting data
  const handleExportData = () => {
    // Format filtered tests to CSV and download
    const csv = convertSpeedTestsToCSV(filteredTests);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Create filename with date range
    const fromDate = format(rangeStart, 'yyyy-MM-dd');
    const toDate = format(rangeEnd, 'yyyy-MM-dd');
    const customerId_ = customerId || 'all-customers';
    link.setAttribute("download", `speedtest-data-${customerId_}-${fromDate}-to-${toDate}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format the date for display in the popover
  const formatDateDisplay = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "MMM d, yyyy");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Advanced Performance Analytics</h2>
          
          <div className="flex flex-wrap gap-3">
            {/* Export button */}
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </div>
        </div>
        
        {/* Analysis Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="analysisMetric">Metric</Label>
            <Select 
              value={analysisMetric} 
              onValueChange={(value) => setAnalysisMetric(value as AnalysisMetric)}
            >
              <SelectTrigger id="analysisMetric">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="download">Download Speed</SelectItem>
                <SelectItem value="upload">Upload Speed</SelectItem>
                <SelectItem value="ping">Ping</SelectItem>
                <SelectItem value="jitter">Jitter</SelectItem>
                <SelectItem value="packetLoss">Packet Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="analysisView">View</Label>
            <Select 
              value={analysisView} 
              onValueChange={(value) => setAnalysisView(value as AnalysisView)}
            >
              <SelectTrigger id="analysisView">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trend">Trend Analysis</SelectItem>
                <SelectItem value="comparison">Period Comparison</SelectItem>
                <SelectItem value="distribution">Distribution Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timeRange">Time Range</Label>
            <Select 
              value={timeRange} 
              onValueChange={(value) => setTimeRange(value as TimeRangeType)}
            >
              <SelectTrigger id="timeRange">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="aggregation">Data Grouping</Label>
            <Select 
              value={aggregationMethod} 
              onValueChange={(value) => setAggregationMethod(value as "daily" | "weekly" | "monthly")}
            >
              <SelectTrigger id="aggregation">
                <SelectValue placeholder="Select aggregation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Custom date range selector */}
        {timeRange === "custom" && (
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="space-y-2">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? formatDateDisplay(startDate) : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? formatDateDisplay(endDate) : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
        
        {/* Additional options for comparison view */}
        {analysisView === "comparison" && (
          <div className="flex items-center gap-2 mb-6">
            <input
              type="checkbox"
              id="compareWithPrevious"
              checked={compareWithPrevious}
              onChange={() => setCompareWithPrevious(!compareWithPrevious)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="compareWithPrevious">
              Compare with previous period
            </Label>
          </div>
        )}
        
        {/* Key statistics summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Average</div>
            <div className="text-xl font-semibold">{avgValue !== undefined && !isNaN(avgValue) ? avgValue.toFixed(2) : 'N/A'}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Median</div>
            <div className="text-xl font-semibold">{medianValue !== undefined && !isNaN(medianValue) ? medianValue.toFixed(2) : 'N/A'}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">80th %ile</div>
            <div className="text-xl font-semibold">{p80Value !== undefined && !isNaN(p80Value) ? p80Value.toFixed(2) : 'N/A'}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Min / Max</div>
            <div className="text-xl font-semibold">
              {minValue !== undefined && !isNaN(minValue) ? minValue.toFixed(2) : 'N/A'} / 
              {maxValue !== undefined && !isNaN(maxValue) ? maxValue.toFixed(2) : 'N/A'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Trend</div>
            <div className="text-xl font-semibold flex items-center">
              {trendDirection === "up" && <span className="text-green-500">↑ Improving</span>}
              {trendDirection === "down" && <span className="text-red-500">↓ Declining</span>}
              {trendDirection === "steady" && <span className="text-yellow-500">→ Steady</span>}
            </div>
          </div>
        </div>
        
        {/* Main Chart Area */}
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {analysisView === "trend" ? (
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  label={{ 
                    value: getMetricLabel(analysisMetric), 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), getMetricLabel(analysisMetric)]} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={analysisMetric}
                  name={getMetricLabel(analysisMetric)}
                  stroke={getMetricColor(analysisMetric)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {avgValue !== undefined && !isNaN(avgValue) && (
                  <ReferenceLine
                    y={avgValue}
                    stroke="#666"
                    strokeDasharray="3 3"
                    label={{ 
                      value: `Avg: ${avgValue.toFixed(2)}`, 
                      position: 'right'
                    }}
                  />
                )}
                {p80Value !== undefined && !isNaN(p80Value) && (
                  <ReferenceLine
                    y={p80Value}
                    stroke="#333"
                    strokeDasharray="3 3"
                    label={{ 
                      value: `80th %ile: ${p80Value.toFixed(2)}`, 
                      position: 'right',
                      offset: 20
                    }}
                  />
                )}
              </LineChart>
            ) : analysisView === "comparison" ? (
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  label={{ 
                    value: getMetricLabel(analysisMetric), 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                {compareWithPrevious && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ 
                      value: 'Change %', 
                      angle: 90, 
                      position: 'insideRight' 
                    }}
                  />
                )}
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === analysisMetric) {
                      return [Number(value).toFixed(2), getMetricLabel(analysisMetric)];
                    }
                    if (name === `${analysisMetric}Previous`) {
                      return [Number(value).toFixed(2), `Previous ${getMetricLabel(analysisMetric)}`];
                    }
                    if (name === `${analysisMetric}ChangePercent`) {
                      return [Number(value).toFixed(2) + '%', 'Change %'];
                    }
                    return [value, name];
                  }}
                />
                <Legend formatter={(value) => {
                  if (value === analysisMetric) return getMetricLabel(analysisMetric);
                  if (value === `${analysisMetric}Previous`) return `Previous ${getMetricLabel(analysisMetric)}`;
                  if (value === `${analysisMetric}ChangePercent`) return 'Change %';
                  return value;
                }} />
                <Bar
                  dataKey={analysisMetric}
                  name={analysisMetric}
                  yAxisId="left"
                  fill={getMetricColor(analysisMetric)}
                  barSize={20}
                />
                {compareWithPrevious && (
                  <>
                    <Bar
                      dataKey={`${analysisMetric}Previous`}
                      name={`${analysisMetric}Previous`}
                      yAxisId="left"
                      fill={getMetricColor(analysisMetric) + '80'}
                      barSize={20}
                    />
                    <Line
                      type="monotone"
                      dataKey={`${analysisMetric}ChangePercent`}
                      name={`${analysisMetric}ChangePercent`}
                      yAxisId="right"
                      stroke="#ff7300"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </>
                )}
                <ReferenceLine
                  y={0}
                  yAxisId="right"
                  stroke="#666"
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            ) : (
              // Distribution view - show a scatter plot
              <ComposedChart
                data={filteredTests.map((test: SpeedTest) => ({
                  timestamp: format(new Date(test.timestamp), 'yyyy-MM-dd'),
                  [analysisMetric]: getMetricValue(test, analysisMetric),
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  label={{ 
                    value: getMetricLabel(analysisMetric), 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), getMetricLabel(analysisMetric)]} />
                <Legend />
                <Scatter
                  name={getMetricLabel(analysisMetric)}
                  data={filteredTests.map((test: SpeedTest) => ({
                    timestamp: format(new Date(test.timestamp), 'yyyy-MM-dd'),
                    [analysisMetric]: getMetricValue(test, analysisMetric),
                  }))}
                  fill={getMetricColor(analysisMetric)}
                />
                {avgValue !== undefined && !isNaN(avgValue) && (
                  <ReferenceLine
                    y={avgValue}
                    stroke="#666"
                    strokeDasharray="3 3"
                    label={{ 
                      value: `Avg: ${avgValue.toFixed(2)}`, 
                      position: 'right'
                    }}
                  />
                )}
                {p80Value !== undefined && !isNaN(p80Value) && (
                  <ReferenceLine
                    y={p80Value}
                    stroke="#333"
                    strokeDasharray="3 3"
                    label={{ 
                      value: `80th %ile: ${p80Value.toFixed(2)}`, 
                      position: 'right',
                      offset: 20
                    }}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
        
        {/* Test count info */}
        <div className="mt-6 text-sm text-gray-500 text-right">
          Analysis based on {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} from {format(rangeStart, 'MMM d, yyyy')} to {format(rangeEnd, 'MMM d, yyyy')}
        </div>
      </Card>
    </div>
  );
}