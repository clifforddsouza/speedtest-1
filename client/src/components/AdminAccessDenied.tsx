import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function AdminAccessDenied() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Access Denied</CardTitle>
          <CardDescription>
            Your account does not have administrator privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">
            To access the admin dashboard, you need an account with admin privileges.
            Please contact your system administrator for assistance.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="default"
            onClick={() => setLocation("/")}
          >
            Return to Home Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}