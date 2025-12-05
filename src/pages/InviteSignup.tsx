import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { StreamStarLogo } from "@/components/StreamStarLogo";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/LanguageSelector";
import { validatePasswordStrength } from "@/lib/password";
import { apiClient } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api";

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
      const response = await apiClient.registrationCheckout({
        email,
        password,
        referralCode: ref,
        referrer_id: parentId,
      });

      if (response.init_point) {
        window.location.href = response.init_point;
      } else {
        toast({
          title: "Link de pagamento gerado",
          description: "Siga para o checkout para concluir o cadastro.",
        });
      }
    } catch (err) {
      console.error("[INVITE][SIGNUP]", err);
      const description =
        err instanceof ApiError && err.status === 409
          ? "Este convite já foi usado com este e-mail."
          : "Please verify your invite link and try again.";
      toast({
        title: "Error creating account",
        description,
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
          <StreamStarLogo />
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
