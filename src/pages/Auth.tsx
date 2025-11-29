import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Video, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthApiError } from "@supabase/supabase-js";

// === helper para tratar erros sem usar `any` ===
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"viewer" | "creator">("viewer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const siteUrl = useMemo(
    () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (data.session) {
            toast({
              title: "Email confirmed!",
              description: "Your account is now active. You can log in.",
            });
            await supabase.auth.signOut();
            navigate("/auth", { replace: true });
            return;
          }
        }

        if (accessToken && refreshToken && type === "signup") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          toast({
            title: "Email confirmed!",
            description: "Your account is now active. You can log in.",
          });
          await supabase.auth.signOut();
          navigate("/auth", { replace: true });
        }
      } catch (error) {
        console.error("[AUTH][CONFIRMATION]", { error, code, accessToken, refreshToken });
        toast({
          title: "Confirmation error",
          description: getErrorMessage(error, "We couldn't confirm your email. Try again."),
          variant: "destructive",
        });
      }
    };
    checkSession();
  }, [navigate, toast]);

  const validatePassword = (pwd: string): boolean => {
    const minLength = pwd.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return minLength && hasUpperCase && hasNumber && hasSymbol;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username || !confirmPassword) {
      toast({
        title: "Required fields",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(password)) {
      toast({
        title: "Weak password",
        description: t.auth.passwordRequirements,
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
      // Ensure this route is listed in Supabase auth redirect URLs.
      const redirectUrl = `${siteUrl}/auth`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        toast({
          title: "Account created!",
          description: "Check your email to verify your account before logging in.",
        });
      }

      toast({
        title: "Account created!",
        description: "Please verify your email to activate your account.",
      });

      setTimeout(() => navigate("/auth"), 1500);
    } catch (error: unknown) {
      console.error("[AUTH][SIGNUP]", { error, email, username, role });

      const description = getErrorMessage(
        error,
        "Error creating account. Please try again."
      );

      toast({
        title: "Error creating account",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Required fields",
        description: "Please enter email and password",
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
        title: "Login successful!",
        description: "Welcome back.",
      });

      navigate("/");
    } catch (error: unknown) {
      console.error("[AUTH][SIGNIN]", { error, email });

      if (error instanceof AuthApiError) {
        if (error.code === "email_not_confirmed" ||
          (error.message && error.message.toLowerCase().includes("confirm"))) {
          toast({
            title: "Email not confirmed",
            description: "Please verify your email address before logging in.",
            variant: "destructive",
          });
          return;
        }

        if (error.status === 400 || error.status === 403) {
          toast({
            title: "Invalid credentials",
            description: "Please check your email and password and try again.",
            variant: "destructive",
          });
          return;
        }
      }

      const description = getErrorMessage(
        error,
        "Login error. Please check your credentials or try again."
      );

      toast({
        title: "Login error",
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
          <Video className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-4xl font-bold text-primary">
            Stream Live Hub
          </h1>
        </div>

        <Card className="border-border shadow-gold">
          <CardHeader>
            <CardTitle>{t.auth.welcome}</CardTitle>
            <CardDescription>
              Connect with creators streaming live
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="login">{t.auth.login}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t.auth.email}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
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
                  <Link to="/auth/reset-password" className="text-sm text-primary hover:underline block">
                    {t.auth.forgotPassword}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Sign-up is invite-only. Use your personal invite link to create an account.
                  </p>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t.auth.loading : t.auth.loginButton}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
