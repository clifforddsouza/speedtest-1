import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InternetPlan, InternetPlanType } from "@shared/schema";

interface CustomerFormProps {
  customerId: string;
  testLocation: string;
  internetPlan: string;
  onCustomerIdChange: (customerId: string) => void;
  onTestLocationChange: (location: string) => void;
  onInternetPlanChange: (plan: string) => void;
}

export default function CustomerForm({
  customerId,
  testLocation,
  internetPlan,
  onCustomerIdChange,
  onTestLocationChange,
  onInternetPlanChange
}: CustomerFormProps) {
  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
      <form id="customerForm" className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">
              Customer ID
            </Label>
            <Input
              type="text"
              id="customerId"
              value={customerId}
              onChange={(e) => onCustomerIdChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter customer ID"
              required
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="testLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Test Location
            </Label>
            <Input
              type="text"
              id="testLocation"
              value={testLocation}
              onChange={(e) => onTestLocationChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="E.g., Office, Home, Client Site"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="internetPlan" className="block text-sm font-medium text-gray-700 mb-1">
              Internet Plan
            </Label>
            <Select value={internetPlan} onValueChange={onInternetPlanChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select internet plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_specified">Not specified</SelectItem>
                {Object.values(InternetPlan).map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {plan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </form>
    </div>
  );
}
