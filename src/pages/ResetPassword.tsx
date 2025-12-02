import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Video, ArrowLeft } from "lucide-react";
import { validatePasswordStrength } from "@/lib/password";
import { siteUrl } from "@/lib/siteUrl";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hydrateRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
      const type = hashParams.get("type") ?? searchParams.get("type");

      if (!accessToken) {
        setHasRecoverySession(false);
        setTokenError(null);
        setChecking(false);
        return;
      }

      if (type !== "recovery") {
        setTokenError("Link de redefinição inválido ou expirado.");
        setChecking(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? accessToken,
      });

      if (error) {
        console.error("[AUTH][RESET][SET_SESSION]", { error, accessToken });
        setTokenError("Não foi possível validar o link de redefinição.");
      } else {
        setHasRecoverySession(true);
      }
      setChecking(false);
    };

    hydrateRecoverySession();
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasRecoverySession) {
      toast({
        title: "Link inválido",
        description: "Solicite um novo link de redefinição.",
        variant: "destructive",
      });
      return;
    }

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
        description: "Confirme a senha corretamente.",
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
        title: "Senha redefinida com sucesso",
        description: "Você já pode fazer login.",
      });

      navigate("/auth");
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

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestMessage(null);

    if (!requestEmail) {
      setRequestError("Digite o e-mail cadastrado para recuperar a senha.");
      return;
    }

    const emailValid = /\S+@\S+\.\S+/.test(requestEmail);
    if (!emailValid) {
      setRequestError("Digite um e-mail válido.");
      return;
    }

    setRequesting(true);
    try {
      const redirectTo = `${siteUrl}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(requestEmail, { redirectTo });

      if (error) {
        if (error.message.toLowerCase().includes("not found")) {
          setRequestError("Esse e-mail não está cadastrado. Verifique se digitou corretamente.");
        } else {
          setRequestError("Não foi possível enviar o link de recuperação. Tente novamente.");
        }
        return;
      }

      setRequestMessage("Enviamos um link de recuperação para o seu e-mail.");
    } catch (error) {
      console.error("[AUTH][RESET_LINK]", error);
      setRequestError("Não foi possível enviar o link de recuperação. Tente novamente.");
    } finally {
      setRequesting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-muted-foreground animate-pulse">Verificando link...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Video className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-4xl font-bold text-primary">Stream Star</h1>
        </div>

        <Card className="border-border shadow-gold">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>
              {hasRecoverySession
                ? "Escolha uma nova senha segura para sua conta."
                : "Envie seu e-mail para receber o link de redefinição."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRecoverySession ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="********"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={updating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 8 caracteres, com maiúscula, minúscula, número e símbolo.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={updating}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={updating}>
                  {updating ? "Atualizando..." : "Atualizar senha"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                  disabled={updating}
                >
                  Ir para login
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail cadastrado</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    disabled={requesting}
                  />
                </div>
                {tokenError ? <p className="text-sm text-destructive">{tokenError}</p> : null}
                {requestError ? <p className="text-sm text-destructive">{requestError}</p> : null}
                {requestMessage ? <p className="text-sm text-success">{requestMessage}</p> : null}
                <Button type="submit" className="w-full" disabled={requesting}>
                  {requesting ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
              </form>
            )}

            <Link
              to="/auth"
              className="flex items-center justify-center gap-2 mt-6 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
