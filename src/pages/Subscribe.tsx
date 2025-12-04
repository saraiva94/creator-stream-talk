import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validatePasswordStrength } from "@/lib/password";
import { registrationCheckout, validateAffiliateCode } from "@/lib/supabaseApi";

const Subscribe = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<{ referral?: string }>({});

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSubscribe = async () => {
    const trimmedReferral = referralCode.trim();

    if (!fullName.trim()) {
      toast({ title: "Nome obrigatório", description: "Preencha seu nome completo.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(email)) {
      toast({ title: "E-mail inválido", description: "Informe um e-mail válido.", variant: "destructive" });
      return;
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      toast({
        title: "Senha não atende aos requisitos",
        description: passwordCheck.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "As senhas não conferem",
        description: "Confirme a senha corretamente antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedReferral) {
      setErrors({ referral: "Você precisa de um código de indicação para se cadastrar." });
      return;
    }

    setErrors({});

    if (!acceptTerms) {
      toast({
        title: "Confirme os termos",
        description: "É necessário aceitar os termos para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const validation = await validateAffiliateCode(trimmedReferral);
      if (!validation.valid) {
        setErrors({ referral: "Código de indicação inválido." });
        setLoading(false);
        return;
      }

      const response = await registrationCheckout({
        fullName: fullName.trim(),
        email,
        password,
        referralCode: trimmedReferral,
        acceptTerms,
      });

      if (response.token && response.refresh_token) {
        await supabase.auth.setSession({
          access_token: response.token,
          refresh_token: response.refresh_token,
        });
        toast({ title: "Cadastro concluído", description: "Bem-vindo!" });
        navigate("/dashboard");
        return;
      }

      if (response.init_point) {
        window.location.assign(response.init_point);
        return;
      }

      toast({
        title: "Cadastro enviado",
        description: "Se houver pagamento, você será redirecionado.",
      });
    } catch (error: unknown) {
      console.error("[subscribe] checkout error", error);
      const err = error as Error;
      const message =
        err?.message?.includes("email") || err?.message?.includes("already")
          ? "E-mail já cadastrado."
          : err?.message || "Erro ao processar pagamento. Tente novamente em alguns instantes.";
      toast({
        title: "Erro ao processar assinatura",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Cadastro e Assinatura</h1>
            <p className="text-xl text-muted-foreground">
              Preencha seus dados para concluir o cadastro e acessar tudo.
            </p>
          </div>

          <Card className="p-6 border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
              Cadastro
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Nome completo *</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referral">Código de indicação *</Label>
                  <Input
                    id="referral"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="Digite seu código ou use o link recebido"
                    disabled={loading}
                  />
                  {errors.referral ? <p className="text-sm text-destructive">{errors.referral}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="accept-terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="h-4 w-4"
                  disabled={loading}
                />
                <Label htmlFor="accept-terms" className="text-sm">
                  Li e aceito os termos.
                </Label>
              </div>

              <Card className="p-4 border-primary">
                <h3 className="text-lg font-semibold mb-1">Taxa de Ativação</h3>
                <p className="text-2xl font-bold">R$ 5,00</p>
                <div className="space-y-2 text-sm text-muted-foreground mt-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5" />
                    <span>Ativação única para acesso completo às lives</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5" />
                    <span>Participa da rede de afiliados (pai e avô)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5" />
                    <span>Chat ao vivo e sem anúncios</span>
                  </div>
                </div>
              </Card>

              <Button className="w-full" onClick={handleSubscribe} disabled={loading}>
                {loading ? "Processando..." : "Pagar R$ 5,00 e concluir cadastro"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Pagamento seguro via Mercado Pago (Pix ou cartão). Ao continuar, você confirma que aceita os termos e
                condições.
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Cancele a qualquer momento. Sem compromisso.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Subscribe;
