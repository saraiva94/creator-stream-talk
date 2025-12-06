import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Banknote, Loader2, CheckCircle } from "lucide-react";

interface PixWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  availableBalanceCents: number;
  onSuccess: () => void;
}

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

const PixWithdrawDialog = ({
  open,
  onOpenChange,
  userId,
  availableBalanceCents,
  onSuccess,
}: PixWithdrawDialogProps) => {
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const minWithdraw = 1000; // R$ 10,00 minimum

  const handleWithdraw = async () => {
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    
    if (!pixKey.trim()) {
      toast({
        title: t.pix?.keyRequired || "PIX key required",
        description: t.pix?.keyRequiredDesc || "Enter your PIX key to receive the withdrawal",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(amountCents) || amountCents < minWithdraw) {
      toast({
        title: t.pix?.minAmount || "Minimum amount",
        description: `${t.pix?.minAmountDesc || "The minimum withdrawal is"} ${formatBRL(minWithdraw)}`,
        variant: "destructive",
      });
      return;
    }

    if (amountCents > availableBalanceCents) {
      toast({
        title: t.pix?.insufficientBalance || "Insufficient balance",
        description: `${t.pix?.insufficientBalanceDesc || "Your available balance is"} ${formatBRL(availableBalanceCents)}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pix-withdraw", {
        body: {
          userId,
          pixKey: pixKey.trim(),
          amountCents,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setSuccess(true);
        toast({
          title: t.pix?.success || "Withdrawal requested!",
          description: t.pix?.successDesc || "Your withdrawal will be processed soon",
        });
        onSuccess();
        
        setTimeout(() => {
          setSuccess(false);
          setPixKey("");
          setAmount("");
          onOpenChange(false);
        }, 3000);
      } else {
        throw new Error(data?.error || "Erro ao processar saque");
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Não foi possível processar o saque";
      toast({
        title: "Erro ao sacar",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t.pix?.success || "Withdrawal Requested!"}</h3>
            <p className="text-muted-foreground text-center">
              {t.pix?.successDesc || "Your withdrawal will be processed soon"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-500" />
            {t.pix?.withdrawTitle || "PIX Withdrawal"}
          </DialogTitle>
          <DialogDescription>
            {t.pix?.withdrawDesc || "Withdraw your earnings via PIX"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">{t.pix?.availableBalance || "Available balance"}</p>
            <p className="text-2xl font-bold text-green-500">{formatBRL(availableBalanceCents)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key">{t.pix?.pixKey || "PIX Key"}</Label>
            <Input
              id="pix-key"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={t.pix?.pixKeyPlaceholder || "CPF, email, phone or random key"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t.pix?.amount || "Amount"} (R$)</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.pix?.amountPlaceholder || "Ex: 10,00"}
              type="text"
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              {t.pix?.minWithdraw || "Minimum: R$10,00"}
            </p>
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={loading || availableBalanceCents < minWithdraw}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t.pix?.processing || "Processing..."}
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" />
                {t.pix?.withdraw || "Withdraw"}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Saques são processados instantaneamente via Mercado Pago
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixWithdrawDialog;
