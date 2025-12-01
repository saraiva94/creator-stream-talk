import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Video } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/LanguageSelector";
import { validatePasswordStrength } from "@/lib/password";

const InviteSignup = () => {
  const { inviteCode: inviteCodeParam } = useParams();
  const [searchParams] = useSearchParams();
  const ref = inviteCodeParam || searchParams.get("ref") || "";
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentUsername, setParentUsername] = useState<string | null>(null);

  const siteUrl = useMemo(
    () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, ""),
    []
  );

  const backendBase = useMemo(
    () => (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    if (!ref) {
      toast({
        title: "Invite required",
        description: "A valid invite link is required to register.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
    }
  }, [navigate, ref, toast]);

  useEffect(() => {
    const resolveParent = async () => {
      if (!ref) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("referral_code", ref)
        .maybeSingle();

      if (error || !data?.id) {
        console.error("[INVITE][RESOLVE_PARENT]", { error, ref });
        toast({
          title: "Invite not found",
          description: "This invite link is invalid or expired.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      setParentId(data.id);
      setParentUsername(data.username ?? null);
    };

    void resolveParent();
  }, [navigate, ref, toast]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref) return;

    if (!email || !password || !username || !confirmPassword) {
      toast({
        title: "Required fields",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      toast({
        title: "Weak password",
        description: passwordCheck.errors.join(" "),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t.auth.passwordMismatchTitle ?? "Passwords do not match",
        description: t.auth.passwordMismatch ?? "Please confirm your password correctly.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${siteUrl}/auth`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, role: "viewer", referral_code: ref },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        throw new Error("User ID missing after signup");
      }

      if (!parentId) {
        throw new Error("Missing parent for invite registration");
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          username,
          referred_by: parentId,
          status: "pending_payment",
        },
        { onConflict: "id" }
      );

      if (profileError) {
        throw profileError;
      }

      const { error: referralError } = await supabase.from("referrals").insert({
        referral_code: ref,
        referred_id: userId,
        referrer_id: parentId,
      });

      if (referralError) {
        console.error("[INVITE][REFERRAL_INSERT]", { referralError, ref });
      }

      const response = await fetch(`${backendBase}/payments/create-registration-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, parentId }),
      });

      const body = await response.json();

      if (!response.ok || !body?.init_point) {
        throw new Error(body?.error || "Failed to start registration payment");
      }

      toast({
        title: "Confirm your email and pay the registration fee",
        description:
          "We sent a confirmation email. Complete payment to activate your account after confirmation is processed.",
      });

      window.location.href = body.init_point as string;
    } catch (err) {
      console.error("[INVITE][SIGNUP]", err);
      toast({
        title: "Error creating account",
        description: "Please verify your invite link and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
            <CardTitle>Invite-only registration</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your invite code: <span className="font-semibold">{ref}</span>
            </p>
            {parentUsername && (
              <p className="text-sm text-muted-foreground">Invited by: <span className="font-semibold">@{parentUsername}</span></p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Registration costs R$ 5,00 and activates after email confirmation + payment.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="username">{t.auth.username}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="myusername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
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
                <p className="text-xs text-muted-foreground">{t.auth.passwordRequirements}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t.auth.confirmPassword ?? "Confirm Password"}</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
              <Button type="submit" className="w-full" disabled={loading || !parentId}>
                {loading ? t.auth.loading : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Registration is invite-only and requires payment to activate your account.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InviteSignup;
