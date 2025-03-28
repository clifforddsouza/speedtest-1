import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserRegistrationForm from "@/components/UserRegistrationForm";
import UserManagementTable from "@/components/UserManagementTable";
import InternetPlansTable from "@/components/InternetPlansTable";
import AdvancedAnalytics from "@/components/AdvancedAnalytics";
import PerformanceInsights from "@/components/PerformanceInsights";
import SpeedTestComparison from "@/components/SpeedTestComparison";
import HistoricalDataViewer from "@/components/HistoricalDataViewer";
import { Settings, BarChart3, LogOut, FileDown, Share2, Zap, Activity, History, Wifi } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
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
  ComposedChart,
} from "recharts";
import { convertSpeedTestsToCSV, generateMonthlyPercentileReport } from "@/lib/exportUtils";
import { generateQuarterlyPercentileReport } from "@/lib/quarterlyReport";
import type { SpeedTest, InternetPlan } from "@shared/schema";
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
  const [dashboardTab, setDashboardTab] = useState<string>("reports");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get the logout mutation from the auth context
  const { logoutMutation } = useAuth();
  
  // Handle logout
  const handleLogout = () => {
    // Immediately redirect to login
    setLocation('/admin/login');
    
    // Then perform the actual logout mutation
    logoutMutation.mutate();
  };

  // Fetch all test data with pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(100); // Fetch a large number for admin dashboard
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  const { data: speedTestsResponse, isLoading: isLoadingTests } = useQuery({
    queryKey: ["/api/speed-tests", page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/speed-tests?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error("Failed to fetch speed test data");
      }
      return response.json();
    }
  });
  
  // Extract the data and pagination info
  const speedTests = speedTestsResponse?.data || [];
  
  // Fetch internet plans
  const { data: internetPlans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["/api/internet-plans"],
    queryFn: async () => {
      const response = await fetch("/api/internet-plans");
      if (!response.ok) {
        throw new Error("Failed to fetch internet plans");
      }
      return response.json();
    }
  });

  const isLoading = isLoadingTests || isLoadingPlans;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-opacity-50 border-t-primary rounded-full"></div>
      </div>
    );
  }

  // Filter tests by customer ID, internet plan, and date range if selected
  const filteredTests = speedTests ? speedTests.filter(test => {
    // Filter by customer ID if selected (but not "all")
    if (selectedCustomerId && selectedCustomerId !== "all" && test.customerId !== selectedCustomerId) {
      return false;
    }
    
    // Filter by internet plan if selected
    if (selectedPlan && test.internetPlan !== selectedPlan) {
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
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    // For 90th percentile, we want the value at which 90% of values fall below
    // So we need to use ceiling or a different formula to get the correct index
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    // Make sure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), sorted.length - 1);
    return sorted[safeIndex];
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
          /* Settings Section */
          <Card className="p-6 mb-6">
            <Tabs defaultValue="user-management">
              <TabsList className="mb-6">
                <TabsTrigger value="user-management" className="flex items-center gap-2">
                  <span>User Management</span>
                </TabsTrigger>
                <TabsTrigger value="plan-management" className="flex items-center gap-2">
                  <span>Plan Management</span>
                </TabsTrigger>
              </TabsList>
              
              {/* User Management Tab */}
              <TabsContent value="user-management">
                <Tabs defaultValue="view-users">
                  <TabsList className="mb-6">
                    <TabsTrigger value="view-users">View Users</TabsTrigger>
                    <TabsTrigger value="add-user">Add New User</TabsTrigger>
                  </TabsList>
                  
                  {/* View Users Tab */}
                  <TabsContent value="view-users">
                    <h2 className="text-lg font-semibold mb-4">Current Users</h2>
                    <UserManagementTable />
                  </TabsContent>
                  
                  {/* Add User Tab */}
                  <TabsContent value="add-user">
                    <h2 className="text-lg font-semibold mb-4">Register New User</h2>
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
                  </TabsContent>
                </Tabs>
              </TabsContent>
              
              {/* Plan Management Tab */}
              <TabsContent value="plan-management">
                <Tabs defaultValue="view-plans">
                  <TabsList className="mb-6">
                    <TabsTrigger value="view-plans">Manage Plans</TabsTrigger>
                  </TabsList>
                  
                  {/* View/Manage Plans Tab */}
                  <TabsContent value="view-plans">
                    <h2 className="text-lg font-semibold mb-4">Internet Plans</h2>
                    <InternetPlansTable />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </Card>
        ) : (
          /* Dashboard Section */
          <>
            {/* Dashboard Analytics Tabs */}
            <Card className="p-6 mb-6">
              <Tabs defaultValue="reports" value={dashboardTab} onValueChange={setDashboardTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Summary Reports</span>
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span>Advanced Analytics</span>
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Performance Insights</span>
                  </TabsTrigger>
                  <TabsTrigger value="comparison" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    <span>Comparison Analysis</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>Historical Data</span>
                  </TabsTrigger>
                </TabsList>
                
                {/* Summary Reports Tab */}
                <TabsContent value="reports">
                  {/* Filter Controls */}
                  <div className="mb-6">
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
                          value={selectedCustomerId || "all"}
                          onValueChange={(value) => setSelectedCustomerId(value === "all" ? "" : value)}
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Internet Plan</label>
                        <Select
                          value={selectedPlan}
                          onValueChange={setSelectedPlan}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Internet Plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Plans</SelectItem>
                            {internetPlans && internetPlans.map((plan: InternetPlan) => (
                              <SelectItem key={plan.id} value={plan.name}>{plan.name}</SelectItem>
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
                    
                    {/* Export Button */}
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => {
                          // Export functionality
                          if (filteredTests.length > 0) {
                            const csvContent = convertSpeedTestsToCSV(filteredTests);
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            
                            // Create a descriptive filename with date range
                            const customerId_ = selectedCustomerId || 'all-customers';
                            const plan_ = selectedPlan || 'all-plans';
                            const startPeriod = useDatePicker && startDate 
                              ? format(startDate, 'yyyy-MM-dd') 
                              : 'last-' + dateRange + (activeReportTab === 'monthly' ? 'months' : 'quarters');
                            const endPeriod = useDatePicker && endDate 
                              ? format(endDate, 'yyyy-MM-dd') 
                              : 'now';
                            
                            link.setAttribute('href', url);
                            link.setAttribute('download', `${customerId_}-${plan_}-${activeReportTab}-${startPeriod}-to-${endPeriod}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            toast({
                              title: "Export Successful",
                              description: `${filteredTests.length} records exported to CSV`,
                            });
                          } else {
                            toast({
                              title: "Export Failed",
                              description: "No data to export",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <FileDown className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                  
                  {/* Monthly/Quarterly Report Tabs */}
                  <div className="mb-6">
                    <Tabs defaultValue="monthly" value={activeReportTab} onValueChange={(value) => setActiveReportTab(value as "monthly" | "quarterly")}>
                      <TabsList className="w-auto mb-4">
                        <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
                        <TabsTrigger value="quarterly">Quarterly Reports</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="monthly">
                        <div className="flex justify-end mb-4">
                          <Button 
                            variant="secondary" 
                            className="flex items-center gap-2"
                            onClick={() => {
                              // Export monthly percentile report with 80th percentiles
                              if (filteredTests.length > 0) {
                                const csvContent = generateMonthlyPercentileReport(filteredTests, selectedPlan);
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                
                                // Create a descriptive filename with date range
                                const customerId_ = selectedCustomerId || 'all-customers';
                                const plan_ = selectedPlan || 'all-plans';
                                const startPeriod = useDatePicker && startDate 
                                  ? format(startDate, 'yyyy-MM-dd') 
                                  : 'last-' + dateRange + '-months';
                                const endPeriod = useDatePicker && endDate 
                                  ? format(endDate, 'yyyy-MM-dd') 
                                  : 'now';
                                
                                link.setAttribute('href', url);
                                link.setAttribute('download', `${customerId_}-${plan_}-monthly-percentiles-${startPeriod}-to-${endPeriod}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                toast({
                                  title: "Export Successful",
                                  description: `Monthly report with 80th percentiles exported to CSV`,
                                });
                              } else {
                                toast({
                                  title: "Export Failed",
                                  description: "No data to export",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                            Export Monthly Report with 80th Percentiles
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Month
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Download (Mbps)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Download
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Upload (Mbps)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Upload
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Ping (ms)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Ping
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Jitter (ms)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Jitter
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Packet Loss (%)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Packet Loss
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {monthlyData.map((item, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.period || ''}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.downloadAvg === 'number' ? item.downloadAvg.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.download90 === 'number' ? item.download90.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.uploadAvg === 'number' ? item.uploadAvg.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.upload90 === 'number' ? item.upload90.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.pingAvg === 'number' ? item.pingAvg.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.ping90 === 'number' ? item.ping90.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.jitterAvg === 'number' ? item.jitterAvg.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.jitter90 === 'number' ? item.jitter90.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.packetLossAvg === 'number' ? item.packetLossAvg.toFixed(2) : '0.00'}%
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.packetLoss90 === 'number' ? item.packetLoss90.toFixed(2) : '0.00'}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="quarterly">
                        <div className="flex justify-end mb-4">
                          <Button 
                            variant="secondary" 
                            className="flex items-center gap-2"
                            onClick={() => {
                              // Export quarterly percentile report with 80th percentiles
                              if (filteredTests.length > 0) {
                                const csvContent = generateQuarterlyPercentileReport(filteredTests, selectedPlan);
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                
                                // Create a descriptive filename with date range
                                const customerId_ = selectedCustomerId || 'all-customers';
                                const plan_ = selectedPlan || 'all-plans';
                                const startPeriod = useDatePicker && startDate 
                                  ? format(startDate, 'yyyy-MM-dd') 
                                  : 'last-' + dateRange + '-quarters';
                                const endPeriod = useDatePicker && endDate 
                                  ? format(endDate, 'yyyy-MM-dd') 
                                  : 'now';
                                
                                link.setAttribute('href', url);
                                link.setAttribute('download', `${customerId_}-${plan_}-quarterly-percentiles-${startPeriod}-to-${endPeriod}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                toast({
                                  title: "Export Successful",
                                  description: `Quarterly report with 80th percentiles exported to CSV`,
                                });
                              } else {
                                toast({
                                  title: "Export Failed",
                                  description: "No data to export",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                            Export Quarterly Report with 80th Percentiles
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Quarter
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Download (Mbps)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Download
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Upload (Mbps)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Upload
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Ping (ms)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Ping
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Jitter (ms)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Jitter
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Avg Packet Loss (%)
                                </th>
                                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  90th % Packet Loss
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {quarterlyData.map((item, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.period || ''}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.downloadAvg === 'number' ? item.downloadAvg.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.download90 === 'number' ? item.download90.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.uploadAvg === 'number' ? item.uploadAvg.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.upload90 === 'number' ? item.upload90.toFixed(2) : '0.00'} Mbps
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.pingAvg === 'number' ? item.pingAvg.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.ping90 === 'number' ? item.ping90.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.jitterAvg === 'number' ? item.jitterAvg.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.jitter90 === 'number' ? item.jitter90.toFixed(1) : '0.0'} ms
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {typeof item.packetLossAvg === 'number' ? item.packetLossAvg.toFixed(2) : '0.00'}%
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                                    {typeof item.packetLoss90 === 'number' ? item.packetLoss90.toFixed(2) : '0.00'}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                  
                  {/* Performance Visualization */}
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-6">Speed Test Performance Overview</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-medium mb-3">Download Speed Trends</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={currentData.map((item, idx) => ({ name: item.period, value: item.downloadAvg }))}
                              margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45} 
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis label={{ value: 'Mbps', angle: -90, position: 'insideLeft' }} />
                              <Tooltip formatter={(value) => [Number(value).toFixed(2) + ' Mbps', 'Avg. Download']} />
                              <Legend />
                              <Line type="monotone" dataKey="value" name="Avg. Download Speed" stroke="#3b82f6" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-3">Upload Speed Trends</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={currentData.map((item, idx) => ({ name: item.period, value: item.uploadAvg }))}
                              margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45} 
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis label={{ value: 'Mbps', angle: -90, position: 'insideLeft' }} />
                              <Tooltip formatter={(value) => [Number(value).toFixed(2) + ' Mbps', 'Avg. Upload']} />
                              <Legend />
                              <Line type="monotone" dataKey="value" name="Avg. Upload Speed" stroke="#10b981" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-lg font-medium mb-3">Ping & Jitter Trends</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={currentData.map((item) => ({ 
                                name: item.period, 
                                ping: item.pingAvg,
                                jitter: item.jitterAvg 
                              }))}
                              margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45} 
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                              <Tooltip formatter={(value) => [Number(value).toFixed(1) + ' ms', '']} />
                              <Legend />
                              <Line type="monotone" dataKey="ping" name="Ping" stroke="#f97316" strokeWidth={2} />
                              <Line type="monotone" dataKey="jitter" name="Jitter" stroke="#8b5cf6" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-3">Packet Loss Trends</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={currentData.map((item) => ({ 
                                name: item.period, 
                                avgLoss: item.packetLossAvg,
                                p90Loss: item.packetLoss90
                              }))}
                              margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45} 
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                              <Tooltip formatter={(value) => [Number(value).toFixed(2) + '%', '']} />
                              <Legend />
                              <Bar dataKey="avgLoss" name="Avg. Packet Loss" fill="#ef4444" />
                              <Bar dataKey="p90Loss" name="90th % Packet Loss" fill="#f87171" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Advanced Analytics Components */}
                <TabsContent value="advanced">
                  <AdvancedAnalytics adminView={true} customerId={selectedCustomerId} />
                </TabsContent>
                
                <TabsContent value="insights">
                  <PerformanceInsights customerId={selectedCustomerId} />
                </TabsContent>
                
                <TabsContent value="comparison">
                  <SpeedTestComparison customerId={selectedCustomerId} />
                </TabsContent>
                
                <TabsContent value="history">
                  <HistoricalDataViewer customerId={selectedCustomerId} adminView={true} />
                </TabsContent>
              </Tabs>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}