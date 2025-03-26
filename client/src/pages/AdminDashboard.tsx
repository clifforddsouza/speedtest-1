import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserRegistrationForm from "@/components/UserRegistrationForm";
import UserManagementTable from "@/components/UserManagementTable";
import { Settings, BarChart3, LogOut } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SpeedTest } from "@shared/schema";
import { format, startOfMonth, endOfMonth, sub, add, isWithinInterval, startOfQuarter, endOfQuarter, isAfter, isBefore, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  // State for filters and tabs
  const [activeReportTab, setActiveReportTab] = useState<"monthly" | "quarterly">("monthly");
  const [activeSection, setActiveSection] = useState<"dashboard" | "settings">("dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [filterCustomerId, setFilterCustomerId] = useState<string>("");
  const [dateRange, setDateRange] = useState<number>(6); // Last 6 months/quarters by default
  const [startDate, setStartDate] = useState<Date | undefined>(sub(new Date(), { months: 6 }));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [useDatePicker, setUseDatePicker] = useState<boolean>(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Remove authentication state from localStorage
        localStorage.removeItem('isAdminAuthenticated');
        
        // Show success toast
        toast({
          title: "Success",
          description: "Logged out successfully",
        });
        
        // Redirect to login page
        setLocation('/admin/login');
      } else {
        toast({
          title: "Error",
          description: "Failed to logout",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during logout",
        variant: "destructive"
      });
    }
  };

  // Fetch all test data
  const { data: speedTests, isLoading } = useQuery({
    queryKey: ["/api/speed-tests"],
    queryFn: async () => {
      const response = await fetch("/api/speed-tests");
      if (!response.ok) {
        throw new Error("Failed to fetch speed test data");
      }
      return response.json() as Promise<SpeedTest[]>;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-opacity-50 border-t-primary rounded-full"></div>
      </div>
    );
  }

  // Filter tests by customer ID and date range if selected
  const filteredTests = speedTests ? speedTests.filter(test => {
    // Filter by customer ID if selected (but not "all")
    if (selectedCustomerId && selectedCustomerId !== "all" && test.customerId !== selectedCustomerId) {
      return false;
    }
    
    // Filter by custom date range if enabled
    if (useDatePicker && startDate && endDate) {
      const testDate = new Date(test.timestamp);
      if (isBefore(testDate, startOfMonth(startDate)) || isAfter(testDate, endOfMonth(endDate))) {
        return false;
      }
    }
    
    return true;
  }) : [];

  // Helper functions for percentile calculations
  const calcPercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[index];
  };

  // Extract unique customer IDs
  const customerIds = speedTests ? Array.from(new Set(speedTests.map(test => test.customerId))) : [];

  // Group data by period (month or quarter)
  interface Period {
    start: Date;
    end: Date;
    label: string;
  }

  const groupDataByPeriod = (data: SpeedTest[], type: "monthly" | "quarterly") => {
    // Generate periods
    const periods: Period[] = [];
    
    if (useDatePicker && startDate && endDate) {
      // Use custom date range
      if (type === "monthly") {
        // Generate months between start and end dates
        let current = startOfMonth(startDate);
        while (isBefore(current, endDate) || isSameMonth(current, endDate)) {
          const monthStart = current;
          const monthEnd = endOfMonth(current);
          
          periods.push({
            start: monthStart,
            end: monthEnd,
            label: format(monthStart, 'MMM yyyy')
          });
          
          // Move to next month
          current = startOfMonth(add(current, { months: 1 }));
        }
      } else {
        // Generate quarters between start and end dates
        let current = startOfQuarter(startDate);
        while (isBefore(current, endDate)) {
          const quarterStart = current;
          const quarterEnd = endOfQuarter(current);
          
          periods.push({
            start: quarterStart,
            end: quarterEnd,
            label: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`
          });
          
          // Move to next quarter
          current = startOfQuarter(add(current, { months: 3 }));
        }
      }
    } else {
      // Use predefined date range
      const now = new Date();
      
      for (let i = 0; i < dateRange; i++) {
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
    }
    
    // Sort periods from oldest to newest
    periods.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Initialize result array
    const result = periods.map(period => ({
      period: period.label,
      periodLabel: period.label, 
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

    // Calculate various percentiles and statistics
    return result.map(item => ({
      period: item.periodLabel,
      // Download stats
      downloadAvg: item.downloadTests.length > 0 
        ? item.downloadTests.reduce((a, b) => a + b, 0) / item.downloadTests.length 
        : 0,
      download50: calcPercentile(item.downloadTests, 50),  // Median
      download90: calcPercentile(item.downloadTests, 90),
      download95: calcPercentile(item.downloadTests, 95),
      
      // Upload stats
      uploadAvg: item.uploadTests.length > 0 
        ? item.uploadTests.reduce((a, b) => a + b, 0) / item.uploadTests.length 
        : 0,
      upload50: calcPercentile(item.uploadTests, 50),  // Median
      upload90: calcPercentile(item.uploadTests, 90),
      upload95: calcPercentile(item.uploadTests, 95),
      
      // Ping stats
      pingAvg: item.pingTests.length > 0 
        ? item.pingTests.reduce((a, b) => a + b, 0) / item.pingTests.length 
        : 0,
      ping90: calcPercentile(item.pingTests, 90),
      
      // Jitter stats
      jitterAvg: item.jitterTests.length > 0 
        ? item.jitterTests.reduce((a, b) => a + b, 0) / item.jitterTests.length 
        : 0,
      jitter90: calcPercentile(item.jitterTests, 90),
      
      // Packet loss stats
      packetLossAvg: item.packetLossTests.length > 0 
        ? item.packetLossTests.reduce((a, b) => a + b, 0) / item.packetLossTests.length 
        : 0,
      packetLoss90: calcPercentile(item.packetLossTests, 90),
      
      // Test count
      testCount: item.downloadTests.length
    }));
  };

  const monthlyData = filteredTests.length > 0 ? groupDataByPeriod(filteredTests, "monthly") : [];
  const quarterlyData = filteredTests.length > 0 ? groupDataByPeriod(filteredTests, "quarterly") : [];
  
  const currentData = activeReportTab === "monthly" ? monthlyData : quarterlyData;

  // Filter specific customer data by partial match
  const handleCustomerFilterChange = (value: string) => {
    setFilterCustomerId(value);
  };

  const filteredCustomerIds = filterCustomerId
    ? customerIds.filter(id => id.toLowerCase().includes(filterCustomerId.toLowerCase()))
    : customerIds;

  // Common header for both data present and no data views
  const AdminHeader = () => (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex space-x-2">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
            <Link href="/">
              <Button variant="outline">Back to Speed Test</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

  // Content for when no test data is available
  if (!speedTests || speedTests.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        
        <div className="container mx-auto px-4 py-8">
          {/* Main Tab Navigation */}
          <Card className="p-4 mb-6">
            <Tabs 
              defaultValue="dashboard" 
              value={activeSection}
              onValueChange={(value) => setActiveSection(value as "dashboard" | "settings")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-[400px] mb-4">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Card>

          {activeSection === "settings" ? (
            <>
              {/* User Registration */}
              <Card className="p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">User Registration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UserRegistrationForm />
                  <div className="bg-gray-50 rounded-lg p-6 flex flex-col justify-center">
                    <h3 className="text-xl font-medium text-primary mb-4">Why Register Users?</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Assign unique customer IDs for tracking</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Enable user-specific test history</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Improve data organization for analytics</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Secure access to sensitive network data</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
              
              {/* User Management Table */}
              <Card className="p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Current Users</h2>
                <UserManagementTable />
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold mb-2">No Test Data Available</h2>
                <p className="text-gray-500">There is no speed test data to analyze. Run some tests first.</p>
                <Link href="/">
                  <Button className="mt-4">Go to Speed Test</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Main dashboard view with test data
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        {/* Main Tab Navigation */}
        <Card className="p-4 mb-6">
          <Tabs 
            defaultValue="dashboard" 
            value={activeSection}
            onValueChange={(value) => setActiveSection(value as "dashboard" | "settings")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-[400px] mb-4">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        {activeSection === "settings" ? (
          <>
            {/* User Registration */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">User Registration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UserRegistrationForm />
                <div className="bg-gray-50 rounded-lg p-6 flex flex-col justify-center">
                  <h3 className="text-xl font-medium text-primary mb-4">Why Register Users?</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Assign unique customer IDs for tracking</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Enable user-specific test history</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Improve data organization for analytics</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Secure access to sensitive network data</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
            
            {/* User Management Table */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Current Users</h2>
              <UserManagementTable />
            </Card>
          </>
        ) : (
          <>
            {/* Filters */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      placeholder="Filter customers..."
                      value={filterCustomerId}
                      onChange={(e) => handleCustomerFilterChange(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select customer ID" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {filteredCustomerIds.map(id => (
                        <SelectItem key={id} value={id}>{id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
                  <Select
                    value={activeReportTab}
                    onValueChange={(value) => setActiveReportTab(value as "monthly" | "quarterly")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <div className="flex items-center space-x-2 mb-2">
                    <input 
                      type="checkbox" 
                      id="useDatePicker" 
                      checked={useDatePicker} 
                      onChange={() => setUseDatePicker(!useDatePicker)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="useDatePicker" className="text-sm text-gray-600">
                      Use custom date range
                    </label>
                  </div>
                  
                  {useDatePicker ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
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
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
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
                              disabled={(date) => 
                                startDate ? isBefore(date, startDate) : false
                              }
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ) : (
                    <Select
                      value={dateRange.toString()}
                      onValueChange={(value) => setDateRange(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Last 3 {activeReportTab === "monthly" ? "Months" : "Quarters"}</SelectItem>
                        <SelectItem value="6">Last 6 {activeReportTab === "monthly" ? "Months" : "Quarters"}</SelectItem>
                        <SelectItem value="12">Last 12 {activeReportTab === "monthly" ? "Months" : "Quarters"}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Card>

            {/* 90th Percentile Download/Upload Chart */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Speed Test 90th Percentile Trends</h2>
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
                      domain={[0, 'dataMax + 10']}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name.includes("download")) return [`${value.toFixed(1)} Mbps`, name.replace("download", "Download ")];
                        if (name.includes("upload")) return [`${value.toFixed(1)} Mbps`, name.replace("upload", "Upload ")];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="download90" name="download90" fill="#3b82f6" />
                    <Bar dataKey="upload90" name="upload90" fill="#10b981" />
                    <ReferenceLine 
                      y={25} // A reference line for example minimum acceptable download speed
                      stroke="red" 
                      strokeDasharray="3 3" 
                      label={{ 
                        value: 'Min. Target Speed', 
                        position: 'insideBottomRight',
                        fill: 'red' 
                      }} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Detailed Percentile Metrics Table */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Detailed {activeReportTab === "monthly" ? "Monthly" : "Quarterly"} Percentile Analysis</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download Avg
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download 50th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download 90th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download 95th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload Avg
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload 50th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload 90th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload 95th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tests
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
                          {item.downloadAvg.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.download50.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold bg-blue-50">
                          {item.download90.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.download95.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.uploadAvg.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.upload50.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold bg-green-50">
                          {item.upload90.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.upload95.toFixed(1)} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.testCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Additional Metrics Table */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Network Quality Metrics</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ping Avg
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ping 90th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jitter Avg
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jitter 90th
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Packet Loss Avg
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Packet Loss 90th
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
                          {item.pingAvg.toFixed(1)} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                          {item.ping90.toFixed(1)} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.jitterAvg.toFixed(1)} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                          {item.jitter90.toFixed(1)} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.packetLossAvg.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                          {item.packetLoss90.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}