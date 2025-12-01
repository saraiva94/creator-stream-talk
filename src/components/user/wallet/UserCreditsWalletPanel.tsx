import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCcw, ShoppingBag } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const formatMinutes = (credits: number) => {
  // 6 credits = 1 minute; show in whole minutes
  const minutes = Math.floor(credits / 6);
  return `${minutes} min`;
};

const CREDITS_PACKAGE = {
  credits: 180,
  priceBRL: 5,
  liveIdPlaceholder: "credits-package",
};

export const UserCreditsWalletPanel = () => {
  const { toast } = useToast();
  const [balanceCredits, setBalanceCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchBalance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.credits.balance();
      setBalanceCredits(data.balance_credits ?? data.balance ?? data.creditBalance ?? 0);
    } catch (err) {
      console.error("[credits] failed to load balance", err);
      const friendly = err instanceof ApiError ? err.message : "Não foi possível carregar o saldo agora.";
      setError(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error("Usuário não autenticado");
      }

      const preference = await api.credits.purchase({
        userId,
        price: CREDITS_PACKAGE.priceBRL,
        credits: CREDITS_PACKAGE.credits,
        liveId: CREDITS_PACKAGE.liveIdPlaceholder,
      });

      if (!preference?.init_point) {
        throw new Error("Não foi possível iniciar a compra de créditos.");
      }

      window.location.assign(preference.init_point);
    } catch (err) {
      console.error("[credits] checkout error", err);
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      setError(message);
      toast({
        title: "Erro ao iniciar compra",
        description: message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Meus créditos</CardTitle>
          <p className="text-sm text-muted-foreground">Saldo para assistir lives.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchBalance} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Saldo de créditos</p>
            <p className="text-2xl font-semibold">
              {isLoading || balanceCredits === null ? "..." : `${balanceCredits} créditos`}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Tempo estimado</p>
            <p className="text-2xl font-semibold">
              {isLoading || balanceCredits === null ? "..." : formatMinutes(balanceCredits)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Comprar créditos</p>
              <p className="text-xs text-muted-foreground">
                Pacote: {CREDITS_PACKAGE.credits} créditos por R$ {CREDITS_PACKAGE.priceBRL.toFixed(2)}
              </p>
            </div>
          </div>
          <Button onClick={startCheckout} disabled={checkoutLoading}>
            {checkoutLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando checkout...
              </>
            ) : (
              "Comprar créditos"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCreditsWalletPanel;
