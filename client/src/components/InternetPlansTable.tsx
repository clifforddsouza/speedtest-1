import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, Wifi } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type InternetPlan, insertInternetPlanSchema } from "@shared/schema";
import { z } from "zod";

// Form validation schema
const planFormSchema = insertInternetPlanSchema.extend({
  downloadSpeed: z.coerce.number().min(0, "Download speed must be a positive number"),
  uploadSpeed: z.coerce.number().min(0, "Upload speed must be a positive number"),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

export default function InternetPlansTable() {
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingPlan, setEditingPlan] = useState<InternetPlan | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<InternetPlan | null>(null);
  const { toast } = useToast();

  // Fetch all internet plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ["/api/internet-plans"],
    queryFn: async () => {
      const res = await fetch("/api/internet-plans");
      if (!res.ok) {
        throw new Error("Failed to fetch internet plans");
      }
      return res.json() as Promise<InternetPlan[]>;
    }
  });

  // Form for create/edit
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      downloadSpeed: 0,
      uploadSpeed: 0,
      description: "",
      isActive: true
    }
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormValues) => {
      const res = await apiRequest("POST", "/api/internet-plans", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Internet plan created successfully",
      });
      setOpenDialog(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/internet-plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create internet plan",
        variant: "destructive"
      });
    }
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PlanFormValues> }) => {
      const res = await apiRequest("PUT", `/api/internet-plans/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Internet plan updated successfully",
      });
      setOpenDialog(false);
      setEditingPlan(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/internet-plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update internet plan",
        variant: "destructive"
      });
    }
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/internet-plans/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Internet plan deleted successfully",
      });
      setDeleteConfirmOpen(false);
      setPlanToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/internet-plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete internet plan",
        variant: "destructive"
      });
    }
  });

  const handleCreatePlan = () => {
    setDialogMode("create");
    form.reset({
      name: "",
      downloadSpeed: 0,
      uploadSpeed: 0,
      description: "",
      isActive: true
    });
    setOpenDialog(true);
  };

  const handleEditPlan = (plan: InternetPlan) => {
    setDialogMode("edit");
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      downloadSpeed: plan.downloadSpeed,
      uploadSpeed: plan.uploadSpeed,
      description: plan.description || "",
      isActive: plan.isActive
    });
    setOpenDialog(true);
  };

  const handleDeletePlan = (plan: InternetPlan) => {
    setPlanToDelete(plan);
    setDeleteConfirmOpen(true);
  };

  const onSubmit = (data: PlanFormValues) => {
    if (dialogMode === "create") {
      createPlanMutation.mutate(data);
    } else if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    }
  };

  const confirmDelete = () => {
    if (planToDelete) {
      deletePlanMutation.mutate(planToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Internet Plans</h2>
        <Button onClick={handleCreatePlan} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Plan</span>
        </Button>
      </div>

      {!plans || plans.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <Wifi className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Internet Plans Available</h3>
          <p className="text-gray-500 mb-4">Add your first internet plan to offer to customers.</p>
          <Button onClick={handleCreatePlan} variant="secondary">Add Plan</Button>
        </div>
      ) : (
        <Table>
          <TableCaption>Available internet plans for customers</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Download Speed</TableHead>
              <TableHead>Upload Speed</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>{plan.downloadSpeed} Mbps</TableCell>
                <TableCell>{plan.uploadSpeed} Mbps</TableCell>
                <TableCell className="max-w-xs truncate">{plan.description}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditPlan(plan)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(plan)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Add New Internet Plan" : "Edit Internet Plan"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create" 
                ? "Create a new internet plan that customers can select during speed tests." 
                : "Update the details of this internet plan."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Basic 50Mbps, Premium 1Gbps" />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this internet plan
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="downloadSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Download Speed (Mbps)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="0.1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="uploadSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upload Speed (Mbps)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="0.1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description of the plan features" 
                        onChange={field.onChange}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive plans won't appear in customer dropdowns
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpenDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                >
                  {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    dialogMode === "create" ? "Create Plan" : "Update Plan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the plan "{planToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deletePlanMutation.isPending}
            >
              {deletePlanMutation.isPending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                  Deleting...
                </>
              ) : (
                "Delete Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}