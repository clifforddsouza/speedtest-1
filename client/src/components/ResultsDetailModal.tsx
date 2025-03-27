import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { SpeedTest } from "@shared/schema";
import { format } from "date-fns";

interface ResultsDetailModalProps {
  test: SpeedTest;
  onClose: () => void;
}

export default function ResultsDetailModal({ test, onClose }: ResultsDetailModalProps) {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "yyyy-MM-dd HH:mm:ss");
  };

  const exportResults = () => {
    // Create CSV content
    const csvContent = [
      "Parameter,Value",
      `Test ID,ST-${test.id}`,
      `Test Date,${formatDateTime(test.timestamp.toString())}`,
      `Customer ID,${test.customerId}`,
      `Location,${test.testLocation || 'Not specified'}`,
      `ISP,${test.isp || 'Not detected'}`,
      `IP Address,${test.ipAddress || 'Not detected'}`,
      `Server,${test.server || 'Not specified'}`,
      `Distance,${test.distance || 'Not calculated'}`,
      `User Agent,${test.userAgent || 'Not recorded'}`,
      `Download Speed,${test.downloadSpeed.toFixed(2)} Mbps`,
      `Upload Speed,${test.uploadSpeed.toFixed(2)} Mbps`,
      `Ping,${test.ping.toFixed(1)} ms`,
      `Jitter,${test.jitter.toFixed(1)} ms`,
      `Packet Loss,${test.packetLoss.toFixed(1)}%`,
      `Download Data,${test.downloadData ? test.downloadData.toFixed(1) : '0'} MB`,
      `Upload Data,${test.uploadData ? test.uploadData.toFixed(1) : '0'} MB`,
      `Test Duration,${test.testDuration ? test.testDuration.toFixed(1) : '0'} seconds`,
      `Internet Plan,${test.internetPlan || 'Not specified'}`
    ].join("\n");

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `speedtest-${test.customerId}-${format(new Date(test.timestamp.toString()), "yyyyMMdd-HHmmss")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900">Detailed Test Results</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Connection Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Test ID:</span>
                  <span className="font-medium">ST-{test.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Test Date:</span>
                  <span className="font-medium">{formatDateTime(test.timestamp.toString())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer ID:</span>
                  <span className="font-medium">{test.customerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location:</span>
                  <span className="font-medium">{test.testLocation || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ISP:</span>
                  <span className="font-medium">{test.isp || 'Not detected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">IP Address:</span>
                  <span className="font-medium">{test.ipAddress || 'Not detected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Server:</span>
                  <span className="font-medium">{test.server || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance:</span>
                  <span className="font-medium">{test.distance || 'Not calculated'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">User Agent:</span>
                  <span className="font-medium text-xs truncate">{test.userAgent || 'Not recorded'}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Test Results</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Download Speed:</span>
                  <span className="font-medium">{test.downloadSpeed.toFixed(2)} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Upload Speed:</span>
                  <span className="font-medium">{test.uploadSpeed.toFixed(2)} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ping (Latency):</span>
                  <span className="font-medium">{test.ping.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Jitter:</span>
                  <span className="font-medium">{test.jitter.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Packet Loss:</span>
                  <span className="font-medium">{test.packetLoss.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Download Data:</span>
                  <span className="font-medium">{test.downloadData ? test.downloadData.toFixed(1) : '0'} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Upload Data:</span>
                  <span className="font-medium">{test.uploadData ? test.uploadData.toFixed(1) : '0'} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Test Duration:</span>
                  <span className="font-medium">{test.testDuration ? test.testDuration.toFixed(1) : '0'} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Internet Plan:</span>
                  <span className="font-medium">{test.internetPlan || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <h4 className="font-semibold mb-3">Detailed Measurements</h4>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h5 className="text-sm font-medium mb-2">Packet Loss Analysis</h5>
            <div className="h-40 bg-gray-100 rounded relative">
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <span>Packet Loss Chart ({test.packetLoss.toFixed(1)}% Average)</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="text-sm font-medium mb-2">Speed Variations</h5>
            <div className="h-40 bg-gray-100 rounded relative">
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <span>Speed Variation Chart</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={exportResults}>
            Export Results
          </Button>
        </div>
      </div>
    </div>
  );
}
