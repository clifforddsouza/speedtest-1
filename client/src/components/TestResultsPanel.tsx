import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { SpeedTest } from "@shared/schema";
import { format } from "date-fns";

interface TestResultsPanelProps {
  onViewDetails: (test: SpeedTest) => void;
}

// Interface to handle both snake_case and camelCase fields from the API
// to make TypeScript happy while we deal with the field format inconsistency
interface SpeedTestWithSnakeCase extends SpeedTest {
  customer_id?: string;
  download_speed?: number; 
  upload_speed?: number;
  packet_loss?: number;
  internet_plan?: string;
}

interface PaginatedResponse {
  data: SpeedTestWithSnakeCase[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export default function TestResultsPanel({ onViewDetails }: TestResultsPanelProps) {
  const { data: paginatedResponse, isLoading, isError } = useQuery<PaginatedResponse>({
    queryKey: ["/api/speed-tests"],
    staleTime: 10000, // 10 seconds
  });

  const testResults = paginatedResponse?.data || [];
  const hasResults = !isLoading && !isError && testResults && testResults.length > 0;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "yyyy-MM-dd HH:mm:ss");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Test History</h2>
      
      {isLoading && (
        <div className="text-center py-10 text-gray-500">
          <svg 
            className="animate-spin h-8 w-8 mx-auto mb-2 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Loading test results...</p>
        </div>
      )}
      
      {isError && (
        <div className="text-center py-10 text-red-500">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 mx-auto mb-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Failed to load test results. Please try again later.</p>
        </div>
      )}
      
      {!isLoading && !isError && !hasResults && (
        <div className="text-center py-10 text-gray-500">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 mx-auto mb-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No test results yet. Run a test to see your results here.</p>
        </div>
      )}
      
      {hasResults && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ping</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jitter</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Packet Loss</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISP</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {testResults.map((test: SpeedTestWithSnakeCase) => {
                // Normalize the test data for display
                const customerId = test.customerId || test.customer_id || "-";
                const downloadSpeed = test.downloadSpeed ?? test.download_speed ?? 0;
                const uploadSpeed = test.uploadSpeed ?? test.upload_speed ?? 0;
                const ping = test.ping ?? 0;
                const jitter = test.jitter ?? 0;
                const packetLoss = test.packetLoss ?? test.packet_loss ?? 0;
                
                return (
                  <tr key={test.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{test.timestamp ? formatDateTime(test.timestamp.toString()) : "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{customerId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {downloadSpeed > 0 ? `${downloadSpeed.toFixed(2)} Mbps` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {uploadSpeed > 0 ? `${uploadSpeed.toFixed(2)} Mbps` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {ping > 0 ? `${ping.toFixed(1)} ms` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {jitter > 0 ? `${jitter.toFixed(1)} ms` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {packetLoss > 0 ? `${packetLoss.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{test.isp || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-blue-700"
                        onClick={() => onViewDetails(test)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
