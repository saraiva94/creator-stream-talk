import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wallet } from "lucide-react";

type WalletSummary = {
  balance_cents: number;
  pending_cents: number;
};

type CreatorWalletPanelProps = {
  onWalletUpdate?: (summary: WalletSummary) => void;
  onWithdrawalSuccess?: (summary: WalletSummary) => void;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
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

export const CreatorWalletPanel = ({ onWalletUpdate, onWithdrawalSuccess }: CreatorWalletPanelProps) => {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountBRL, setAmountBRL] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleWithdrawAll = () => {
    if (!summary) return;
    setAmountBRL((summary.balance_cents / 100).toFixed(2));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const pix = pixKey.trim();
    if (!pix) {
      setError("Informe sua chave PIX.");
      return;
    }

    const parsed = parseFloat(amountBRL.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Informe um valor valido em reais.");
      return;
    }

    const amountCents = Math.round(parsed * 100);

    setIsSubmitting(true);
    try {
      const creatorId = await getCreatorId();

      const withdrawPayload = {
        userId: creatorId,
        pixKey: pix,
        amountCents,
        isCreator: true,
      };
      
      console.log('🚀 [CREATOR-WALLET] Iniciando saque...');
      console.log('📦 [CREATOR-WALLET] Payload:', JSON.stringify(withdrawPayload, null, 2));
      console.log('🔑 [CREATOR-WALLET] CreatorId:', creatorId);
      console.log('💰 [CREATOR-WALLET] Amount (cents):', amountCents);

      const { data, error: invokeError } = await supabase.functions.invoke("pix-withdraw", {
        body: withdrawPayload,
      });

      console.log('📥 [CREATOR-WALLET] Response data:', JSON.stringify(data, null, 2));
      console.log('❌ [CREATOR-WALLET] Error:', invokeError);

      if (invokeError) {
        console.error('💥 [CREATOR-WALLET] InvokeError detalhado:', {
          message: invokeError.message,
          name: invokeError.name,
          context: invokeError.context,
          status: invokeError.status,
        });
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        console.error('💥 [CREATOR-WALLET] Resposta sem success:', data);
        throw new Error(data?.error || "Nao foi possivel solicitar o saque");
      }

      await loadSummary();
      onWithdrawalSuccess?.({
        balance_cents: (summary?.balance_cents ?? 0) - amountCents,
        pending_cents: (summary?.pending_cents ?? 0) + amountCents,
      });

      setAmountBRL("");
      setPixKey("");
      setSuccess("Saque solicitado. O valor foi reservado e está em processamento.");
    } catch (err) {
      console.error('💥 [CREATOR-WALLET] Exception:', err);
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {success && (
          <Alert>
            <AlertTitle>Sucesso</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
            Sem taxa de saque: voce recebe 100% do valor solicitado.
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Chave PIX</label>
            <Input
              type="text"
              placeholder="CPF, e-mail ou chave aleatoria"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Valor para sacar (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 50.00"
              value={amountBRL}
              onChange={(e) => setAmountBRL(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!summary || isSubmitting || isLoading}
              onClick={handleWithdrawAll}
            >
              Sacar tudo
            </Button>
            <Button type="submit" disabled={isSubmitting || !summary}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                </>
              ) : (
                "Solicitar saque"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatorWalletPanel;
