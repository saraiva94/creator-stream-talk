import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateOfBirthSelector, validateAge } from "@/components/DateOfBirthSelector";
import { TermsDialog } from "@/components/TermsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { openMercadoPagoCheckout } from "@/lib/mercadoPago";
import { validatePasswordStrength } from "@/lib/password";
import { validateAffiliateCode } from "@/lib/supabaseApi";
import { siteUrl } from "@/lib/siteUrl";
import { useNicknameValidator } from "@/hooks/useNicknameValidator";

const Subscribe = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const { t } = useLanguage();
  const { inviteCode } = useParams();
  const [searchParams] = useSearchParams();
  const returnedFromPayment = searchParams.get("checkout") === "returned";
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const code = referralCode ?? inviteCode ?? searchParams.get("ref") ?? user?.user_metadata?.referral_code ?? "";
  const [birth, setBirth] = useState({ day: "", month: "", year: "" });
  const { nickname, setNickname, validation, isReady } = useNicknameValidator();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const profile = useQuery({
    queryKey: ["registration-status", user?.id],
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: (query) => returnedFromPayment && query.state.data?.status === "pending_payment" ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("status, is_subscribed").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const pending = profile.data?.status === "pending_payment" && !profile.data.is_subscribed;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const referral = String(code).trim().toUpperCase();
    setError("");
    setSubmitting(true);
    let redirecting = false;
    try {
      if (user) {
        await openMercadoPagoCheckout("registration-checkout", { referralCode: referral });
        redirecting = true;
        return;
      }

      const password = String(form.get("password") ?? "");
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) throw new Error(passwordCheck.errors.join(" "));
      if (password !== form.get("confirmPassword")) throw new Error(t.subscribe.passwordsNotMatch);
      if (!birth.day || !birth.month || !birth.year || !validateAge(birth.day, birth.month, birth.year).valid) {
        throw new Error("Informe uma data de nascimento válida. A idade mínima é 18 anos.");
      }
      if (!isReady) throw new Error(validation.error || t.subscribe.nicknameUnavailable);
      if (!(await validateAffiliateCode(referral)).valid) throw new Error("Código de indicação inválido.");

      const { data, error } = await supabase.auth.signUp({
        email: String(form.get("email") ?? "").trim(),
        password,
        options: {
          emailRedirectTo: `${siteUrl}/subscribe?flow=signup`,
          data: {
            full_name: String(form.get("fullName") ?? "").trim(),
            username: nickname,
            referral_code: referral,
          },
        },
      });
      if (error) throw error;
      if (data.session && data.user?.email_confirmed_at) {
        await openMercadoPagoCheckout("registration-checkout", { referralCode: referral });
        redirecting = true;
      } else {
        setNeedsEmailConfirmation(true);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      if (!redirecting) setSubmitting(false);
    }
  };

  const signupFields = [
    { name: "fullName", label: t.subscribe.fullName, type: "text", autoComplete: "name" },
    { name: "email", label: t.subscribe.email, type: "email", autoComplete: "email" },
    { name: "password", label: t.subscribe.password, type: "password", autoComplete: "new-password" },
    { name: "confirmPassword", label: t.subscribe.confirmPassword, type: "password", autoComplete: "new-password" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isAdmin={isAdmin} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>{t.subscribe.formTitle}</CardTitle>
            <CardDescription>Ativação da conta por R$ 7,00 via Mercado Pago.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(isLoading || (user && profile.isPending)) && <p role="status">{t.common.loading}</p>}
            {user && profile.isError && <p role="alert">Não foi possível consultar a ativação da conta.</p>}
            {user && profile.data && !pending && <p>Sua conta já pode ser usada.</p>}
            {pending && returnedFromPayment && (
              <p role="status">Aguardando a confirmação do Mercado Pago para ativar sua conta.</p>
            )}
            {!user && needsEmailConfirmation && (
              <p role="status">Confirme seu e-mail e entre na conta para concluir o pagamento.</p>
            )}
            {!isLoading && ((pending && !returnedFromPayment) || (!user && !needsEmailConfirmation)) && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!user && (
                  <>
                    {signupFields.map(({ name, label, type, autoComplete }) => (
                      <div key={name} className="space-y-2">
                        <Label htmlFor={name}>{label}</Label>
                        <Input id={name} name={name} type={type} autoComplete={autoComplete} required />
                      </div>
                    ))}
                    <div className="space-y-2">
                      <Label htmlFor="nickname">{t.subscribe.nickname}</Label>
                      <Input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)}
                        autoComplete="username" required />
                      {nickname && validation.error && <p className="text-xs text-destructive">{validation.error}</p>}
                    </div>
                    <DateOfBirthSelector {...birth}
                      onDayChange={(day) => setBirth((value) => ({ ...value, day }))}
                      onMonthChange={(month) => setBirth((value) => ({ ...value, month }))}
                      onYearChange={(year) => setBirth((value) => ({ ...value, year }))} />
                    <div className="flex items-center gap-2">
                      <input id="acceptTerms" type="checkbox" required />
                      <Label htmlFor="acceptTerms">{t.subscribe.acceptTerms} {t.subscribe.termsLink}</Label>
                      <TermsDialog />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="referralCode">{t.subscribe.referralCode}</Label>
                  <Input id="referralCode" value={code} onChange={(event) => setReferralCode(event.target.value)} required />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={submitting || (!user && !isReady)} className="w-full">
                  {submitting ? t.common.loading : user ? "Pagar com Mercado Pago" : t.subscribe.formTitle}
                </Button>
              </form>
            )}
            {!user && !isLoading && (
              <Button variant="link" asChild>
                <Link to="/auth?continue=registration">{t.auth.loginButton}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Subscribe;
