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

  const minWithdraw = 1000; // R$ 10,00 minimum

  const handleWithdraw = async () => {
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    
    if (!pixKey.trim()) {
      toast({
        title: "Chave PIX obrigatória",
        description: "Informe sua chave PIX para receber o saque",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(amountCents) || amountCents < minWithdraw) {
      toast({
        title: "Valor mínimo",
        description: `O valor mínimo para saque é ${formatBRL(minWithdraw)}`,
        variant: "destructive",
      });
      return;
    }

    if (amountCents > availableBalanceCents) {
      toast({
        title: "Saldo insuficiente",
        description: `Seu saldo disponível é ${formatBRL(availableBalanceCents)}`,
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
          title: "Saque solicitado!",
          description: "O valor será transferido para sua chave PIX em instantes.",
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
            <h3 className="text-xl font-bold mb-2">Saque Realizado!</h3>
            <p className="text-muted-foreground text-center">
              O valor será transferido para sua chave PIX em instantes.
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
            Sacar via PIX
          </DialogTitle>
          <DialogDescription>
            Saque instantâneo e sem taxas para sua chave PIX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold text-green-500">{formatBRL(availableBalanceCents)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input
              id="pix-key"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor do saque (R$)</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              type="text"
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo: {formatBRL(minWithdraw)}
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
                Processando...
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" />
                Sacar agora
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
