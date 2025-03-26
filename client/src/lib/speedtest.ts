import { apiRequest } from './queryClient';

// Helper to simulate test delays in development
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Measure ping - real implementation
export const measurePing = async (): Promise<number> => {
  try {
    console.log('Starting real ping measurement');
    const pingEndpoint = '/api/speedtest/download?size=1';
    const pingCount = 10; // Number of ping measurements to average
    let totalPing = 0;
    
    // Run multiple ping tests and average them
    for (let i = 0; i < pingCount; i++) {
      const startTime = Date.now();
      const response = await fetch(pingEndpoint, {
        method: 'GET',
        cache: 'no-store', // Bypass cache for accurate measurements
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Read the response to complete the request
      await response.arrayBuffer();
      
      const endTime = Date.now();
      const pingTime = endTime - startTime;
      
      console.log(`Ping measurement ${i+1}/${pingCount}: ${pingTime}ms`);
      totalPing += pingTime;
      
      // Short delay between measurements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate the average ping
    const averagePing = Math.round(totalPing / pingCount);
    console.log(`Average ping: ${averagePing}ms`);
    
    return averagePing;
  } catch (error) {
    console.error('Error measuring ping:', error);
    throw error;
  }
};

// Measure jitter - real implementation
export const measureJitter = async (): Promise<number> => {
  try {
    console.log('Starting real jitter measurement');
    const jitterEndpoint = '/api/speedtest/download?size=1';
    const measurementCount = 20; // Number of ping measurements for jitter
    const pingTimes: number[] = [];
    
    // Perform multiple ping measurements
    for (let i = 0; i < measurementCount; i++) {
      const startTime = Date.now();
      
      const response = await fetch(jitterEndpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await response.arrayBuffer();
      
      const pingTime = Date.now() - startTime;
      pingTimes.push(pingTime);
      
      console.log(`Jitter measurement ${i+1}/${measurementCount}: ${pingTime}ms`);
      
      // Add some randomness to the delay between tests
      await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 40));
    }
    
    // Calculate jitter as the average deviation between consecutive ping times
    let totalDeviation = 0;
    for (let i = 1; i < pingTimes.length; i++) {
      const deviation = Math.abs(pingTimes[i] - pingTimes[i - 1]);
      totalDeviation += deviation;
    }
    
    // Average deviation (jitter)
    const averageJitter = parseFloat((totalDeviation / (pingTimes.length - 1)).toFixed(1));
    console.log(`Calculated jitter: ${averageJitter}ms from ${measurementCount} measurements`);
    
    return averageJitter;
  } catch (error) {
    console.error('Error measuring jitter:', error);
    throw error;
  }
};

// Measure packet loss - using WebSockets for real measurement
export const measurePacketLoss = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting real packet loss measurement via WebSocket');
      
      // Get the current hostname for WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws-packet-test`;
      
      const socket = new WebSocket(wsUrl);
      let testId: string | null = null;
      let packetCount = 0;
      let acknowledgedPackets = 0;
      let intervalId: number | null = null;
      let testComplete = false;
      
      // For test timeout
      const maxTestDuration = 10000; // 10 seconds
      const packetDelay = 25; // 25ms between packets
      const testPackets = 100; // Send 100 packets
      const acksReceived = new Set<number>();
      
      const cleanup = () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        try {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
      };
      
      // Set a timeout for the entire test
      const timeoutId = setTimeout(() => {
        if (!testComplete) {
          console.warn('Packet loss test timed out');
          cleanup();
          
          // Calculate results based on what we got so far
          const lostPackets = packetCount - acknowledgedPackets;
          const packetLossPercentage = packetCount > 0 
            ? (lostPackets / packetCount) * 100 
            : 0;
          
          resolve(parseFloat(packetLossPercentage.toFixed(2)));
        }
      }, maxTestDuration);
      
      socket.onopen = () => {
        console.log('WebSocket connection established for packet loss test');
        
        // Initialize the test
        socket.send(JSON.stringify({ type: 'init' }));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'init': {
              // Test initialized, start sending packets
              testId = data.testId;
              console.log(`Packet loss test initialized with ID: ${testId}`);
              
              // Start sending packets at regular intervals
              intervalId = window.setInterval(() => {
                if (packetCount >= testPackets) {
                  // Stop sending packets once we reach the desired count
                  if (intervalId !== null) {
                    clearInterval(intervalId);
                    intervalId = null;
                    
                    // Tell the server how many packets we sent
                    socket.send(JSON.stringify({
                      type: 'client-sent',
                      count: packetCount
                    }));
                    
                    // Request results
                    socket.send(JSON.stringify({
                      type: 'get-results'
                    }));
                  }
                  return;
                }
                
                const packetId = packetCount++;
                socket.send(JSON.stringify({
                  type: 'packet',
                  packetId,
                  timestamp: Date.now()
                }));
              }, packetDelay);
              break;
            }
            
            case 'ack': {
              // Received acknowledgment for a packet
              if (!acksReceived.has(data.packetId)) {
                acksReceived.add(data.packetId);
                acknowledgedPackets++;
              }
              break;
            }
            
            case 'results': {
              // Test complete, process results
              testComplete = true;
              clearTimeout(timeoutId);
              cleanup();
              
              // Calculate packet loss based on our local counts rather than server-reported counts
              // This is more accurate as it reflects what the client actually experienced
              const clientLostPackets = packetCount - acknowledgedPackets;
              const clientPacketLossPercentage = packetCount > 0 
                ? (clientLostPackets / packetCount) * 100 
                : 0;
              
              console.log(`Server reports: ${data.lostPackets} lost out of ${data.sentPackets} (${data.packetLossPercentage}%)`);
              console.log(`Client calculates: ${clientLostPackets} lost out of ${packetCount} (${clientPacketLossPercentage.toFixed(2)}%)`);
              
              // Return the client-calculated packet loss percentage for more accurate results
              resolve(parseFloat(clientPacketLossPercentage.toFixed(2)));
              break;
            }
            
            case 'error': {
              console.error('WebSocket packet loss test error:', data.message);
              break;
            }
          }
        } catch (error) {
          console.error('Error processing packet loss test message:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error during packet loss test:', error);
        cleanup();
        clearTimeout(timeoutId);
        
        // Report connection error as high packet loss
        if (packetCount === 0) {
          // We couldn't even start the test, which indicates a connectivity issue
          console.warn('WebSocket error before any packets could be sent - reporting connectivity issue');
          // 100% packet loss represents connection failure
          resolve(100);
        } else {
          // Calculate with what we have
          const lostPackets = packetCount - acknowledgedPackets;
          const packetLossPercentage = packetCount > 0 
            ? (lostPackets / packetCount) * 100 
            : 100; // If somehow we sent 0 packets, that's 100% loss
          console.log(`Client calculated packet loss: ${lostPackets} lost out of ${packetCount} (${packetLossPercentage.toFixed(2)}%)`);
          resolve(parseFloat(packetLossPercentage.toFixed(2)));
        }
      };
      
      socket.onclose = () => {
        console.log('WebSocket connection closed for packet loss test');
        cleanup();
        clearTimeout(timeoutId);
        
        if (!testComplete) {
          // If the connection closed unexpectedly before we got results
          if (packetCount === 0) {
            // No packets were sent, report as a connection problem (100% loss)
            console.warn('WebSocket connection closed before any packets could be sent - reporting connectivity issue');
            resolve(100);
          } else {
            // Calculate with what we have
            const lostPackets = packetCount - acknowledgedPackets;
            const packetLossPercentage = packetCount > 0 
              ? (lostPackets / packetCount) * 100 
              : 100; // If somehow we sent 0 packets, that's 100% loss
            console.log(`Client calculated packet loss (on close): ${lostPackets} lost out of ${packetCount} (${packetLossPercentage.toFixed(2)}%)`);
            resolve(parseFloat(packetLossPercentage.toFixed(2)));
          }
        }
      };
      
    } catch (error) {
      console.error('Error in packet loss test:', error);
      // Critical error indicates connectivity problems
      console.warn('Critical error in packet loss test - reporting as connectivity issue');
      // Report 100% packet loss to indicate a connection problem
      resolve(100);
    }
  });
};

