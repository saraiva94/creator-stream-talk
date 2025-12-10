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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Banknote, Loader2, CheckCircle, CreditCard, QrCode } from "lucide-react";

interface PixWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  availableBalanceCents: number;
  onSuccess: () => void;
}

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Bancos compatíveis com Woovi/OpenPix para transferência
const SUPPORTED_BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Inter" },
  { code: "336", name: "C6 Bank" },
  { code: "212", name: "Banco Original" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "422", name: "Safra" },
  { code: "070", name: "BRB" },
  { code: "735", name: "Neon" },
  { code: "380", name: "PicPay" },
  { code: "290", name: "PagBank" },
];

type WithdrawMethod = "pix" | "bank";

const PixWithdrawDialog = ({
  open,
  onOpenChange,
  userId,
  availableBalanceCents,
  onSuccess,
}: PixWithdrawDialogProps) => {
  const [method, setMethod] = useState<WithdrawMethod>("pix");
  const [pixKey, setPixKey] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [agencyNumber, setAgencyNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleWithdraw = async () => {
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    
    if (method === "pix") {
      if (!pixKey.trim()) {
        toast({
          title: t.pix?.keyRequired || "Chave PIX obrigatória",
          description: t.pix?.keyRequiredDesc || "Informe sua chave PIX para receber o saque",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!bankCode || !accountNumber || !agencyNumber) {
        toast({
          title: "Dados bancários incompletos",
          description: "Preencha todos os campos da conta bancária",
          variant: "destructive",
        });
        return;
      }
    }

    if (isNaN(amountCents) || amountCents <= 0) {
      toast({
        title: t.pix?.invalidAmount || "Valor inválido",
        description: t.pix?.invalidAmountDesc || "Informe um valor maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (amountCents > availableBalanceCents) {
      toast({
        title: t.pix?.insufficientBalance || "Saldo insuficiente",
        description: `${t.pix?.insufficientBalanceDesc || "Seu saldo disponível é"} ${formatBRL(availableBalanceCents)}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Para transferência bancária, montamos uma chave PIX com os dados bancários
      // Woovi/OpenPix pode processar usando os dados bancários
      let withdrawKey = pixKey.trim();
      
      if (method === "bank") {
        // Para transferência bancária, usamos os dados como metadata
        withdrawKey = `BANK:${bankCode}:${agencyNumber}:${accountNumber}:${accountType}`;
      }

      const response = await supabase.functions.invoke("pix-withdraw", {
        body: {
          userId,
          pixKey: withdrawKey,
          pixKeyType: method === "bank" ? "BANK_ACCOUNT" : undefined,
          amountCents,
          metadata: method === "bank" ? {
            bankCode,
            agencyNumber,
            accountNumber,
            accountType,
          } : undefined,
        },
      });

      // Handle edge function errors - the error message is in response.data
      if (response.error) {
        // Try to get the error message from the response data
        const errorMessage = response.data?.error || response.error.message || "Erro ao processar saque";
        throw new Error(errorMessage);
      }

      if (response.data?.success) {
        setSuccess(true);
        toast({
          title: t.pix?.successAuto || "Saque processado!",
          description: method === "pix" 
            ? (t.pix?.successAutoDesc || "Seu saque via PIX foi processado automaticamente")
            : "Sua transferência bancária foi processada",
        });
        onSuccess();
        
        setTimeout(() => {
          setSuccess(false);
          resetForm();
          onOpenChange(false);
        }, 3000);
      } else {
        throw new Error(response.data?.error || "Erro ao processar saque");
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

  const resetForm = () => {
    setPixKey("");
    setBankCode("");
    setAccountNumber("");
    setAgencyNumber("");
    setAccountType("checking");
    setAmount("");
  };

  const handleWithdrawAll = () => {
    setAmount((availableBalanceCents / 100).toFixed(2).replace('.', ','));
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t.pix?.successAuto || "Saque Processado!"}</h3>
            <p className="text-muted-foreground text-center">
              {method === "pix" 
                ? (t.pix?.successAutoDesc || "Seu saque via PIX foi processado automaticamente")
                : "Sua transferência bancária foi processada"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-500" />
            Sacar Saldo Disponível
          </DialogTitle>
          <DialogDescription>
            Escolha como deseja receber seu saldo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Saldo disponível */}
          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">{t.pix?.availableBalance || "Saldo disponível"}</p>
            <p className="text-2xl font-bold text-green-500">{formatBRL(availableBalanceCents)}</p>
            {availableBalanceCents > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleWithdrawAll}
                className="mt-2 border-green-500 text-green-500 hover:bg-green-500/10"
              >
                Sacar tudo
              </Button>
            )}
          </div>

          {/* Método de saque */}
          <div className="space-y-3">
            <Label>Método de saque</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as WithdrawMethod)}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="method-pix"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  method === "pix" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="pix" id="method-pix" />
                <QrCode className="h-4 w-4" />
                <span className="text-sm font-medium">PIX</span>
              </Label>
              <Label
                htmlFor="method-bank"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  method === "bank" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="bank" id="method-bank" />
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Transferência</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Campos PIX */}
          {method === "pix" && (
            <div className="space-y-2">
              <Label htmlFor="pix-key">{t.pix?.pixKey || "Chave PIX"}</Label>
              <Input
                id="pix-key"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={t.pix?.pixKeyPlaceholder || "CPF, email, telefone ou chave aleatória"}
              />
            </div>
          )}

          {/* Campos Transferência Bancária */}
          {method === "bank" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bank">Banco</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {SUPPORTED_BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.code} - {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência</Label>
                  <Input
                    id="agency"
                    value={agencyNumber}
                    onChange={(e) => setAgencyNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="0000"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">Conta</Label>
                  <Input
                    id="account"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000-0"
                    maxLength={12}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t.pix?.amount || "Valor"} (R$)</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.pix?.amountPlaceholder || "Ex: 5,00"}
              type="text"
              inputMode="decimal"
            />
          </div>

          {/* Botão de saque */}
          <Button
            onClick={handleWithdraw}
            disabled={loading || availableBalanceCents <= 0}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t.pix?.processing || "Processando..."}
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" />
                {t.pix?.withdrawNow || "Sacar Agora"}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {method === "pix" 
              ? (t.pix?.instantProcessing || "Saques via PIX são processados instantaneamente")
              : "Transferências bancárias podem levar até 1 dia útil"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixWithdrawDialog;
