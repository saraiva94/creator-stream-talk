import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCcw, ShoppingBag } from "lucide-react";
import { fetchCreditsBalance, createCreditsPayment } from "@/lib/supabaseApi";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

const formatMinutes = (credits: number) => {
  // 180 credits = 30 minutes
  const minutes = Math.floor((credits / 180) * 30);
  return `${minutes} min`;
};

const CREDITS_PACKAGES = [
  { credits: 180, priceBRL: 5, label: "30 min" },
  { credits: 360, priceBRL: 9, label: "1 hora" },
  { credits: 720, priceBRL: 16, label: "2 horas" },
  { credits: 1800, priceBRL: 35, label: "5 horas" },
];

export const UserCreditsWalletPanel = () => {
  const { toast } = useToast();
  const [balanceCredits, setBalanceCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(CREDITS_PACKAGES[0]);

  const fetchBalance = async () => {
    logger.credits.info('UserCreditsWalletPanel: Carregando saldo');
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        logger.credits.warn('Sem sessão ativa, não é possível carregar saldo');
        setBalanceCredits(0);
        return;
      }

      logger.credits.debug('Sessão encontrada', { userId: session.user.id });
      
      const data = await fetchCreditsBalance();
      const balance = data.balance_credits ?? data.creditBalance ?? 0;
      
      logger.credits.info('Saldo carregado na UI', { balance });
      setBalanceCredits(balance);
    } catch (err) {
      logger.credits.error('Erro ao carregar saldo na UI', {}, err as Error);
      const friendly = err instanceof Error ? err.message : "Não foi possível carregar o saldo agora.";
      setError(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    logger.credits.debug('UserCreditsWalletPanel montado');
    fetchBalance();
  }, []);

  const startCheckout = async () => {
    logger.payment.info('Iniciando checkout de créditos', { 
      credits: selectedPackage.credits,
      price: selectedPackage.priceBRL,
    });
    
    setCheckoutLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        logger.payment.error('Usuário não autenticado para checkout');
        throw new Error("Usuário não autenticado");
      }

      logger.payment.debug('Usuário autenticado', { userId: user.id });

      const preference = await createCreditsPayment({
        credits: selectedPackage.credits,
        userId: user.id,
      });

      if (!preference?.init_point) {
        logger.payment.error('Preferência sem init_point', { preference });
        throw new Error("Não foi possível iniciar a compra de créditos.");
      }

      logger.payment.info('Redirecionando para Mercado Pago', { 
        initPoint: preference.init_point,
        credits: selectedPackage.credits,
      });
      
      window.location.assign(preference.init_point);
    } catch (err) {
      logger.payment.error('Erro no checkout', { 
        credits: selectedPackage.credits 
      }, err as Error);
      
      const message = err instanceof Error ? err.message : "Não foi possível iniciar a compra.";
      setError(message);
      toast({
        title: "Erro ao iniciar compra",
        description: message,
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
              <p className="text-xs text-muted-foreground">Selecione um pacote:</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CREDITS_PACKAGES.map((pkg) => (
              <button
                key={pkg.credits}
                onClick={() => {
                  logger.payment.debug('Pacote selecionado', { credits: pkg.credits, price: pkg.priceBRL });
                  setSelectedPackage(pkg);
                }}
                className={`rounded-md border p-2 text-sm transition-colors ${
                  selectedPackage.credits === pkg.credits
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{pkg.label}</div>
                <div className="text-xs text-muted-foreground">
                  {pkg.credits} créditos • R$ {pkg.priceBRL.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          <Button onClick={startCheckout} disabled={checkoutLoading} className="w-full">
            {checkoutLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando checkout...
              </>
            ) : (
              `Comprar ${selectedPackage.credits} créditos por R$ ${selectedPackage.priceBRL.toFixed(2)}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCreditsWalletPanel;