// Constants for speed test
const TEST_DURATION_MS = 10000; // 10 seconds
const UPDATE_INTERVAL_MS = 200; // Update progress every 200ms
const DOWNLOAD_CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunk size for download
const UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk size for upload
const MAX_CHUNKS = 5; // Maximum number of chunks to download/upload

// Measure download/upload speed - real implementation
export const measureSpeed = async (
  type: 'download' | 'upload',
  progressCallback: (progress: number, dataAmount: number) => void
): Promise<number> => {
  try {
    const startTime = Date.now();
    let bytesTransferred = 0;
    let currentSpeed = 0;
    let progress = 0;
    
    // For accurate progress reporting
    const updateInterval = setInterval(() => {
      const elapsedSecs = (Date.now() - startTime) / 1000;
      if (elapsedSecs > 0) {
        // Calculate current speed in Mbps (megabits per second)
        currentSpeed = (bytesTransferred * 8) / elapsedSecs / 1024 / 1024;
        
        // Calculate progress percentage
        progress = Math.min(100, ((Date.now() - startTime) / TEST_DURATION_MS) * 100);
        
        // Report progress and data amount (in MB)
        progressCallback(progress, bytesTransferred / 1024 / 1024);
      }
    }, UPDATE_INTERVAL_MS);
    
    const clearUpdateInterval = () => {
      clearInterval(updateInterval);
      // Ensure we report 100% at the end
      progressCallback(100, bytesTransferred / 1024 / 1024);
    };
    
    try {
      if (type === 'download') {
        // Download test
        console.log('Starting real download speed test');
        
        // Track concurrent downloads
        const downloads = [];
        const chunkSizeParam = `?size=${DOWNLOAD_CHUNK_SIZE}`;
        
        // Start multiple concurrent downloads to saturate the connection
        for (let i = 0; i < MAX_CHUNKS; i++) {
          const downloadPromise = fetch(`/api/speedtest/download${chunkSizeParam}`).then(async response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body?.getReader();
            if (!reader) throw new Error('ReadableStream not supported');
            
            let done = false;
            while (!done && (Date.now() - startTime) < TEST_DURATION_MS) {
              const result = await reader.read();
              done = result.done;
              if (result.value) {
                bytesTransferred += result.value.length;
              }
            }
            
            // Close the reader if we're done with the test duration
            if (!done) {
              await reader.cancel();
            }
          });
          
          downloads.push(downloadPromise);
        }
        
        // Wait for all downloads to finish or for max duration to be reached
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS));
        await Promise.race([Promise.all(downloads), timeoutPromise]);
        
      } else if (type === 'upload') {
        // Upload test
        console.log('Starting real upload speed test');
        
        // Create a buffer with random data to upload
        const generateRandomData = (size: number) => {
          const buffer = new ArrayBuffer(size);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < size; i++) {
            view[i] = Math.floor(Math.random() * 256);
          }
          return buffer;
        };
        
        // Generate a chunk of random data
        const chunk = generateRandomData(UPLOAD_CHUNK_SIZE);
        
        // Track concurrent uploads
        const uploads = [];
        
        // Start multiple concurrent uploads
        for (let i = 0; i < MAX_CHUNKS; i++) {
          const uploadPromise = (async () => {
            const startChunkTime = Date.now();
            
            // Continue uploading chunks until the test duration is reached
            while (Date.now() - startTime < TEST_DURATION_MS) {
              const response = await fetch('/api/speedtest/upload', {
                method: 'POST',
                body: chunk,
                headers: {
                  'Content-Type': 'application/octet-stream',
                }
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              bytesTransferred += chunk.byteLength;
            }
          })();
          
          uploads.push(uploadPromise);
        }
        
        // Wait for all uploads to finish or timeout
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS));
        await Promise.race([Promise.all(uploads), timeoutPromise]);
      }
    } catch (error) {
      console.error(`Error during ${type} speed test:`, error);
      throw error;
    } finally {
      // Clean up and report final speed
      clearUpdateInterval();
    }
    
    // Calculate final speed
    const elapsedSecs = (Date.now() - startTime) / 1000;
    const finalSpeedMbps = (bytesTransferred * 8) / elapsedSecs / 1024 / 1024;
    
    console.log(`${type} test completed: ${bytesTransferred} bytes in ${elapsedSecs.toFixed(2)}s = ${finalSpeedMbps.toFixed(2)} Mbps`);
    
    return parseFloat(finalSpeedMbps.toFixed(2));
  } catch (error) {
    console.error(`Error measuring ${type} speed:`, error);
    throw error;
  }
};

// In a real implementation, we would have additional functions:
// 1. measureActualPacketLoss() - sends UDP packets and checks how many reach the server
// 2. calculateJitter() - measures variation in ping over time
// 3. getIpInfo() - fetches IP geolocation data from an API
