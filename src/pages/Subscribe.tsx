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
import { logger } from "@/lib/logger";

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
    logger.register.info('Página de cadastro carregada');
    
    const getUser = async () => {
      logger.auth.debug('Verificando sessão existente');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        logger.auth.info('Usuário já logado', { userId: session.user.id, email: session.user.email });
      }
      setUser(session?.user || null);
    };
    getUser();

    const ref = searchParams.get("ref");
    if (ref) {
      logger.affiliate.info('Código de afiliado detectado na URL', { code: ref });
      setReferralCode(ref);
    } else {
      logger.affiliate.debug('Nenhum código de afiliado na URL');
    }
  }, [searchParams]);

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSubscribe = async () => {
    const trimmedReferral = referralCode.trim();

    logger.register.info('Iniciando processo de cadastro', {
      hasFullName: !!fullName.trim(),
      email: email,
      hasPassword: !!password,
      referralCode: trimmedReferral || 'VAZIO',
      acceptTerms,
    });

    if (!fullName.trim()) {
      logger.register.warn('Validação falhou: Nome vazio');
      toast({ title: "Nome obrigatório", description: "Preencha seu nome completo.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(email)) {
      logger.register.warn('Validação falhou: Email inválido', { email });
      toast({ title: "E-mail inválido", description: "Informe um e-mail válido.", variant: "destructive" });
      return;
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      logger.register.warn('Validação falhou: Senha fraca', { errors: passwordCheck.errors });
      toast({
        title: "Senha não atende aos requisitos",
        description: passwordCheck.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      logger.register.warn('Validação falhou: Senhas não conferem');
      toast({
        title: "As senhas não conferem",
        description: "Confirme a senha corretamente antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedReferral) {
      logger.register.warn('Validação falhou: Código de afiliado obrigatório não informado');
      setErrors({ referral: "Você precisa de um código de indicação para se cadastrar." });
      return;
    }

    setErrors({});

    if (!acceptTerms) {
      logger.register.warn('Validação falhou: Termos não aceitos');
      toast({
        title: "Confirme os termos",
        description: "É necessário aceitar os termos para continuar.",
        variant: "destructive",
      });
      return;
    }

    logger.register.info('Validações locais OK, iniciando validação do código de afiliado');
    setLoading(true);
    
    try {
      // Validar código de afiliado
      logger.affiliate.info('Validando código de afiliado', { code: trimmedReferral });
      const validation = await validateAffiliateCode(trimmedReferral);
      
      logger.affiliate.info('Resultado da validação', { 
        code: trimmedReferral, 
        valid: validation.valid,
        ownerId: (validation as { valid: boolean; ownerId?: string }).ownerId,
      });

      if (!validation.valid) {
        logger.affiliate.error('Código de afiliado inválido', { code: trimmedReferral });
        setErrors({ referral: "Código de indicação inválido." });
        setLoading(false);
        return;
      }

      // Chamar checkout de registro
      logger.register.info('Iniciando checkout de registro', {
        fullName: fullName.trim(),
        email,
        referralCode: trimmedReferral,
      });

      const response = await registrationCheckout({
        fullName: fullName.trim(),
        email,
        password,
        referralCode: trimmedReferral,
        acceptTerms,
      });

      logger.register.info('Resposta do checkout recebida', {
        hasToken: !!response.token,
        hasRefreshToken: !!response.refresh_token,
        hasInitPoint: !!response.init_point,
        status: response.status,
        profileId: response.profileId,
      });

      // Registro gratuito (com token direto)
      if (response.token && response.refresh_token) {
        logger.auth.info('Registro gratuito - configurando sessão');
        await supabase.auth.setSession({
          access_token: response.token,
          refresh_token: response.refresh_token,
        });
        logger.auth.info('Sessão configurada com sucesso');
        toast({ title: "Cadastro concluído", description: "Bem-vindo!" });
        navigate("/dashboard");
        return;
      }

      // Registro pago - redireciona para Mercado Pago
      if (response.init_point) {
        logger.payment.info('Redirecionando para Mercado Pago', { 
          initPoint: response.init_point,
        });
        window.location.assign(response.init_point);
        return;
      }

      logger.register.warn('Resposta do checkout sem token nem init_point', { response });
      toast({
        title: "Cadastro enviado",
        description: "Se houver pagamento, você será redirecionado.",
      });
    } catch (error: unknown) {
      logger.register.error('Erro no processo de cadastro', {}, error as Error);
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
