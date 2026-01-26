import { FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registrationCheckout } from "@/lib/supabaseApi";
import { useToast } from "@/hooks/use-toast";
import { PixPaymentDialog, PixPaymentData } from "@/components/pix/PixPaymentDialog";
import type { User } from "@supabase/supabase-js";

const REGISTRATION_PRICE = 7.0;

const RegistrationCheckoutPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // PIX payment state
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);

  const referrerId = params.get("ref");
  const isFree = params.get("free") === "1";
  const isRoot = params.get("root") === "1";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user?.id) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        setIsAdmin(roles?.some(r => r.role === "admin") || false);
      }
    };
    checkAuth();
  }, []);

  const headline = useMemo(() => {
    if (isFree) return "Free registration link";
    if (referrerId) return "Registration via referral";
    return "Creator registration";
  }, [isFree, referrerId]);

  // Handle PIX payment confirmation
  const handlePaymentConfirmed = useCallback(() => {
    setPixDialogOpen(false);
    toast({
      title: "Pagamento confirmado!",
      description: "Sua conta foi ativada com sucesso. Redirecionando para login...",
    });
    setTimeout(() => {
      navigate("/auth");
    }, 2000);
  }, [navigate, toast]);

  const handleCheckout = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Use the new registration-checkout flow that creates user AFTER payment
      const response = await registrationCheckout({
        fullName: email.split('@')[0],
        email,
        password,
        referrerId: referrerId || undefined,
        free: isFree,
        root: isRoot || (!referrerId && !isFree),
      });

      // Free registration - should redirect to auth (user was created by backend)
      if (isFree && response.success) {
        toast({ title: "Registration complete", description: "Your account has been created. Please login." });
        navigate("/auth");
        return;
      }

      // Paid registration - show PIX QR Code
      if (response.pix?.qrCode) {
        setPixData({
          qrCode: response.pix.qrCode,
          qrCodeImage: response.pix.qrCodeImage,
          expiresAt: response.pix.expiresAt,
          transactionId: response.transactionId || '',
          paymentId: response.paymentId,
          externalRef: response.externalRef || response.paymentId,
          amount: response.amount || REGISTRATION_PRICE,
          eventType: 'REGISTRATION',
          description: 'Account Activation - R$ 7.00',
        });
        setPixDialogOpen(true);
        return;
      }

      toast({
        title: "Registration submitted",
        description: "If payment is required, you will see a QR code shortly.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      const displayMessage = message.includes("cadastrado") 
        ? "This email is already registered"
        : message;
      setError(displayMessage);
      toast({ title: "Registration error", description: displayMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isAdmin={isAdmin} />
      <div className="container mx-auto max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>{headline}</CardTitle>
            <CardDescription>
              {isFree
                ? "This admin-issued link lets you join without payment."
                : "Complete your registration to start streaming and earning."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isFree && (
              <div className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Registration fee: R$ {REGISTRATION_PRICE.toFixed(2)}. If you used a referral link, your referrer
                earns a commission from this payment.
              </div>
            )}
            {referrerId ? (
              <p className="mb-4 text-sm text-muted-foreground">Referral detected. Your registration supports your creator.</p>
            ) : null}
            {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
            <form className="space-y-4" onSubmit={handleCheckout}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters with letters and numbers.</p>
              </div>
              <Button type="submit" disabled={loading || !email.trim() || !password.trim() || password.length < 8} className="w-full">
                {loading ? "Processing..." : isFree ? "Activate free registration" : "Continue to checkout"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* PIX Payment Dialog */}
      <PixPaymentDialog
        open={pixDialogOpen}
        onOpenChange={setPixDialogOpen}
        pixData={pixData}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </div>
  );
};

export default RegistrationCheckoutPage;
