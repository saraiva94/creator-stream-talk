import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Video, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteUrl = useMemo(
    () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, ""),
    []
  );

  const validatePassword = (pwd: string): boolean => pwd.length >= 8;

  useEffect(() => {
    const hydrateRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[AUTH][RESET][EXCHANGE_CODE]", { error, code });
          toast({
            title: "Recovery link error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setHasRecoverySession(!!data.session);
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("[AUTH][RESET][SET_SESSION]", { error, accessToken });
          toast({
            title: "Recovery link error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setHasRecoverySession(!!data.session);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setHasRecoverySession(!!data.session);
    };

    hydrateRecoverySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(!!session);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [searchParams, toast]);

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
      // Ensure this route is configured in Supabase auth redirect URLs.
      const redirectTo = `${siteUrl}/auth/reset-password`;
      console.info("[AUTH][RESET][REQUEST]", { email, redirectTo });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "E-mail enviado!",
        description: "Se o e-mail estiver cadastrado, enviamos instruções para redefinir a senha.",
      });
    } catch (error: unknown) {
      console.error("[AUTH][RESET][REQUEST_ERROR]", { error, email });
      const message = error instanceof Error ? error.message : "Não foi possível enviar o e-mail. Tente novamente.";
      toast({
        title: "Erro ao enviar e-mail",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        title: "Password required",
        description: "Please fill in both password fields.",
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(newPassword)) {
      toast({
        title: "Weak password",
        description: "Password must have 8+ characters, 1 uppercase, 1 number, 1 symbol.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please confirm your password correctly.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Senha redefinida com sucesso!",
        description: "Você já pode fazer login.",
      });

      setTimeout(() => navigate("/auth"), 1500);
    } catch (error: unknown) {
      console.error("[AUTH][RESET][UPDATE_ERROR]", error);
      const message =
        typeof error === "object" && error && "message" in error
          ? (error as { message?: string }).message || "Erro ao atualizar senha."
          : "Erro ao atualizar senha.";

      toast({
        title: "Erro ao atualizar senha",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Video className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-4xl font-bold text-primary">
            Stream Star
          </h1>
        </div>

        <Card className="border-border shadow-gold">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              {hasRecoverySession
                ? "Choose a new password for your account."
                : sent
                  ? "We've sent you an email with instructions to reset your password."
                  : "Enter your email address and we'll send you a link to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRecoverySession ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="********"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={updating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={updating}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updating}
                >
                  {updating ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                  disabled={updating}
                >
                  Go to Login
                </Button>
              </form>
            ) : (
              <>
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
              </>
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
