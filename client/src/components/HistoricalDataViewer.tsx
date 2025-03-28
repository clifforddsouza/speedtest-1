import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, FileDown, Filter } from "lucide-react";
import { SpeedTest } from "@shared/schema";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { convertSpeedTestsToCSV } from "@/lib/exportUtils";

// Interface to handle both snake_case and camelCase fields from the API
interface SpeedTestWithSnakeCase extends SpeedTest {
  customer_id?: string;
  download_speed?: number; 
  upload_speed?: number;
  packet_loss?: number;
  internet_plan?: string;
}
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Scatter,
  ScatterChart,
  ZAxis,
  ReferenceLine,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

interface HistoricalDataViewerProps {
  customerId?: string;
  adminView?: boolean;
}

type Metric = "download" | "upload" | "ping" | "jitter" | "packetLoss";
type ChartType = "line" | "bar" | "area" | "scatter";
type TimeRange = "1w" | "1m" | "3m" | "6m" | "1y" | "all" | "custom";

export default function HistoricalDataViewer({ customerId, adminView = false }: HistoricalDataViewerProps) {
  // States for filters and visualization options
  const [selectedMetric, setSelectedMetric] = useState<Metric>("download");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [timeRange, setTimeRange] = useState<TimeRange>("3m");
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [showAverage, setShowAverage] = useState<boolean>(true);
  const [showTrend, setShowTrend] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [sortMetric, setSortMetric] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [secondaryMetric, setSecondaryMetric] = useState<Metric | null>(null);
  
  const { toast } = useToast();

  // States for pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch test data with pagination
  const { data: speedTestsResponse, isLoading } = useQuery({
    queryKey: ["/api/speed-tests", customerId, page, limit],
    queryFn: async () => {
      const endpoint = customerId 
        ? `/api/speed-tests?customerId=${encodeURIComponent(customerId)}&page=${page}&limit=${limit}`
        : `/api/speed-tests?page=${page}&limit=${limit}`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch speed test data");
      }
      
      const data = await response.json();
      return data;
    }
  });
  
  // Extract the data and pagination info
  const speedTests = speedTestsResponse?.data || [];
  
  // Update pagination state from the response
  useEffect(() => {
    if (speedTestsResponse?.pagination) {
      setTotalPages(speedTestsResponse.pagination.totalPages || 1);
      setTotalCount(speedTestsResponse.pagination.totalCount || 0);
    }
  }, [speedTestsResponse]);

  // Update date range when time range changes
  useEffect(() => {
    if (timeRange === "custom") return;
    
    const now = new Date();
    let start = now;
    
    switch(timeRange) {
      case "1w":
        start = subMonths(now, 0.25);
        break;
      case "1m":
        start = subMonths(now, 1);
        break;
      case "3m":
        start = subMonths(now, 3);
        break;
      case "6m":
        start = subMonths(now, 6);
        break;
      case "1y":
        start = subMonths(now, 12);
        break;
      case "all":
        start = new Date(0); // Beginning of time for all data
        break;
    }
    
    setStartDate(start);
    setEndDate(now);
  }, [timeRange]);

  // Helper function to filter data by date range
  const filterDataByDateRange = (data: SpeedTestWithSnakeCase[]) => {
    if (!startDate || !endDate) return data;
    
    return data.filter(test => {
      const testDate = new Date(test.timestamp);
      return isWithinInterval(testDate, { 
        start: startOfMonth(startDate), 
        end: endOfMonth(endDate) 
      });
    });
  };

  // Process and format data for visualization
  const getProcessedData = () => {
    if (!speedTests) return [];
    
    let filteredData = filterDataByDateRange(speedTests);
    
    // Sort data
    filteredData = [...filteredData].sort((a, b) => {
      if (sortMetric === "date") {
        return sortDirection === "asc" 
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      
      // For other metrics
      const aValue = a[sortMetric as keyof SpeedTest] as number;
      const bValue = b[sortMetric as keyof SpeedTest] as number;
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
    
    // Group data by selected time period if necessary
    if (groupBy !== "day") {
      // Group implementation would go here
      // For now, just return the filtered data
    }
    
    // Transform data for chart visualization
    return filteredData.map(test => {
      const timestamp = new Date(test.timestamp);
      
      // Helper function to safely get field values, accounting for different naming conventions
      const getField = <T,>(test: any, camelCase: string, snakeCase: string, defaultValue: T): T => {
        return (test[camelCase] !== undefined && test[camelCase] !== null) 
          ? test[camelCase] 
          : (test[snakeCase] !== undefined && test[snakeCase] !== null)
            ? test[snakeCase]
            : defaultValue;
      };
      
      // Handle both camelCase and snake_case formats for field names
      const downloadSpeed = getField(test, 'downloadSpeed', 'download_speed', 0);
      const uploadSpeed = getField(test, 'uploadSpeed', 'upload_speed', 0);
      const packetLoss = getField(test, 'packetLoss', 'packet_loss', 0);
      const customerId = getField(test, 'customerId', 'customer_id', '');
      const ping = getField(test, 'ping', 'ping', 0);
      const jitter = getField(test, 'jitter', 'jitter', 0);
      const testLocation = getField(test, 'testLocation', 'test_location', null);
      
      return {
        date: format(timestamp, "yyyy-MM-dd"),
        time: format(timestamp, "HH:mm"),
        formattedDate: format(timestamp, "MMM dd, yyyy"),
        timestamp: timestamp.getTime(),
        download: downloadSpeed,
        upload: uploadSpeed,
        ping: ping,
        jitter: jitter,
        packetLoss: packetLoss,
        location: testLocation,
        customerId: customerId,
      };
    });
  };

  // Calculate average, min, max values for the selected metric
  const calculateStats = (data: any[], metricName: string) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { avg: 0, min: 0, max: 0 };
    }
    
    try {
      // Filter out entries where the metric is undefined or not a number
      const filteredData = data.filter(d => 
        d && typeof d[metricName] === 'number' && !isNaN(d[metricName])
      );
      
      if (filteredData.length === 0) {
        return { avg: 0, min: 0, max: 0 };
      }
      
      const values = filteredData.map(d => d[metricName]);
      const sum = values.reduce((acc, val) => acc + val, 0);
      
      return {
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { avg: 0, min: 0, max: 0 };
    }
  };

  // Calculate trendline
  const calculateTrendline = (data: any[], metric: string) => {
    if (!data.length) return { slope: 0, intercept: 0 };
    
    // Convert dates to numeric values (days since first data point)
    const firstDate = data[0].timestamp;
    const xValues = data.map(d => (d.timestamp - firstDate) / (1000 * 60 * 60 * 24)); // Days
    const yValues = data.map(d => d[metric]);
    
    // Calculate mean of x and y
    const xMean = xValues.reduce((sum, val) => sum + val, 0) / xValues.length;
    const yMean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length;
    
    // Calculate slope (m) and y-intercept (b) for line y = mx + b
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < xValues.length; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = denominator ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    
    // Generate points for trendline
    return { slope, intercept };
  };

  // Calculate trend data points
  const getTrendData = (data: any[], metric: string) => {
    if (!data.length || !showTrend) return [];
    
    const { slope, intercept } = calculateTrendline(data, metric);
    const firstDate = data[0].timestamp;
    
    return data.map(d => {
      const daysSinceStart = (d.timestamp - firstDate) / (1000 * 60 * 60 * 24);
      return {
        ...d,
        [`${metric}Trend`]: slope * daysSinceStart + intercept
      };
    });
  };

  // Format tooltip content
  const formatTooltip = (value: number, name: string) => {
    if (!value && value !== 0) return ["N/A", name];
    
    switch (name) {
      case "download":
      case "downloadTrend":
      case "upload":
      case "uploadTrend":
        return [`${value.toFixed(2)} Mbps`, name === "downloadTrend" || name === "uploadTrend" ? "Trend" : name];
      case "ping":
      case "pingTrend":
      case "jitter":
      case "jitterTrend":
        return [`${value.toFixed(1)} ms`, name === "pingTrend" || name === "jitterTrend" ? "Trend" : name];
      case "packetLoss":
      case "packetLossTrend":
        return [`${value.toFixed(2)}%`, name === "packetLossTrend" ? "Trend" : name];
      default:
        return [value.toString(), name];
    }
  };

  // Get color for metric
  const getMetricColor = (metric: Metric) => {
    switch (metric) {
      case "download": return "#3b82f6"; // blue
      case "upload": return "#10b981";   // green
      case "ping": return "#f97316";     // orange
      case "jitter": return "#8b5cf6";   // purple
      case "packetLoss": return "#ef4444"; // red
    }
  };

  // Get label for metric
  const getMetricLabel = (metric: Metric) => {
    switch (metric) {
      case "download": return "Download Speed (Mbps)";
      case "upload": return "Upload Speed (Mbps)";
      case "ping": return "Ping (ms)";
      case "jitter": return "Jitter (ms)";
      case "packetLoss": return "Packet Loss (%)";
    }
  };

  const data = getProcessedData();
  const trendData = getTrendData(data, selectedMetric);
  const stats = calculateStats(data, selectedMetric);
  
  // Handle export data
  const handleExportData = () => {
    if (!speedTests || speedTests.length === 0) {
      toast({
        title: "Export Failed",
        description: "No data to export",
        variant: "destructive"
      });
      return;
    }
    
    const filteredData = filterDataByDateRange(speedTests);
    const csvContent = convertSpeedTestsToCSV(filteredData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Create descriptive filename
    const customer = customerId || 'all-customers';
    const dateFrom = startDate ? format(startDate, 'yyyy-MM-dd') : 'all-time';
    const dateTo = endDate ? format(endDate, 'yyyy-MM-dd') : 'now';
    
    link.setAttribute('href', url);
    link.setAttribute('download', `historical-data-${customer}-${dateFrom}-to-${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Successful",
      description: `${filteredData.length} records exported to CSV`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-opacity-50 border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!speedTests || speedTests.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No Historical Data Available</h2>
          <p className="text-gray-500 mb-4">There are no speed tests available for the selected criteria.</p>
          {adminView && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => window.location.href = "/"}>
                Run a Speed Test
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Historical Performance Data</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFiltersVisible(!isFiltersVisible)}
            className="flex items-center"
          >
            <Filter className="h-4 w-4 mr-1" />
            {isFiltersVisible ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="flex items-center"
          >
            <FileDown className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {isFiltersVisible && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metric">Metric</Label>
              <Select
                value={selectedMetric}
                onValueChange={(value) => setSelectedMetric(value as Metric)}
              >
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select a metric" />
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
              <Label htmlFor="chartType">Chart Type</Label>
              <Select
                value={chartType}
                onValueChange={(value) => setChartType(value as ChartType)}
              >
                <SelectTrigger id="chartType">
                  <SelectValue placeholder="Select a chart type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="scatter">Scatter Plot</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as TimeRange)}
              >
                <SelectTrigger id="timeRange">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1w">Last Week</SelectItem>
                  <SelectItem value="1m">Last Month</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeRange === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date-from"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
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
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date-to"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="sort">Sort By</Label>
              <div className="flex space-x-2">
                <Select
                  value={sortMetric}
                  onValueChange={setSortMetric}
                >
                  <SelectTrigger id="sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="downloadSpeed">Download</SelectItem>
                    <SelectItem value="uploadSpeed">Upload</SelectItem>
                    <SelectItem value="ping">Ping</SelectItem>
                    <SelectItem value="jitter">Jitter</SelectItem>
                    <SelectItem value="packetLoss">Packet Loss</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                >
                  {sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Analysis Options</Label>
              <div className="flex items-center space-x-2">
                <Switch id="showAverage" checked={showAverage} onCheckedChange={setShowAverage} />
                <Label htmlFor="showAverage" className="cursor-pointer">Show Average</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="showTrend" checked={showTrend} onCheckedChange={setShowTrend} />
                <Label htmlFor="showTrend" className="cursor-pointer">Show Trend</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comparison</Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="comparisonMode" 
                  checked={comparisonMode} 
                  onCheckedChange={setComparisonMode} 
                />
                <Label htmlFor="comparisonMode" className="cursor-pointer">Enable Comparison</Label>
              </div>
              {comparisonMode && (
                <Select
                  value={secondaryMetric || ""}
                  onValueChange={(value) => setSecondaryMetric(value as Metric || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select secondary metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="download">Download Speed</SelectItem>
                    <SelectItem value="upload">Upload Speed</SelectItem>
                    <SelectItem value="ping">Ping</SelectItem>
                    <SelectItem value="jitter">Jitter</SelectItem>
                    <SelectItem value="packetLoss">Packet Loss</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Average {getMetricLabel(selectedMetric)}</h3>
            <p className="text-2xl font-bold">{stats.avg.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Minimum {getMetricLabel(selectedMetric)}</h3>
            <p className="text-2xl font-bold">{stats.min.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Maximum {getMetricLabel(selectedMetric)}</h3>
            <p className="text-2xl font-bold">{stats.max.toFixed(2)}</p>
          </div>
        </div>

        <div className="h-[400px]">
          {chartType === "line" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData.length > 0 ? trendData : data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="formattedDate" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80} 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  label={{ 
                    value: getMetricLabel(selectedMetric), 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={selectedMetric} 
                  stroke={getMetricColor(selectedMetric)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={getMetricLabel(selectedMetric)}
                />
                {showTrend && trendData.length > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey={`${selectedMetric}Trend`} 
                    stroke={getMetricColor(selectedMetric)}
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                    activeDot={false}
                    name="Trend"
                  />
                )}
                {comparisonMode && secondaryMetric && (
                  <Line 
                    type="monotone" 
                    dataKey={secondaryMetric} 
                    stroke={getMetricColor(secondaryMetric)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={getMetricLabel(secondaryMetric)}
                  />
                )}
                {showAverage && (
                  <ReferenceLine 
                    y={stats.avg} 
                    stroke="#888" 
                    strokeDasharray="3 3" 
                    label={{ 
                      value: `Avg: ${stats.avg.toFixed(2)}`, 
                      position: 'insideBottomLeft'
                    }} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartType === "bar" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData.length > 0 ? trendData : data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="formattedDate" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80} 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  label={{ 
                    value: getMetricLabel(selectedMetric), 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Bar 
                  dataKey={selectedMetric} 
                  fill={getMetricColor(selectedMetric)}
                  name={getMetricLabel(selectedMetric)}
                />
                {comparisonMode && secondaryMetric && (
                  <Bar 
                    dataKey={secondaryMetric} 
                    fill={getMetricColor(secondaryMetric)}
                    name={getMetricLabel(secondaryMetric)}
                  />
                )}
                {showAverage && (
                  <ReferenceLine 
                    y={stats.avg} 
                    stroke="#888" 
                    strokeDasharray="3 3" 
                    label={{ 
                      value: `Avg: ${stats.avg.toFixed(2)}`, 
                      position: 'insideBottomLeft'
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartType === "area" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trendData.length > 0 ? trendData : data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="formattedDate" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80} 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  label={{ 
                    value: getMetricLabel(selectedMetric), 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey={selectedMetric} 
                  stroke={getMetricColor(selectedMetric)}
                  fill={getMetricColor(selectedMetric) + "40"}
                  name={getMetricLabel(selectedMetric)}
                />
                {showTrend && trendData.length > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey={`${selectedMetric}Trend`} 
                    stroke={getMetricColor(selectedMetric)}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                    name="Trend"
                  />
                )}
                {comparisonMode && secondaryMetric && (
                  <Area 
                    type="monotone" 
                    dataKey={secondaryMetric} 
                    stroke={getMetricColor(secondaryMetric)}
                    fill={getMetricColor(secondaryMetric) + "40"}
                    name={getMetricLabel(secondaryMetric)}
                  />
                )}
                {showAverage && (
                  <ReferenceLine 
                    y={stats.avg} 
                    stroke="#888" 
                    strokeDasharray="3 3" 
                    label={{ 
                      value: `Avg: ${stats.avg.toFixed(2)}`, 
                      position: 'insideBottomLeft'
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {chartType === "scatter" && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="timestamp" 
                  name="Date" 
                  domain={['auto', 'auto']}
                  tickFormatter={(timestamp) => format(new Date(timestamp), "MM/dd")}
                  label={{ 
                    value: "Date", 
                    position: 'insideBottom', 
                    offset: -20 
                  }}
                />
                <YAxis 
                  type="number" 
                  dataKey={selectedMetric} 
                  name={getMetricLabel(selectedMetric)}
                  label={{ 
                    value: getMetricLabel(selectedMetric), 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <ZAxis range={[100, 100]} />
                <Tooltip 
                  formatter={formatTooltip}
                  labelFormatter={(timestamp) => format(new Date(timestamp), "MMM dd, yyyy HH:mm")}
                />
                <Legend />
                <Scatter 
                  name={getMetricLabel(selectedMetric)} 
                  data={data} 
                  fill={getMetricColor(selectedMetric)}
                />
                {comparisonMode && secondaryMetric && (
                  <Scatter 
                    name={getMetricLabel(secondaryMetric || 'download')} 
                    data={data.map(d => ({ ...d, [selectedMetric]: d[secondaryMetric || 'download'] }))} 
                    fill={getMetricColor(secondaryMetric || 'download')}
                  />
                )}
                {showAverage && (
                  <ReferenceLine 
                    y={stats.avg} 
                    stroke="#888" 
                    strokeDasharray="3 3" 
                    label={{ 
                      value: `Avg: ${stats.avg.toFixed(2)}`, 
                      position: 'insideBottomLeft'
                    }}
                  />
                )}
                {showTrend && trendData.length > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey={`${selectedMetric}Trend`} 
                    stroke={getMetricColor(selectedMetric)}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    data={trendData}
                    name="Trend"
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Raw Data</h3>
        <div className="rounded-md border overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Download (Mbps)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload (Mbps)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ping (ms)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jitter (ms)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Packet Loss (%)
                </th>
                {adminView && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer ID
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {format(new Date(item.timestamp), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(item.timestamp), "HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.download.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.upload.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.ping.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.jitter.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.packetLoss.toFixed(2)}
                  </td>
                  {adminView && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.customerId}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {speedTests.length} of {totalCount} records
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-2">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="limit" className="text-sm">Records per page:</Label>
            <Select
              value={limit.toString()}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1); // Reset to first page when changing limit
              }}
            >
              <SelectTrigger id="limit" className="w-[80px]">
                <SelectValue placeholder="50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}