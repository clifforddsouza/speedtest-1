import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SpeedTest } from "@shared/schema";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { calculatePerformanceScore, getPerformanceGrade } from "@/lib/exportUtils";
import { Lightbulb, ArrowUp, ArrowDown, AlertTriangle, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PerformanceInsightsProps {
  customerId?: string;
}

type InsightPeriod = "7days" | "30days" | "90days" | "all";

export default function PerformanceInsights({ customerId }: PerformanceInsightsProps) {
  const [period, setPeriod] = useState<InsightPeriod>("30days");
  
  // Fetch test data
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
      
      const jsonData = await response.json();
      return jsonData;
    }
  });
  
  // Extract the actual tests array from the response
  const speedTests = speedTestsResponse?.data || [];
  
  // When response has pagination structure, ensure we're handling it correctly
  useEffect(() => {
    if (speedTestsResponse?.pagination) {
      console.log('Pagination info received:', speedTestsResponse.pagination);
    }
  }, [speedTestsResponse]);

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Network Performance Insights</h2>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-60" />
      </Card>
    );
  }

  if (!speedTests || speedTests.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Network Performance Insights</h2>
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-500">No test data available for performance insights.</p>
        </div>
      </Card>
    );
  }

  // Filter tests based on selected period
  const filterTestsByPeriod = (tests: SpeedTest[], selectedPeriod: InsightPeriod): SpeedTest[] => {
    // Make sure we have an array to work with
    if (!Array.isArray(tests)) {
      console.error('Tests data is not an array:', tests);
      return [];
    }
    
    const now = new Date();
    let startDate: Date;
    
    switch (selectedPeriod) {
      case "7days":
        startDate = subDays(now, 7);
        break;
      case "30days":
        startDate = subDays(now, 30);
        break;
      case "90days":
        startDate = subDays(now, 90);
        break;
      case "all":
        return tests;
      default:
        startDate = subDays(now, 30); // Default to 30 days if somehow we get an invalid value
    }
    
    try {
      // Add defensive coding to make sure we handle invalid dates
      return tests.filter(test => {
        if (!test || !test.timestamp) return false;
        const testDate = new Date(test.timestamp);
        return !isNaN(testDate.getTime()) && testDate >= startDate;
      });
    } catch (error) {
      console.error('Error filtering tests by period:', error);
      return [];
    }
  };
  
  const filteredTests = filterTestsByPeriod(speedTests, period);
  
  // Calculate key performance metrics
  const calculateMetrics = (tests: SpeedTest[]) => {
    // Check for valid tests array
    if (!tests || !Array.isArray(tests) || tests.length === 0) {
      return {
        downloadAvg: 0,
        uploadAvg: 0,
        pingAvg: 0,
        jitterAvg: 0,
        packetLossAvg: 0,
        downloadMax: 0,
        uploadMax: 0,
        pingMin: 0,
        performanceScore: 0,
        grade: 'N/A',
        testCount: 0
      };
    }
    
    try {
      // Filter out any null or invalid tests
      const validTests = tests.filter(test => 
        test && 
        typeof test.downloadSpeed === 'number' && 
        typeof test.uploadSpeed === 'number' && 
        typeof test.ping === 'number' && 
        typeof test.jitter === 'number' && 
        typeof test.packetLoss === 'number'
      );
      
      if (validTests.length === 0) {
        console.error('No valid tests with required metrics found');
        return {
          downloadAvg: 0,
          uploadAvg: 0,
          pingAvg: 0,
          jitterAvg: 0,
          packetLossAvg: 0,
          downloadMax: 0,
          uploadMax: 0,
          pingMin: 0,
          performanceScore: 0,
          grade: 'N/A',
          testCount: 0
        };
      }
      
      const downloadSpeeds = validTests.map(test => test.downloadSpeed);
      const uploadSpeeds = validTests.map(test => test.uploadSpeed);
      const pings = validTests.map(test => test.ping);
      const jitters = validTests.map(test => test.jitter);
      const packetLosses = validTests.map(test => test.packetLoss);
      
      const downloadAvg = downloadSpeeds.reduce((sum, speed) => sum + speed, 0) / validTests.length;
      const uploadAvg = uploadSpeeds.reduce((sum, speed) => sum + speed, 0) / validTests.length;
      const pingAvg = pings.reduce((sum, ping) => sum + ping, 0) / validTests.length;
      const jitterAvg = jitters.reduce((sum, jitter) => sum + jitter, 0) / validTests.length;
      const packetLossAvg = packetLosses.reduce((sum, loss) => sum + loss, 0) / validTests.length;
      
      const downloadMax = Math.max(...downloadSpeeds);
      const uploadMax = Math.max(...uploadSpeeds);
      const pingMin = Math.min(...pings);
      
      // Calculate average performance score across all tests
      const avgScore = validTests.reduce((sum, test) => {
        const score = calculatePerformanceScore(test);
        return sum + (isNaN(score) ? 0 : score);
      }, 0) / validTests.length;
      
      return {
        downloadAvg: isNaN(downloadAvg) ? 0 : downloadAvg,
        uploadAvg: isNaN(uploadAvg) ? 0 : uploadAvg,
        pingAvg: isNaN(pingAvg) ? 0 : pingAvg,
        jitterAvg: isNaN(jitterAvg) ? 0 : jitterAvg,
        packetLossAvg: isNaN(packetLossAvg) ? 0 : packetLossAvg,
        downloadMax: isNaN(downloadMax) || !isFinite(downloadMax) ? 0 : downloadMax,
        uploadMax: isNaN(uploadMax) || !isFinite(uploadMax) ? 0 : uploadMax,
        pingMin: isNaN(pingMin) || !isFinite(pingMin) ? 0 : pingMin,
        performanceScore: isNaN(avgScore) ? 0 : Math.round(avgScore),
        grade: isNaN(avgScore) ? 'N/A' : getPerformanceGrade(avgScore),
        testCount: validTests.length
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      return {
        downloadAvg: 0,
        uploadAvg: 0,
        pingAvg: 0,
        jitterAvg: 0,
        packetLossAvg: 0,
        downloadMax: 0,
        uploadMax: 0,
        pingMin: 0,
        performanceScore: 0,
        grade: 'N/A',
        testCount: 0
      };
    }
  };
  
  // Generate performance insights
  const generateInsights = (tests: SpeedTest[]) => {
    if (!tests || !Array.isArray(tests) || tests.length < 2) {
      return [{
        type: 'info',
        title: 'Not Enough Data',
        message: 'Run more speed tests to get performance insights.'
      }];
    }
    
    try {
      const insights = [];
      const metrics = calculateMetrics(tests);
      
      // Sort tests by date with error handling
      const sortedTests = [...tests].sort((a, b) => {
        try {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            return 0; // Skip invalid dates
          }
          
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.error('Error sorting tests by date:', error);
          return 0;
        }
      });
      
      if (sortedTests.length < 2) {
        return [{
          type: 'info',
          title: 'Not Enough Valid Data',
          message: 'Run more speed tests to get performance insights.'
        }];
      }
      
      // Split into two halves to compare trends
      const midpoint = Math.floor(sortedTests.length / 2);
      const firstHalf = sortedTests.slice(0, midpoint);
      const secondHalf = sortedTests.slice(midpoint);
      
      if (firstHalf.length === 0 || secondHalf.length === 0) {
        return [{
          type: 'info',
          title: 'Insufficient Data for Trend Analysis',
          message: 'Need more test data to show trends over time.'
        }];
      }
      
      const firstHalfMetrics = calculateMetrics(firstHalf);
      const secondHalfMetrics = calculateMetrics(secondHalf);
      
      // Download speed trend - with safe division
      if (firstHalfMetrics.downloadAvg > 0) {
        const downloadChange = ((secondHalfMetrics.downloadAvg - firstHalfMetrics.downloadAvg) / firstHalfMetrics.downloadAvg) * 100;
        if (!isNaN(downloadChange) && isFinite(downloadChange) && Math.abs(downloadChange) > 10) {
          insights.push({
            type: downloadChange > 0 ? 'positive' : 'negative',
            title: downloadChange > 0 ? 'Download Speed Improving' : 'Download Speed Declining',
            message: `Download speeds have ${downloadChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(downloadChange).toFixed(1)}% recently.`,
            icon: downloadChange > 0 ? TrendingUp : TrendingDown
          });
        }
      }
      
      // Upload speed trend - with safe division
      if (firstHalfMetrics.uploadAvg > 0) {
        const uploadChange = ((secondHalfMetrics.uploadAvg - firstHalfMetrics.uploadAvg) / firstHalfMetrics.uploadAvg) * 100;
        if (!isNaN(uploadChange) && isFinite(uploadChange) && Math.abs(uploadChange) > 10) {
          insights.push({
            type: uploadChange > 0 ? 'positive' : 'negative',
            title: uploadChange > 0 ? 'Upload Speed Improving' : 'Upload Speed Declining',
            message: `Upload speeds have ${uploadChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(uploadChange).toFixed(1)}% recently.`,
            icon: uploadChange > 0 ? TrendingUp : TrendingDown
          });
        }
      }
      
      // Ping trend - with safe division
      if (firstHalfMetrics.pingAvg > 0) {
        const pingChange = ((secondHalfMetrics.pingAvg - firstHalfMetrics.pingAvg) / firstHalfMetrics.pingAvg) * 100;
        if (!isNaN(pingChange) && isFinite(pingChange) && Math.abs(pingChange) > 10) {
          insights.push({
            type: pingChange < 0 ? 'positive' : 'negative', // For ping, lower is better
            title: pingChange < 0 ? 'Ping Times Improving' : 'Ping Times Increasing',
            message: `Ping times have ${pingChange < 0 ? 'decreased' : 'increased'} by ${Math.abs(pingChange).toFixed(1)}% recently.`,
            icon: pingChange < 0 ? TrendingDown : TrendingUp
          });
        }
      }
      
      // Packet loss issues
      if (metrics.packetLossAvg > 1) {
        insights.push({
          type: 'warning',
          title: 'Packet Loss Detected',
          message: `Average packet loss of ${metrics.packetLossAvg.toFixed(2)}% may indicate network reliability issues.`,
          icon: AlertTriangle
        });
      } else {
        insights.push({
          type: 'positive',
          title: 'Excellent Network Reliability',
          message: 'Packet loss is minimal, indicating a stable connection.',
          icon: Check
        });
      }
      
      // General performance assessment
      if (metrics.performanceScore >= 85) {
        insights.push({
          type: 'positive',
          title: 'High Performance Connection',
          message: `Your network scores ${metrics.grade} (${metrics.performanceScore}/100), suitable for demanding applications.`,
          icon: Check
        });
      } else if (metrics.performanceScore >= 70) {
        insights.push({
          type: 'neutral',
          title: 'Average Performance Connection',
          message: `Your network scores ${metrics.grade} (${metrics.performanceScore}/100), adequate for most applications.`,
          icon: Minus
        });
      } else {
        insights.push({
          type: 'negative',
          title: 'Performance Issues Detected',
          message: `Your network scores ${metrics.grade} (${metrics.performanceScore}/100), which may impact online activities.`,
          icon: AlertTriangle
        });
      }
      
      // Add a tip based on the most significant issue
      if (metrics.pingAvg > 100) {
        insights.push({
          type: 'tip',
          title: 'High Latency Tip',
          message: 'Consider using a wired connection instead of Wi-Fi to reduce ping times.',
          icon: Lightbulb
        });
      } else if (metrics.downloadAvg < 25) {
        insights.push({
          type: 'tip',
          title: 'Low Download Speed Tip',
          message: 'Check for other devices using bandwidth on your network and limit their usage during important tasks.',
          icon: Lightbulb
        });
      } else if (metrics.uploadAvg < 5) {
        insights.push({
          type: 'tip',
          title: 'Low Upload Speed Tip',
          message: 'For video conferencing, close other applications that might be uploading data in the background.',
          icon: Lightbulb
        });
      }
      
      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      return [{
        type: 'info',
        title: 'Unable to Generate Insights',
        message: 'There was an error analyzing your speed test data.'
      }];
    }
  };

  const metrics = calculateMetrics(filteredTests);
  const insights = generateInsights(filteredTests);
  
  // Prepare data for performance score chart
  const scoreDistribution = Array.isArray(filteredTests) ? filteredTests.filter(test => test && test.timestamp).map(test => {
    try {
      const date = new Date(test.timestamp);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date found in test data:', test.timestamp);
        return null;
      }
      
      const score = calculatePerformanceScore(test);
      if (isNaN(score)) {
        console.warn('Invalid score calculated for test:', test);
        return null;
      }
      
      return {
        timestamp: format(date, 'MMM d'),
        score
      };
    } catch (error) {
      console.error('Error processing test for score distribution:', error);
      return null;
    }
  }).filter(Boolean) : [];
  
  // Group scores into ranges for pie chart
  const scoreRanges = [
    { name: 'Excellent (90-100)', range: [90, 100], color: '#22c55e' },
    { name: 'Good (80-89)', range: [80, 89], color: '#84cc16' },
    { name: 'Average (70-79)', range: [70, 79], color: '#facc15' },
    { name: 'Fair (60-69)', range: [60, 69], color: '#f97316' },
    { name: 'Poor (0-59)', range: [0, 59], color: '#ef4444' }
  ];
  
  const scorePieData = scoreRanges.map(range => {
    try {
      const count = Array.isArray(filteredTests) ? filteredTests.filter(test => {
        try {
          if (!test) return false;
          const score = calculatePerformanceScore(test);
          return !isNaN(score) && score >= range.range[0] && score <= range.range[1];
        } catch (error) {
          console.error('Error filtering test for pie chart data:', error);
          return false;
        }
      }).length : 0;
      
      return {
        name: range.name,
        value: count,
        color: range.color
      };
    } catch (error) {
      console.error('Error generating pie chart data for range:', range, error);
      return {
        name: range.name,
        value: 0,
        color: range.color
      };
    }
  }).filter(item => item.value > 0);
  
  return (
    <Card className="p-6">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Network Performance Insights</h2>
        
        <Tabs value={period} onValueChange={value => setPeriod(value as InsightPeriod)}>
          <TabsList>
            <TabsTrigger value="7days">7 Days</TabsTrigger>
            <TabsTrigger value="30days">30 Days</TabsTrigger>
            <TabsTrigger value="90days">90 Days</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Performance Score Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-lg p-6 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold mb-2">{metrics.performanceScore}</div>
          <div className="text-2xl font-semibold">{metrics.grade}</div>
          <div className="text-sm mt-2 opacity-80">Performance Score</div>
        </div>
        
        {/* Speed Metrics */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Connection Speeds</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Download</span>
              <span className="font-semibold">{metrics.downloadAvg.toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Upload</span>
              <span className="font-semibold">{metrics.uploadAvg.toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Max Download</span>
              <span className="font-semibold">{metrics.downloadMax.toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Max Upload</span>
              <span className="font-semibold">{metrics.uploadMax.toFixed(1)} Mbps</span>
            </div>
          </div>
        </div>
        
        {/* Latency Metrics */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Network Quality</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Ping</span>
              <span className="font-semibold">{metrics.pingAvg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Jitter</span>
              <span className="font-semibold">{metrics.jitterAvg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Packet Loss</span>
              <span className="font-semibold">{metrics.packetLossAvg.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tests</span>
              <span className="font-semibold">{metrics.testCount}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Trend Chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Performance Score Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreDistribution} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
              <XAxis dataKey="timestamp" angle={-45} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                formatter={(value) => [`${value}/100`, 'Score']}
                labelFormatter={(value) => `Date: ${value}`}
              />
              <Bar dataKey="score" name="Performance Score" fill="#3b82f6" />
              {/* Reference lines for score ranges */}
              {[60, 70, 80, 90].map((score, i) => (
                <line
                  key={i}
                  x1="0%"
                  y1={`${100 - score}%`}
                  x2="100%"
                  y2={`${100 - score}%`}
                  stroke={["#ef4444", "#f97316", "#84cc16", "#22c55e"][i]}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Performance Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Score Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            {scorePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scorePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {scorePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} test${value !== 1 ? 's' : ''}`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500">
                Not enough data to generate distribution
              </div>
            )}
          </div>
        </div>
        
        {/* Insights and Recommendations */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Insights & Recommendations</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {insights.map((insight, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg flex items-start gap-3 ${
                  insight.type === 'positive' ? 'bg-green-50 text-green-700' :
                  insight.type === 'negative' ? 'bg-red-50 text-red-700' :
                  insight.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                  insight.type === 'tip' ? 'bg-blue-50 text-blue-700' :
                  'bg-gray-50 text-gray-700'
                }`}
              >
                <div className="shrink-0 pt-0.5">
                  {'icon' in insight && insight.icon && <insight.icon className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className="font-medium">{insight.title}</h4>
                  <p className="text-sm opacity-90">{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        Analysis based on {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} from {
          period === 'all' 
            ? 'all time' 
            : `the last ${period === '7days' ? '7 days' : period === '30days' ? '30 days' : '90 days'}`
        }
      </div>
    </Card>
  );
}