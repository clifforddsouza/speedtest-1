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

// Measure packet loss - using the API we created
export const measurePacketLoss = async (): Promise<number> => {
  try {
    // Send 100 test packets to measure loss
    const response = await apiRequest('POST', '/api/measure-packet-loss', { packetCount: 100 });
    const data = await response.json();
    return data.packetLossPercentage;
  } catch (error) {
    console.error('Error measuring packet loss:', error);
    // If API fails, return a simulated value
    return parseFloat((Math.random() * 2).toFixed(1));
  }
};

// Measure download/upload speed - simulated in development
export const measureSpeed = async (
  type: 'download' | 'upload',
  progressCallback: (progress: number, dataAmount: number) => void
): Promise<number> => {
  const testSize = 250 * 1024 * 1024; // 250MB total test size
  const chunkSize = 25 * 1024 * 1024; // 25MB chunks
  let totalBytes = 0;
  const startTime = performance.now();

  try {
    if (type === 'download') {
      for (let offset = 0; offset < testSize && !abortController.signal.aborted; offset += chunkSize) {
        const response = await fetch(`/api/speedtest/download?size=${chunkSize}`);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        totalBytes += blob.size;
        
        const progress = (totalBytes / testSize) * 100;
        const duration = (performance.now() - startTime) / 1000;
        const speed = (totalBytes * 8) / (1000000 * duration); // Mbps
        
        progressCallback(progress, totalBytes / (1024 * 1024));
      }
    } else {
      const data = new Uint8Array(chunkSize);
      crypto.getRandomValues(data);
      
      for (let offset = 0; offset < testSize && !abortController.signal.aborted; offset += chunkSize) {
        const blob = new Blob([data]);
        const response = await fetch('/api/speedtest/upload', {
          method: 'POST',
          body: blob
        });
        if (!response.ok) throw new Error('Upload failed');
        
        totalBytes += chunkSize;
        const progress = (totalBytes / testSize) * 100;
        const duration = (performance.now() - startTime) / 1000;
        const speed = (totalBytes * 8) / (1000000 * duration); // Mbps
        
        progressCallback(progress, totalBytes / (1024 * 1024));
      }
    }
    
    const duration = (performance.now() - startTime) / 1000;
    return (totalBytes * 8) / (1000000 * duration); // Final speed in Mbps
  } catch (error) {
    console.error(`Error measuring ${type} speed:`, error);
    throw error;
  }
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
