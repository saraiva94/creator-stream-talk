import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Video, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthApiError } from "@supabase/supabase-js";

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

type AuthMode = "login" | "forgotPassword";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const siteUrl = useMemo(
    () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, ""),
    [],
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta.",
      });

      navigate("/");
    } catch (error: unknown) {
      if (error instanceof AuthApiError) {
        if (
          error.code === "email_not_confirmed" ||
          (error.message && error.message.toLowerCase().includes("confirm"))
        ) {
          toast({
            title: "E-mail não confirmado",
            description: "Verifique seu e-mail para ativar a conta antes de entrar.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (error.status === 400 || error.status === 403) {
          toast({
            title: "E-mail ou senha inválidos",
            description: "Confira as credenciais e tente novamente.",
            variant: "destructive",
          });
          setLoading(false);
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

  const handleSendResetLink = async () => {
    if (!resetEmail) {
      setResetError("Digite o e-mail cadastrado para recuperar a senha.");
      setResetSuccess(null);
      return;
    }

    const emailValid = /\S+@\S+\.\S+/.test(resetEmail);
    if (!emailValid) {
      setResetError("Digite um e-mail válido.");
      setResetSuccess(null);
      return;
    }

    setResetError(null);
    setResetSuccess(null);
    setResetLoading(true);
    try {
      const redirectTo = `${siteUrl}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo });
      if (error) {
        if (error.message.toLowerCase().includes("not found")) {
          setResetError("Esse e-mail não está cadastrado. Verifique se digitou corretamente.");
        } else {
          setResetError("Não foi possível enviar o link de recuperação. Tente novamente.");
        }
        return;
      }

      setResetSuccess("Enviamos um link de recuperação para o seu e-mail.");
    } catch (error) {
      console.error("[AUTH][RESET_LINK]", error);
      setResetError("Não foi possível enviar o link de recuperação. Tente novamente.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleSwitchToReset = () => {
    setMode("forgotPassword");
    setResetEmail(email);
    setResetError(null);
    setResetSuccess(null);
  };

  const handleBackToLogin = () => {
    setMode("login");
    setResetEmail("");
    setResetError(null);
    setResetSuccess(null);
    setResetLoading(false);
  };

  const renderLoginForm = () => (
    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">{t.auth.email}</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={handleSwitchToReset}
          disabled={loading}
        >
          {t.auth.forgotPassword}
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t.auth.loading : t.auth.loginButton}
      </Button>
    </form>
  );

  const renderForgotPasswordForm = () => (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Coloque o e-mail do cadastro para recuperar a senha.
      </p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input
          id="reset-email"
          type="email"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          placeholder="seu@email.com"
          disabled={resetLoading}
        />
      </div>
      {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
      {resetSuccess ? <p className="text-sm text-success">{resetSuccess}</p> : null}
      <Button onClick={handleSendResetLink} className="w-full" disabled={resetLoading}>
        {resetLoading ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
      <button type="button" className="text-sm text-primary hover:underline" onClick={handleBackToLogin}>
        Voltar para o login
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center p-4 pt-24">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
      
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <Video className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-primary">Stream Star</h1>
          </div>

          <Card className="border-border shadow-gold">
            <CardHeader>
              <CardTitle>{t.auth.welcome}</CardTitle>
              <CardDescription>Connect with creators streaming live</CardDescription>
            </CardHeader>
            <CardContent>
              {mode === "login" ? renderLoginForm() : renderForgotPasswordForm()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
