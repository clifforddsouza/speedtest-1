import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { type InternetPlan } from "@shared/schema";
import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);

  // Fetch available internet plans
  const { data: internetPlans, isLoading } = useQuery({
    queryKey: ["/api/internet-plans"],
    queryFn: async () => {
      const res = await fetch("/api/internet-plans");
      if (!res.ok) {
        throw new Error("Failed to fetch internet plans");
      }
      return res.json() as Promise<InternetPlan[]>;
    }
  });

  // Filter only active plans
  const activePlans = internetPlans?.filter(plan => plan.isActive) || [];

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
              Internet Plan <span className="text-red-500">*</span>
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={`w-full justify-between ${internetPlan === "not_specified" ? "border-red-300 ring-1 ring-red-300" : ""}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Loading plans..."
                  ) : internetPlan === "not_specified" ? (
                    "Not specified"
                  ) : internetPlan ? (
                    internetPlan
                  ) : (
                    "Select internet plan"
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <CommandInput placeholder="Search plan..." className="flex-1" />
                  </div>
                  <CommandEmpty>No internet plan found.</CommandEmpty>
                  <CommandGroup>
                    {/* The 'Not specified' option is disabled to encourage selection of an actual plan */}
                    <CommandItem
                      key="not_specified"
                      value="not_specified"
                      className="opacity-50 cursor-not-allowed"
                      disabled={true}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          internetPlan === "not_specified" ? "opacity-100" : "opacity-0"
                        )}
                      />
                      Not specified <span className="text-red-500 ml-2 text-xs">(Please select a valid plan)</span>
                    </CommandItem>
                    {activePlans.map((plan) => (
                      <CommandItem
                        key={plan.id}
                        value={plan.name}
                        onSelect={() => {
                          onInternetPlanChange(plan.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            internetPlan === plan.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {plan.name} ({plan.downloadSpeed}/{plan.uploadSpeed} Mbps)
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </form>
    </div>
  );
}
