import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import { StreamStarLogo } from "@/components/StreamStarLogo";
import { validatePasswordStrength } from "@/lib/password";

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Password validation state
  const [passwordChecks, setPasswordChecks] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSymbol: false,
  });

  useEffect(() => {
    const checkPassword = (password: string) => {
      setPasswordChecks({
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      });
    };
    checkPassword(newPassword);
  }, [newPassword]);

  useEffect(() => {
    const hydrateRecoverySession = async () => {
      // Check URL hash and query params for recovery token
      const fullHash = window.location.hash;
      const hashParams = new URLSearchParams(fullHash.replace(/^#/, ""));
      
      // Try to get tokens from hash first, then query params
      const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
      const type = hashParams.get("type") ?? searchParams.get("type");
      const errorCode = hashParams.get("error_code") ?? searchParams.get("error_code");
      const errorDescription = hashParams.get("error_description") ?? searchParams.get("error_description");

      console.log("[UPDATE_PASSWORD] URL analysis:", { 
        fullUrl: window.location.href,
        hash: fullHash,
        hasAccessToken: !!accessToken, 
        type,
        errorCode,
        errorDescription,
        hashLength: fullHash.length 
      });

      // Check for Supabase error in redirect
      if (errorCode || errorDescription) {
        console.error("[UPDATE_PASSWORD] Supabase redirect error:", { errorCode, errorDescription });
        setTokenError(`O link expirou ou é inválido. ${errorDescription || "Solicite um novo link de recuperação."}`);
        setChecking(false);
        return;
      }

      // If hash is just "#" or empty, no token was provided
      if (!accessToken) {
        // Check if there's an active session already (user might have been redirected with session)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log("[UPDATE_PASSWORD] Found active session, allowing password update");
          setHasValidSession(true);
          setChecking(false);
          return;
        }
        
        setTokenError("O link de redefinição está incompleto ou foi cortado. Por favor, clique diretamente no botão do email ou copie o link completo.");
        setChecking(false);
        return;
      }

      if (type !== "recovery") {
        setTokenError("Este link não é válido para redefinição de senha. Solicite um novo link de recuperação.");
        setChecking(false);
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? accessToken,
        });

        if (error) {
          console.error("[UPDATE_PASSWORD] Session error:", error);
          setTokenError("O link expirou ou já foi utilizado. Os links de recuperação são válidos por tempo limitado. Solicite um novo link.");
        } else {
          console.log("[UPDATE_PASSWORD] Session established successfully");
          setHasValidSession(true);
        }
      } catch (err) {
        console.error("[UPDATE_PASSWORD] Unexpected error:", err);
        setTokenError("Erro ao validar o link. Tente novamente.");
      }
      
      setChecking(false);
    };

    hydrateRecoverySession();
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      toast({
        title: "Senha não atende aos requisitos",
        description: validation.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "As senhas não coincidem",
        description: "Digite a mesma senha nos dois campos.",
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
        description: "Você será redirecionado para o login.",
      });

      // Small delay then redirect to login
      setTimeout(() => {
        navigate("/auth");
      }, 1500);
    } catch (error: unknown) {
      console.error("[UPDATE_PASSWORD] Update error:", error);
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

  const allChecksPass = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-muted-foreground animate-pulse">Verificando link de recuperação...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <StreamStarLogo size="large" />
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Nova Senha</CardTitle>
            <CardDescription>
              {hasValidSession 
                ? "Escolha uma senha segura para sua conta."
                : "Não foi possível validar seu link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tokenError ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">{tokenError}</p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate("/reset-password")}
                >
                  Solicitar novo link
                </Button>
                <Link
                  to="/auth"
                  className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={updating}
                      className="pr-10"
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

                {/* Password requirements checklist */}
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground mb-2">A senha deve conter:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <div className={`flex items-center gap-1 ${passwordChecks.minLength ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>Mínimo 8 caracteres</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasUppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>Letra maiúscula</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasLowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>Letra minúscula</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasNumber ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>Número</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasSymbol ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.hasSymbol ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>Símbolo (!@#$%...)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Digite novamente a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={updating}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs ${passwordsMatch ? 'text-green-500' : 'text-destructive'}`}>
                      {passwordsMatch ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={updating || !allChecksPass || !passwordsMatch}
                >
                  {updating ? "Atualizando..." : "Redefinir Senha"}
                </Button>

                <Link
                  to="/auth"
                  className="flex items-center justify-center gap-2 mt-4 text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para Login
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdatePassword;