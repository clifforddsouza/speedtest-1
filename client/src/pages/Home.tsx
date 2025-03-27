import { useState } from "react";
import { Link } from "wouter";
import CustomerForm from "@/components/CustomerForm";
import SpeedTestPanel from "@/components/SpeedTestPanel";
import TestResultsPanel from "@/components/TestResultsPanel";
import ResultsDetailModal from "@/components/ResultsDetailModal";
import type { SpeedTest } from "@shared/schema";

export default function Home() {
  const [customerId, setCustomerId] = useState<string>("");
  const [testLocation, setTestLocation] = useState<string>("");
  const [internetPlan, setInternetPlan] = useState<string>("not_specified");
  const [selectedTest, setSelectedTest] = useState<SpeedTest | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const handleViewDetailedResults = (test: SpeedTest) => {
    setSelectedTest(test);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 inline mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M13 10V3L4 14h7v7l9-11h-7z" 
                />
              </svg>
              Enhanced LibreSpeed
            </h1>
            <span className="ml-2 text-xs bg-primary text-white px-2 py-1 rounded-full">+ Packet Loss</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              <span>Server: Chicago, IL</span>
            </div>
            <Link href="/admin/login" className="bg-primary text-white px-3 py-1 rounded text-sm font-medium hover:bg-opacity-90 transition-colors">
              Admin Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CustomerForm 
          customerId={customerId}
          testLocation={testLocation}
          internetPlan={internetPlan}
          onCustomerIdChange={setCustomerId}
          onTestLocationChange={setTestLocation}
          onInternetPlanChange={setInternetPlan}
        />
        
        <SpeedTestPanel customerId={customerId} testLocation={testLocation} internetPlan={internetPlan} />
        
        <TestResultsPanel onViewDetails={handleViewDetailedResults} />

        {showModal && selectedTest && (
          <ResultsDetailModal test={selectedTest} onClose={handleCloseModal} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-600">
                Enhanced LibreSpeed with Packet Loss Measurement
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <a href="#" className="text-sm text-gray-600 hover:text-primary">About</a>
              <a href="#" className="text-sm text-gray-600 hover:text-primary">Privacy Policy</a>
              <a href="https://github.com/librespeed/speedtest" className="text-sm text-gray-600 hover:text-primary" target="_blank" rel="noopener noreferrer">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 inline mr-1" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
