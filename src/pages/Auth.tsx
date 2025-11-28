import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"viewer" | "creator">("viewer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const validatePassword = (pwd: string): boolean => {
    const minLength = pwd.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return minLength && hasUpperCase && hasNumber && hasSymbol;
  };

    const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username) {
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

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
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

      // Handle referral if present
      if (refCode && data.user) {
        const { data: refProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", refCode)
          .single();

        await supabase.from("referrals").insert({
          referral_code: refCode,
          referred_id: data.user.id,
          referrer_id: refProfile?.id,
        });
      }

      // Set role in user_roles table
      if (data.user && role === "creator") {
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "creator",
        });
      }

      toast({
        title: "Account created!",
        description: "You will be redirected shortly.",
      });

      setTimeout(() => navigate("/"), 1500);
    } catch (error: unknown) {
      console.error("Sign up error", error);

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
      console.error("Sign in error", error);

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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t.auth.login}</TabsTrigger>
                <TabsTrigger value="register">{t.auth.register}</TabsTrigger>
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
                  <Link to="/reset-password" className="text-sm text-primary hover:underline block">
                    {t.auth.forgotPassword}
                  </Link>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t.auth.loading : t.auth.loginButton}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">{t.auth.username}</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="myusername"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t.auth.email}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t.auth.password}</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
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
                    <p className="text-xs text-muted-foreground">
                      {t.auth.passwordRequirements}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.auth.role}</Label>
                    <RadioGroup value={role} onValueChange={(val) => setRole(val as "viewer" | "creator")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="viewer" id="viewer" />
                        <Label htmlFor="viewer" className="font-normal cursor-pointer">
                          {t.auth.roleViewer}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="creator" id="creator" />
                        <Label htmlFor="creator" className="font-normal cursor-pointer">
                          {t.auth.roleCreator}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t.auth.loading : t.auth.registerButton}
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
