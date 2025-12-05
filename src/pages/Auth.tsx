import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { StreamStarLogo } from "@/components/StreamStarLogo";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthApiError } from "@supabase/supabase-js";
import { ApiError, api } from "@/lib/api";

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

const Auth = () => {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

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
    if (!loginInput || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let emailToUse = loginInput;
      
      // If input doesn't look like email, try to resolve username
      if (!loginInput.includes("@")) {
        try {
          const resolved = await api.auth.resolveUsername(loginInput);
          emailToUse = resolved.email;
        } catch {
          // Fallback: query profiles table directly for username
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .ilike("username", loginInput)
            .maybeSingle();
          
          if (profileError || !profileData) {
            toast({
              title: "Usuário não encontrado",
              description: "Verifique o nome de usuário e tente novamente.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          
          // Get email from auth.users via admin or use profile id for lookup
          // Since we can't access auth.users, we need to check if email exists
          // For now, show error asking user to use email
          toast({
            title: "Use seu email",
            description: "Por favor, faça login usando seu endereço de email.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
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
      if (error instanceof ApiError) {
        const message = error.status === 404 ? "Usuário não encontrado" : error.message;
        toast({
          title: "Erro no login",
          description: message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
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

  const renderLoginForm = () => (
    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="text"
          placeholder="seu@email.com"
          value={loginInput}
          onChange={(e) => setLoginInput(e.target.value)}
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
    </form>
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
            <StreamStarLogo size="large" />
          </div>

          <Card className="border-border shadow-gold">
            <CardHeader>
              <CardTitle>{t.auth.welcome}</CardTitle>
              <CardDescription>Connect with creators streaming live</CardDescription>
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
