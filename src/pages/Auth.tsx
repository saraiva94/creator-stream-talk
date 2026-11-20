import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  AuthApiError,
  AuthRetryableFetchError,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { getReturnTo, clearReturnTo } from "@/components/ProtectedRoute";

type ErrorWithMessage = {
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as ErrorWithMessage).message === "string"
  ) {
    return (error as ErrorWithMessage).message ?? fallback;
  }
  return fallback;
};

const isFunctionsUnavailable = (error: unknown) =>
  error instanceof FunctionsFetchError ||
  error instanceof FunctionsRelayError ||
  (error instanceof FunctionsHttpError && error.context.status >= 500);

const Auth = () => {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const continueRegistration = searchParams.get("continue") === "registration";
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      const returnTo = getReturnTo();
      clearReturnTo();
      navigate(continueRegistration ? "/subscribe" : returnTo || "/", { replace: true });
    }
  }, [user, authLoading, navigate, continueRegistration]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setUnverifiedEmail(null);
    setLoading(true);
    try {
      const credential = loginInput.trim();

      // Email login stays client-side.
      if (credential.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({
          email: credential,
          password,
        });

        if (error) throw error;
      } else {
        // Username login goes through a backend function so we don't depend on public email lookups.
        const { data, error } = await supabase.functions.invoke("login-with-credential", {
          body: { credential, password },
        });

        const payload = data as
          | {
              access_token?: string;
              refresh_token?: string;
              error?: string;
              error_description?: string;
            }
          | null;

        if (isFunctionsUnavailable(error)) throw error;

        if (error || payload?.error) {
          const code = payload?.error;

          if (code === "USER_NOT_FOUND") {
            toast({
              title: "Usuário não encontrado",
              description: "Verifique o nome de usuário e tente novamente.",
              variant: "destructive",
            });
            return;
          }

          if (code === "email_not_confirmed") {
            toast({
              title: "E-mail não confirmado",
              description: "Verifique seu e-mail para ativar a conta antes de entrar.",
              variant: "destructive",
            });
            return;
          }

          // Default invalid credentials
          toast({
            title: "E-mail ou senha inválidos",
            description: "Confira as credenciais e tente novamente.",
            variant: "destructive",
          });
          return;
        }

        const access_token = payload?.access_token;
        const refresh_token = payload?.refresh_token;

        if (!access_token || !refresh_token) {
          throw new Error("Resposta inválida do servidor.");
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setSessionError) throw setSessionError;
      }

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta.",
      });

      // Redirect will be handled by useEffect when user state updates
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const message = error.status === 404 ? "Usuário não encontrado" : error.message;
        toast({
          title: "Erro no login",
          description: message,
          variant: "destructive",
        });
        return;
      }
      if (
        error instanceof AuthRetryableFetchError ||
        (error instanceof AuthApiError && error.status >= 500) ||
        isFunctionsUnavailable(error)
      ) {
        toast({
          title: "Erro no login",
          description: t.auth.serviceUnavailable,
          variant: "destructive",
        });
        return;
      }
      if (error instanceof AuthApiError) {
        if (
          error.code === "email_not_confirmed" ||
          (error.message && error.message.toLowerCase().includes("confirm"))
        ) {
          const email = loginInput.trim();
          if (email.includes("@")) setUnverifiedEmail(email);
          toast({
            title: "E-mail não confirmado",
            description: "Verifique seu e-mail para ativar a conta antes de entrar.",
            variant: "destructive",
          });
          return;
        }

        if (error.status === 400 || error.status === 403) {
          toast({
            title: "E-mail ou senha inválidos",
            description: "Confira as credenciais e tente novamente.",
            variant: "destructive",
          });
          return;
        }
      }

      const description = getErrorMessage(error, "Erro ao entrar. Verifique suas credenciais ou tente novamente.");

      toast({
        title: "Erro no login",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderLoginForm = () => (
    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">{t.auth.emailOrNickname || "Email ou nome de usuário"}</Label>
        <Input
          id="login-email"
          type="text"
          placeholder={t.auth.emailOrNicknamePlaceholder || "seu@email.com ou seu_usuario"}
          value={loginInput}
          onChange={(e) => {
            setLoginInput(e.target.value);
            setUnverifiedEmail(null);
          }}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t.auth.password}</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <Link to="/reset-password" className="text-primary hover:underline">
          {t.auth.forgotPassword}
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t.auth.loading : t.auth.loginButton}
      </Button>
      {unverifiedEmail && <ResendVerificationButton email={unverifiedEmail} />}
    </form>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isAdmin={isAdmin} />
      <div className="flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md">
          <Card className="border-border shadow-gold">
            <CardHeader>
              <CardTitle>{t.auth.welcome}</CardTitle>
              <CardDescription>{t.home?.subtitle || "Connect with creators streaming live"}</CardDescription>
            </CardHeader>
            <CardContent>
              {renderLoginForm()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
