import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Check, Eye, EyeOff, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validatePasswordStrength } from "@/lib/password";
import { registrationCheckout, validateAffiliateCode } from "@/lib/supabaseApi";
import { logger } from "@/lib/logger";
import { TermsDialog } from "@/components/TermsDialog";
import { DateOfBirthSelector, validateAge } from "@/components/DateOfBirthSelector";
import { useLanguage } from "@/hooks/useLanguage";

const Subscribe = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<{ referral?: string; age?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Date of birth
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Password validation state
  const passwordValidation = validatePasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

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
      birthDate: `${birthDay}/${birthMonth}/${birthYear}`,
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

    // Validate age (18+)
    const ageValidation = validateAge(birthDay, birthMonth, birthYear);
    if (!birthDay || !birthMonth || !birthYear) {
      logger.register.warn('Validação falhou: Data de nascimento incompleta');
      setErrors(prev => ({ ...prev, age: "Preencha sua data de nascimento completa." }));
      toast({ title: "Data de nascimento obrigatória", description: "Preencha dia, mês e ano de nascimento.", variant: "destructive" });
      return;
    }
    
    if (!ageValidation.valid) {
      logger.register.warn('Validação falhou: Usuário menor de 18 anos', { age: ageValidation.age });
      setErrors(prev => ({ ...prev, age: "Você deve ter 18 anos completos para se cadastrar." }));
      toast({ 
        title: "Idade mínima não atingida", 
        description: "Você precisa ter 18 anos completos para se cadastrar na plataforma.", 
        variant: "destructive" 
      });
      return;
    }
    setErrors(prev => ({ ...prev, age: undefined }));

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
      setErrors(prev => ({ ...prev, referral: "Você precisa de um código de indicação para se cadastrar." }));
      return;
    }

    setErrors(prev => ({ ...prev, referral: undefined }));

    if (!acceptTerms) {
      logger.register.warn('Validação falhou: Termos não aceitos');
      toast({
        title: "Confirme os termos",
        description: "É necessário aceitar os termos e condições para continuar.",
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
        setErrors(prev => ({ ...prev, referral: "Código de indicação inválido." }));
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
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {t.subscribe.formTitle}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t.subscribe.formSubtitle}
            </p>
          </div>

          <Card className="p-6 border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-semibold rounded-full">
              {t.subscribe.formBadge}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">{t.subscribe.fullName} *</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.subscribe.fullNamePlaceholder}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.subscribe.email} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.subscribe.emailPlaceholder}
                  disabled={loading}
                />
              </div>

              {/* Date of Birth Selector */}
              <DateOfBirthSelector
                day={birthDay}
                month={birthMonth}
                year={birthYear}
                onDayChange={setBirthDay}
                onMonthChange={setBirthMonth}
                onYearChange={setBirthYear}
                disabled={loading}
              />
              {errors.age && <p className="text-sm text-destructive">{errors.age}</p>}

              {/* Mobile/Tablet: Referral first, then Password, then Confirm Password */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Referral Code - First on mobile, order-1 on desktop */}
                <div className="space-y-2 order-first md:order-2">
                  <Label htmlFor="referral">{t.subscribe.referralCode} *</Label>
                  <Input
                    id="referral"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder={t.subscribe.referralCodePlaceholder}
                    disabled={loading}
                  />
                  {errors.referral ? <p className="text-sm text-destructive">{errors.referral}</p> : null}
                </div>
                
                {/* Password - Second on mobile */}
                <div className="space-y-2 order-2 md:order-1">
                  <Label htmlFor="password">{t.subscribe.password} *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                {/* Confirm Password - Third on mobile */}
                <div className="space-y-2 order-3">
                  <Label htmlFor="confirm-password">{t.subscribe.confirmPassword} *</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                {/* Password Requirements Card */}
                <Card className="p-4 border-muted bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t.subscribe.passwordRequirements}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      {passwordValidation.checks.minLength ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={passwordValidation.checks.minLength ? "text-green-500" : "text-muted-foreground"}>
                        {t.subscribe.minChars}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordValidation.checks.hasUppercase ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={passwordValidation.checks.hasUppercase ? "text-green-500" : "text-muted-foreground"}>
                        {t.subscribe.uppercase}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordValidation.checks.hasLowercase ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={passwordValidation.checks.hasLowercase ? "text-green-500" : "text-muted-foreground"}>
                        {t.subscribe.lowercase}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordValidation.checks.hasNumber ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={passwordValidation.checks.hasNumber ? "text-green-500" : "text-muted-foreground"}>
                        {t.subscribe.number}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      {passwordValidation.checks.hasSymbol ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={passwordValidation.checks.hasSymbol ? "text-green-500" : "text-muted-foreground"}>
                        {t.subscribe.symbol}
                      </span>
                    </div>
                  </div>
                  {confirmPassword && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs">
                        {passwordsMatch ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-destructive" />
                        )}
                        <span className={passwordsMatch ? "text-green-500" : "text-destructive"}>
                          {passwordsMatch ? t.subscribe.passwordsMatch : t.subscribe.passwordsNotMatch}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Terms and Conditions with Info Icon */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="accept-terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                  disabled={loading}
                />
                <Label htmlFor="accept-terms" className="text-sm flex items-center gap-1">
                  {t.subscribe.acceptTerms} <span className="text-primary underline">{t.subscribe.termsLink}</span>
                  <TermsDialog />
                </Label>
              </div>

              {/* Commercial Benefits Card */}
              <Card className="p-5 border-primary/50 bg-gradient-to-br from-primary/10 via-card to-secondary/10 relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-2xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-secondary/20 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
                
                <div className="relative z-10">
                  <p className="text-sm text-muted-foreground mb-4 animate-fade-in" style={{ animationDelay: "0.15s" }}>
                    {t.subscribe.unlockPotential}
                  </p>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 animate-fade-in hover-scale" style={{ animationDelay: "0.2s" }}>
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t.subscribe.benefit1Title}</span>
                        <p className="text-xs text-muted-foreground">{t.subscribe.benefit1Desc}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 animate-fade-in hover-scale" style={{ animationDelay: "0.3s" }}>
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t.subscribe.benefit2Title}</span>
                        <p className="text-xs text-muted-foreground">{t.subscribe.benefit2Desc}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 animate-fade-in hover-scale" style={{ animationDelay: "0.4s" }}>
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t.subscribe.benefit3Title}</span>
                        <p className="text-xs text-muted-foreground">{t.subscribe.benefit3Desc}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 animate-fade-in hover-scale" style={{ animationDelay: "0.5s" }}>
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t.subscribe.benefit4Title}</span>
                        <p className="text-xs text-muted-foreground">{t.subscribe.benefit4Desc}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 animate-fade-in hover-scale" style={{ animationDelay: "0.6s" }}>
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t.subscribe.benefit5Title}</span>
                        <p className="text-xs text-muted-foreground">{t.subscribe.benefit5Desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={handleSubscribe} disabled={loading}>
                {loading ? t.subscribe.processing : t.subscribe.subscribeNow}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                {t.subscribe.securePayment}
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Subscribe;
