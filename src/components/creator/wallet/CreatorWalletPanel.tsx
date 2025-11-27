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

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

const getAuthHeader = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const CreatorWalletPanel = () => {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountBRL, setAmountBRL] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const backendBase = import.meta.env.VITE_BACKEND_URL ?? "";

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeader()),
      };
      const res = await fetch(`${backendBase}/withdrawals/wallet-summary`, {
        headers,
      });
      const body = (await res.json()) as ApiResponse<WalletSummary>;
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error || "Falha ao carregar a carteira");
      }
      setSummary(body.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseFloat(amountBRL.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Informe um valor válido em reais.");
      return;
    }

    const amount_cents = Math.round(parsed * 100);

    setIsSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeader()),
      };
      const res = await fetch(`${backendBase}/withdrawals/request`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amount_cents }),
      });
      const body = (await res.json()) as ApiResponse<{
        balance_cents_after: number;
        pending_cents_after: number;
      }>;

      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error || "Não foi possível solicitar o saque");
      }

      setSummary({
        balance_cents: body.data.balance_cents_after,
        pending_cents: body.data.pending_cents_after,
      });
      setAmountBRL("");
      setSuccess("Saque solicitado com sucesso. Aguarde aprovação.");
    } catch (err) {
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
          <p className="text-sm text-muted-foreground">Saldo em reais e solicitações de saque.</p>
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
              <p className="text-xs uppercase text-muted-foreground">Saldo disponível</p>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              "Solicitar saque"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatorWalletPanel;
