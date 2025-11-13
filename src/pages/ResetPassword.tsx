import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Video, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Video className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-4xl font-bold text-primary">
            Stream Live Hub
          </h1>
        </div>

        <Card className="border-border shadow-gold">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              {sent 
                ? "We've sent you an email with instructions to reset your password."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Try Again
                </Button>
              </div>
            )}
            
            <Link to="/auth" className="flex items-center justify-center gap-2 mt-6 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
