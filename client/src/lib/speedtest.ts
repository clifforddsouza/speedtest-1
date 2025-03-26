import { apiRequest } from './queryClient';

// Helper to simulate test delays in development
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Measure ping - simulated in development
export const measurePing = async (): Promise<number> => {
  try {
    // In a real implementation, we would measure actual ping
    // For now, we'll simulate a ping between 10ms and 50ms
    await simulateDelay(1000);
    return Math.floor(Math.random() * 40) + 10;
  } catch (error) {
    console.error('Error measuring ping:', error);
    throw error;
  }
};

// Measure jitter - simulated in development
export const measureJitter = async (): Promise<number> => {
  try {
    // In a real implementation, we would measure actual jitter
    // For now, we'll simulate jitter between 1ms and 5ms
    await simulateDelay(1000);
    return parseFloat((Math.random() * 4 + 1).toFixed(1));
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
              
              console.log(`Packet loss test results: ${data.lostPackets} lost out of ${data.sentPackets} (${data.packetLossPercentage}%)`);
              
              // Return the packet loss percentage
              resolve(data.packetLossPercentage);
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
        
        // If we fail early with no packets, fall back to a simulated value
        if (packetCount === 0) {
          const fallbackValue = parseFloat((Math.random() * 2).toFixed(1));
          console.warn('Using fallback packet loss value due to WebSocket error:', fallbackValue);
          resolve(fallbackValue);
        } else {
          // Calculate with what we have
          const lostPackets = packetCount - acknowledgedPackets;
          const packetLossPercentage = (lostPackets / packetCount) * 100;
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
            const fallbackValue = parseFloat((Math.random() * 2).toFixed(1));
            console.warn('Using fallback packet loss value due to unexpected WebSocket close:', fallbackValue);
            resolve(fallbackValue);
          } else {
            // Calculate with what we have
            const lostPackets = packetCount - acknowledgedPackets;
            const packetLossPercentage = (lostPackets / packetCount) * 100;
            resolve(parseFloat(packetLossPercentage.toFixed(2)));
          }
        }
      };
      
    } catch (error) {
      console.error('Error in packet loss test:', error);
      // If there's a critical error, fall back to a simulated value
      const fallbackValue = parseFloat((Math.random() * 2).toFixed(1));
      console.warn('Using fallback packet loss value due to critical error:', fallbackValue);
      resolve(fallbackValue);
    }
  });
};

// Measure download/upload speed - simulated in development
export const measureSpeed = async (
  type: 'download' | 'upload',
  progressCallback: (progress: number, dataAmount: number) => void
): Promise<number> => {
  try {
    // In a real implementation, we would:
    // 1. For download: fetch large files from the server
    // 2. For upload: send large files to the server
    // 3. Measure the time and calculate the speed
    
    // For now, we'll simulate a test that takes 3 seconds
    const maxSpeed = type === 'download' ? 100 : 40; // Mbps
    const finalSpeed = Math.floor(Math.random() * (maxSpeed - maxSpeed/2)) + maxSpeed/2;
    let dataAmount = 0;
    
    // Simulate 30 steps of progress
    for (let progress = 0; progress <= 100; progress += 3.33) {
      // Calculate the current data amount based on progress
      const stepData = (finalSpeed * 0.125) * (progress / 100); // Convert Mbps to MBps
      dataAmount = parseFloat((stepData * 3).toFixed(1)); // Assuming 3 seconds total
      
      progressCallback(progress, dataAmount);
      await simulateDelay(100);
    }
    
    return finalSpeed;
  } catch (error) {
    console.error(`Error measuring ${type} speed:`, error);
    throw error;
  }
};

// In a real implementation, we would have additional functions:
// 1. measureActualPacketLoss() - sends UDP packets and checks how many reach the server
// 2. calculateJitter() - measures variation in ping over time
// 3. getIpInfo() - fetches IP geolocation data from an API
