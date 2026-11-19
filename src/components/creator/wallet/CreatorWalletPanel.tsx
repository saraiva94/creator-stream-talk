import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wallet } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type WalletSummary = {
  balance_cents: number;
  pending_cents: number;
};

type CreatorWalletPanelProps = {
  onWalletUpdate?: (summary: WalletSummary) => void;
};

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

const getCreatorId = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const creatorId = session?.user?.id;
  if (!creatorId) throw new Error("Autenticação necessária");
  return creatorId;
};

export const CreatorWalletPanel = ({ onWalletUpdate }: CreatorWalletPanelProps) => {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const creatorId = await getCreatorId();

      const { data, error: walletError } = await supabase
        .from("creator_wallet")
        .select("balance_cents, pending_cents")
        .eq("creator_id", creatorId)
        .maybeSingle();

      if (walletError) {
        throw new Error(walletError.message);
      }

      const next = {
        balance_cents: data?.balance_cents ?? 0,
        pending_cents: data?.pending_cents ?? 0,
      };

      setSummary(next);
      onWalletUpdate?.(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Carteira do Criador</CardTitle>
          <p className="text-sm text-muted-foreground">Saldo em reais e solicitacoes de saque.</p>
        </div>
        <Wallet className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando carteira...</div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : summary ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase text-muted-foreground">Saldo disponivel</p>
              <p className="text-2xl font-semibold">{formatBRL(summary.balance_cents)}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase text-muted-foreground">Em processamento</p>
              <p className="text-2xl font-semibold">{formatBRL(summary.pending_cents)}</p>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">{t.payments.withdrawalsUnavailable}</p>
      </CardContent>
    </Card>
  );
};

export default CreatorWalletPanel;
