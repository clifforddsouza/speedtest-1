import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CircularProgress from "./CircularProgress";
import { measureSpeed, measurePing, measureJitter, measurePacketLoss } from "@/lib/speedtest";

interface SpeedTestPanelProps {
  customerId: string;
  testLocation: string;
  testNotes: string;
}

export default function SpeedTestPanel({ customerId, testLocation, testNotes }: SpeedTestPanelProps) {
  const { toast } = useToast();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState("Ready");
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [packetLoss, setPacketLoss] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [downloadData, setDownloadData] = useState("0 MB");
  const [uploadData, setUploadData] = useState("0 MB");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("Waiting");
  const [uploadStatus, setUploadStatus] = useState("Waiting");
  const [ispInfo, setIspInfo] = useState("-");
  const [ipInfo, setIpInfo] = useState("-");
  const [serverInfo, setServerInfo] = useState("Chicago, IL");
  const [distanceInfo, setDistanceInfo] = useState("-");

  // Mutation for saving test results
  const saveTestMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await apiRequest("POST", "/api/speed-tests", testData);
      return await response.json();
    },
    onSuccess: (data) => {
      // Test was completed and stored successfully
      queryClient.invalidateQueries({ queryKey: ["/api/speed-tests"] });
      toast({
        title: "Test Completed",
        description: "Your speed test results have been saved.",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save test results. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      console.error("Error saving test results:", error);
    }
  });

  const resetTestValues = () => {
    setPing(null);
    setJitter(null);
    setPacketLoss(null);
    setDownloadSpeed(null);
    setUploadSpeed(null);
    setDownloadData("0 MB");
    setUploadData("0 MB");
    setDownloadProgress(0);
    setUploadProgress(0);
    setDownloadStatus("Waiting");
    setUploadStatus("Waiting");
  };

  const startTest = async () => {
    if (!customerId) {
      toast({
        title: "Customer ID Required",
        description: "Please enter a Customer ID before starting the test.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (isTestRunning) return;
    
    setIsTestRunning(true);
    resetTestValues();
    setTestStatus("Initializing...");

    try {
      // Get connection info
      setTestStatus("Getting connection info...");
      
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        setIpInfo(ipData.ip);
        
        // For a real app, we would use a IP geolocation API here
        setIspInfo("Detected ISP");
        setDistanceInfo("~10 km");
      } catch (error) {
        console.error("Error getting IP information:", error);
        setIpInfo("Failed to detect");
      }
      
      // Test ping
      setTestStatus("Testing ping...");
      const pingResult = await measurePing();
      setPing(pingResult);
      
      // Test jitter
      setTestStatus("Testing jitter...");
      const jitterResult = await measureJitter();
      setJitter(jitterResult);
      
      // Test packet loss
      setTestStatus("Testing packet loss...");
      const packetLossResult = await measurePacketLoss();
      setPacketLoss(packetLossResult);
      
      // Test download
      setTestStatus("Testing download speed...");
      setDownloadStatus("Testing...");
      const downloadResult = await measureSpeed("download", (progress, data) => {
        setDownloadProgress(progress);
        setDownloadData(`${data.toFixed(1)} MB`);
        setDownloadSpeed(Math.floor(data * 8 / (progress / 100)));
      });
      setDownloadSpeed(downloadResult);
      setDownloadStatus("Complete");
      
      // Test upload
      setTestStatus("Testing upload speed...");
      setUploadStatus("Testing...");
      const uploadResult = await measureSpeed("upload", (progress, data) => {
        setUploadProgress(progress);
        setUploadData(`${data.toFixed(1)} MB`);
        setUploadSpeed(Math.floor(data * 8 / (progress / 100)));
      });
      setUploadSpeed(uploadResult);
      setUploadStatus("Complete");
      
      // Test complete
      setTestStatus("Test Complete");
      
      // Log the packet loss value before saving
      console.log("Packet loss to be saved:", packetLossResult);
      
      // Make sure packet loss is a valid number
      const processedPacketLoss = typeof packetLossResult === 'number' 
        ? packetLossResult
        : parseFloat(String(packetLossResult)) || 0;
        
      console.log("Processed packet loss:", processedPacketLoss);
      
      // Save results
      saveTestMutation.mutate({
        customerId,
        testLocation,
        notes: testNotes,
        downloadSpeed: downloadResult,
        uploadSpeed: uploadResult,
        ping: pingResult,
        jitter: jitterResult,
        packetLoss: processedPacketLoss,
        isp: ispInfo,
        ipAddress: ipInfo,
        server: serverInfo,
        distance: distanceInfo,
        userAgent: navigator.userAgent,
        downloadData: parseFloat(downloadData.replace(" MB", "")),
        uploadData: parseFloat(uploadData.replace(" MB", "")),
        testDuration: 12.4, // In a real app, we would calculate this
      });
      
    } catch (error) {
      console.error("Error during speed test:", error);
      setTestStatus("Test Failed");
      toast({
        title: "Test Failed",
        description: "An error occurred during the speed test. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const abortTest = () => {
    if (!isTestRunning) return;
    
    // In a real implementation, we would abort any pending requests
    setIsTestRunning(false);
    setTestStatus("Test Aborted");
    setDownloadStatus("Aborted");
    setUploadStatus("Aborted");
    
    toast({
      title: "Test Aborted",
      description: "The speed test has been aborted.",
      duration: 3000,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Speed Test</h2>
      
      {/* Test Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button 
            className={`bg-primary hover:bg-blue-600 text-white ${isTestRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={startTest}
            disabled={isTestRunning}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Test
          </Button>
          <Button 
            variant="outline"
            className={`border border-red-500 text-red-500 hover:bg-red-500 hover:text-white ${!isTestRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={abortTest}
            disabled={!isTestRunning}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Abort
          </Button>
        </div>
        <div className="text-sm text-gray-500">
          <span>{testStatus}</span>
        </div>
      </div>

      {/* Test Results Display */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Ping Meter */}
        <div className="bg-gray-50 rounded-lg p-5 text-center">
          <div className="flex justify-center">
            <div className="relative w-24 h-24 mb-2">
              <CircularProgress 
                value={ping ?? 0} 
                maxValue={100} 
                color="primary" 
                invert
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-semibold font-mono">
                  {ping !== null ? ping : '-'}
                </span>
              </div>
            </div>
          </div>
          <h3 className="font-semibold text-gray-800">Ping</h3>
          <p className="text-sm text-gray-500">milliseconds</p>
        </div>

        {/* Jitter Meter */}
        <div className="bg-gray-50 rounded-lg p-5 text-center">
          <div className="flex justify-center">
            <div className="relative w-24 h-24 mb-2">
              <CircularProgress 
                value={jitter ?? 0} 
                maxValue={10} 
                color="warning" 
                invert
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-semibold font-mono">
                  {jitter !== null ? jitter : '-'}
                </span>
              </div>
            </div>
          </div>
          <h3 className="font-semibold text-gray-800">Jitter</h3>
          <p className="text-sm text-gray-500">milliseconds</p>
        </div>

        {/* Packet Loss Meter */}
        <div className="bg-gray-50 rounded-lg p-5 text-center">
          <div className="flex justify-center">
            <div className="relative w-24 h-24 mb-2">
              <CircularProgress 
                value={packetLoss ?? 0} 
                maxValue={5} 
                color="destructive" 
                invert
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-semibold font-mono">
                  {packetLoss !== null ? `${packetLoss}%` : '-'}
                </span>
              </div>
            </div>
          </div>
          <h3 className="font-semibold text-gray-800">Packet Loss</h3>
          <p className="text-sm text-gray-500">percent</p>
        </div>

        {/* ISP Info */}
        <div className="bg-gray-50 rounded-lg p-5">
          <h3 className="font-semibold text-gray-800 mb-2">Connection Info</h3>
          <ul className="text-sm space-y-2">
            <li className="flex justify-between">
              <span className="text-gray-500">ISP:</span>
              <span className="font-medium">{ispInfo}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">IP Address:</span>
              <span className="font-medium">{ipInfo}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">Server:</span>
              <span className="font-medium">{serverInfo}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">Distance:</span>
              <span className="font-medium">{distanceInfo}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Download/Upload Speed Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Download Speed Meter */}
        <div className="bg-gray-50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">Download</h3>
            <div className="flex items-center text-sm">
              <div className="w-3 h-3 rounded-full bg-primary mr-1"></div>
              <span>{downloadStatus}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
          
          <div className="flex items-end justify-between">
            <div>
              <span className="text-4xl font-bold font-mono">{downloadSpeed ?? 0}</span>
              <span className="text-lg font-medium ml-1">Mbps</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Data Transferred</div>
              <div className="font-medium">{downloadData}</div>
            </div>
          </div>
        </div>

        {/* Upload Speed Meter */}
        <div className="bg-gray-50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">Upload</h3>
            <div className="flex items-center text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span>{uploadStatus}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          
          <div className="flex items-end justify-between">
            <div>
              <span className="text-4xl font-bold font-mono">{uploadSpeed ?? 0}</span>
              <span className="text-lg font-medium ml-1">Mbps</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Data Transferred</div>
              <div className="font-medium">{uploadData}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
