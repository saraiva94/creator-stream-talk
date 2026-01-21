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
import { Banknote, Loader2, CheckCircle, CreditCard, QrCode, AlertCircle, ArrowLeft, User } from "lucide-react";

interface PixWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  availableBalanceCents: number;
  onSuccess: () => void;
}

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Taxa de saque fixa
const WITHDRAWAL_FEE_CENTS = 500; // R$ 5,00

// Formata valor enquanto digita (auto-complete de centavos)
const formatAmountOnChange = (value: string): string => {
  // Remove tudo exceto números
  const digitsOnly = value.replace(/\D/g, '');
  
  if (!digitsOnly) return '';
  
  // Converte para centavos e depois para reais
  const cents = parseInt(digitsOnly, 10);
  const reais = cents / 100;
  
  // Formata com 2 casas decimais
  return reais.toFixed(2).replace('.', ',');
};

// Parse amount string para centavos
const parseAmountToCents = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/\D/g, '');
  return parseInt(cleaned, 10) || 0;
};

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
type Step = "input" | "confirm" | "success";

interface ValidationResult {
  valid: boolean;
  keyType?: string;
  normalizedKey?: string;
  holderName?: string;
  holderDocument?: string;
  bankName?: string;
  error?: string;
}

// Detecta o tipo de chave PIX e formata automaticamente
const detectAndFormatPixKey = (value: string): { formatted: string; type: string | null } => {
  // Remove todos os caracteres não numéricos para análise
  const digitsOnly = value.replace(/\D/g, "");
  
  // Se tem letras ou @, é email ou chave aleatória - não formatar
  if (/[a-zA-Z@]/.test(value)) {
    return { formatted: value, type: value.includes("@") ? "EMAIL" : "EVP" };
  }
  
  // Se começa com +, é telefone internacional
  if (value.startsWith("+")) {
    return { formatted: value, type: "PHONE" };
  }
  
  // Analisa baseado na quantidade de dígitos
  if (digitsOnly.length === 11) {
    // Pode ser CPF ou telefone
    // Se os 2 primeiros dígitos são DDD válido (11-99), provavelmente é telefone
    const firstTwo = parseInt(digitsOnly.substring(0, 2));
    if (firstTwo >= 11 && firstTwo <= 99) {
      // Formata como telefone: (XX) XXXXX-XXXX
      const formatted = `(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7, 11)}`;
      return { formatted, type: "PHONE" };
    }
    // Formata como CPF: XXX.XXX.XXX-XX
    const formatted = `${digitsOnly.substring(0, 3)}.${digitsOnly.substring(3, 6)}.${digitsOnly.substring(6, 9)}-${digitsOnly.substring(9, 11)}`;
    return { formatted, type: "CPF" };
  }
  
  if (digitsOnly.length === 14) {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    const formatted = `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2, 5)}.${digitsOnly.substring(5, 8)}/${digitsOnly.substring(8, 12)}-${digitsOnly.substring(12, 14)}`;
    return { formatted, type: "CNPJ" };
  }
  
  // Para outros casos, retorna sem formatação
  return { formatted: value, type: null };
};

// Formata a chave enquanto digita
const formatPixKeyOnChange = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "");
  
  // Se tem letras ou @, não formatar
  if (/[a-zA-Z@]/.test(value)) {
    return value;
  }
  
  // Se começa com +, é telefone internacional
  if (value.startsWith("+")) {
    return value;
  }
  
  // Formata progressivamente baseado no tamanho
  if (digitsOnly.length <= 11) {
    // Pode ser CPF ou telefone - formata como CPF primeiro
    if (digitsOnly.length <= 3) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `${digitsOnly.substring(0, 3)}.${digitsOnly.substring(3)}`;
    } else if (digitsOnly.length <= 9) {
      return `${digitsOnly.substring(0, 3)}.${digitsOnly.substring(3, 6)}.${digitsOnly.substring(6)}`;
    } else {
      return `${digitsOnly.substring(0, 3)}.${digitsOnly.substring(3, 6)}.${digitsOnly.substring(6, 9)}-${digitsOnly.substring(9)}`;
    }
  } else if (digitsOnly.length <= 14) {
    // CNPJ
    if (digitsOnly.length <= 2) {
      return digitsOnly;
    } else if (digitsOnly.length <= 5) {
      return `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2)}`;
    } else if (digitsOnly.length <= 8) {
      return `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2, 5)}.${digitsOnly.substring(5)}`;
    } else if (digitsOnly.length <= 12) {
      return `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2, 5)}.${digitsOnly.substring(5, 8)}/${digitsOnly.substring(8)}`;
    } else {
      return `${digitsOnly.substring(0, 2)}.${digitsOnly.substring(2, 5)}.${digitsOnly.substring(5, 8)}/${digitsOnly.substring(8, 12)}-${digitsOnly.substring(12)}`;
    }
  }
  
  return value;
};

const PixWithdrawDialog = ({
  open,
  onOpenChange,
  userId,
  availableBalanceCents,
  onSuccess,
}: PixWithdrawDialogProps) => {
  const [step, setStep] = useState<Step>("input");
  const [method, setMethod] = useState<WithdrawMethod>("pix");
  const [pixKey, setPixKey] = useState("");
  const [detectedKeyType, setDetectedKeyType] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [agencyNumber, setAgencyNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Handler para mudança na chave PIX com formatação automática
  const handlePixKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPixKeyOnChange(rawValue);
    setPixKey(formatted);
    
    // Detecta o tipo baseado no valor formatado
    const { type } = detectAndFormatPixKey(formatted);
    setDetectedKeyType(type);
  };

  // Handler para valor com auto-format (usuário digita apenas números)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatAmountOnChange(rawValue);
    setAmount(formatted);
  };

  const handleValidateAndProceed = async () => {
    const amountCents = parseAmountToCents(amount);
    const totalWithFee = amountCents + WITHDRAWAL_FEE_CENTS;
    
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

    if (amountCents <= 0) {
      toast({
        title: t.pix?.invalidAmount || "Valor inválido",
        description: t.pix?.invalidAmountDesc || "Informe um valor maior que zero",
        variant: "destructive",
      });
      return;
    }

    // Valida se tem saldo suficiente para valor + taxa
    if (totalWithFee > availableBalanceCents) {
      toast({
        title: t.pix?.insufficientBalance || "Saldo insuficiente",
        description: `Valor + taxa (${formatBRL(totalWithFee)}) excede seu saldo de ${formatBRL(availableBalanceCents)}`,
        variant: "destructive",
      });
      return;
    }

    // Para PIX, validar a chave primeiro
    if (method === "pix") {
      setValidating(true);
      try {
        const validatePayload = {
          action: "validate",
          userId,
          pixKey: pixKey.trim(),
        };
        console.log('🔍 [PIX-VALIDATE] Iniciando validação...');
        console.log('📦 [PIX-VALIDATE] Payload:', JSON.stringify(validatePayload, null, 2));
        
        const response = await supabase.functions.invoke("pix-withdraw", {
          body: validatePayload,
        });
        
        console.log('📥 [PIX-VALIDATE] Response completo:', response);
        console.log('📊 [PIX-VALIDATE] Data:', JSON.stringify(response.data, null, 2));
        console.log('❌ [PIX-VALIDATE] Error:', response.error);

        if (response.error) {
          console.error('💥 [PIX-VALIDATE] Erro detectado:', response.error);
          throw new Error(response.error.message || "Erro ao validar chave PIX");
        }

        const result = response.data as ValidationResult;
        setValidation(result);

        if (!result.valid) {
          toast({
            title: "Chave PIX inválida",
            description: result.error || "Verifique a chave informada",
            variant: "destructive",
          });
          return;
        }

        // Atualizar a chave normalizada
        if (result.normalizedKey) {
          setPixKey(result.normalizedKey);
        }

        setStep("confirm");
      } catch (error: unknown) {
        console.error('💥 [PIX-VALIDATE] Exception:', error);
        const message = error instanceof Error ? error.message : "Erro ao validar chave";
        toast({
          title: "Erro de validação",
          description: message,
          variant: "destructive",
        });
      } finally {
        setValidating(false);
      }
    } else {
      // Para transferência bancária, ir direto para confirmação
      const selectedBank = SUPPORTED_BANKS.find(b => b.code === bankCode);
      setValidation({
        valid: true,
        holderName: "Confirme os dados bancários abaixo",
        bankName: selectedBank?.name,
      });
      setStep("confirm");
    }
  };

  const handleConfirmWithdraw = async () => {
    console.log('🔥 [PIX-WITHDRAW] handleConfirmWithdraw FOI CHAMADO!');
    console.log('🔥 [PIX-WITHDRAW] Step atual:', step);
    console.log('🔥 [PIX-WITHDRAW] Amount state:', amount);
    console.log('🔥 [PIX-WITHDRAW] PixKey state:', pixKey);
    console.log('🔥 [PIX-WITHDRAW] Loading state:', loading);
    
    // Calcula valor + taxa (taxa é cobrada do saldo, não enviada via API)
    const amountCents = parseAmountToCents(amount);
    const totalDeducted = amountCents + WITHDRAWAL_FEE_CENTS;
    console.log('🔥 [PIX-WITHDRAW] AmountCents calculado:', amountCents, 'Total com taxa:', totalDeducted);
    
    setLoading(true);
    try {
      let withdrawKey = pixKey.trim();
      
      if (method === "bank") {
        withdrawKey = `BANK:${bankCode}:${agencyNumber}:${accountNumber}:${accountType}`;
      }

      const withdrawPayload = {
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
      };
      
      console.log('🚀 [PIX-WITHDRAW] Iniciando chamada à API...');
      console.log('📦 [PIX-WITHDRAW] Payload:', JSON.stringify(withdrawPayload, null, 2));
      console.log('🔑 [PIX-WITHDRAW] UserId:', userId);
      console.log('💰 [PIX-WITHDRAW] Amount (cents):', amountCents);

      const response = await supabase.functions.invoke("pix-withdraw", {
        body: withdrawPayload,
      });

      console.log('📥 [PIX-WITHDRAW] Response completo:', response);
      console.log('📊 [PIX-WITHDRAW] Data:', JSON.stringify(response.data, null, 2));
      console.log('❌ [PIX-WITHDRAW] Error object:', response.error);
      
      if (response.error) {
        console.error('💥 [PIX-WITHDRAW] Erro detectado:', {
          message: response.error.message,
          name: response.error.name,
          context: response.error.context,
          status: response.error.status,
        });
        const errorMessage = response.data?.error || response.error.message || "Erro ao processar saque";
        throw new Error(errorMessage);
      }

      if (response.data?.success) {
        setStep("success");
        
        // Mensagem diferenciada baseada no tipo de processamento
        const isAutomatic = response.data?.automaticProcessing;
        toast({
          title: isAutomatic 
            ? (t.pix?.successAuto || "Saque processado!") 
            : "Saque solicitado!",
          description: isAutomatic
            ? (method === "pix" 
                ? (t.pix?.successAutoDesc || "Seu saque via PIX foi processado automaticamente")
                : "Sua transferência bancária foi processada")
            : "Seu saque foi solicitado e será processado em até 24 horas.",
        });
        onSuccess();
        
        setTimeout(() => {
          resetForm();
          onOpenChange(false);
        }, 3000);
      } else {
        console.error('💥 [PIX-WITHDRAW] Resposta sem success:', response.data);
        throw new Error(response.data?.error || "Erro ao processar saque");
      }
    } catch (error: unknown) {
      console.error('💥 [PIX-WITHDRAW] Exception capturada:', error);
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
    setStep("input");
    setPixKey("");
    setDetectedKeyType(null);
    setBankCode("");
    setAccountNumber("");
    setAgencyNumber("");
    setAccountType("checking");
    setAmount("");
    setValidation(null);
  };

  const handleWithdrawAll = () => {
    // Saca tudo descontando a taxa
    const maxWithdrawCents = Math.max(0, availableBalanceCents - WITHDRAWAL_FEE_CENTS);
    setAmount(formatAmountOnChange(String(maxWithdrawCents)));
  };

  const handleBack = () => {
    setStep("input");
    setValidation(null);
  };

  // Tela de sucesso
  if (step === "success") {
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

  // Tela de confirmação
  if (step === "confirm") {
    const amountCents = parseAmountToCents(amount);
    const totalWithFee = amountCents + WITHDRAWAL_FEE_CENTS;
    const remainingBalance = availableBalanceCents - totalWithFee;
    const selectedBank = SUPPORTED_BANKS.find(b => b.code === bankCode);
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Confirmar Saque
            </DialogTitle>
            <DialogDescription>
              Verifique os dados antes de confirmar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Dados do destinatário */}
            <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
              {method === "pix" ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Chave PIX:</span>
                    <span className="font-mono text-sm">{validation?.normalizedKey || pixKey}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <span className="text-sm font-medium">{validation?.keyType || "Detectado automaticamente"}</span>
                  </div>
                  {validation?.holderName && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Titular:</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">{validation.holderName}</span>
                    </div>
                  )}
                  {validation?.bankName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Banco:</span>
                      <span className="text-sm">{validation.bankName}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Banco:</span>
                    <span className="text-sm font-medium">{selectedBank?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Agência:</span>
                    <span className="font-mono text-sm">{agencyNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Conta:</span>
                    <span className="font-mono text-sm">{accountNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <span className="text-sm">{accountType === "checking" ? "Conta Corrente" : "Poupança"}</span>
                  </div>
                </>
              )}
            </div>

            {/* Breakdown de valores */}
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Valor que você recebe */}
              <div className="flex justify-between items-center p-3 bg-emerald-500/10">
                <span className="text-sm font-medium">Você recebe:</span>
                <span className="text-xl font-bold text-emerald-500">{formatBRL(amountCents)}</span>
              </div>
              
              {/* Taxa de saque */}
              <div className="flex justify-between items-center p-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Taxa de saque:</span>
                <span className="text-sm font-medium text-destructive">- {formatBRL(WITHDRAWAL_FEE_CENTS)}</span>
              </div>
              
              {/* Total debitado */}
              <div className="flex justify-between items-center p-3 border-t border-border bg-muted/50">
                <span className="text-sm font-medium">Total debitado:</span>
                <span className="text-sm font-bold">{formatBRL(totalWithFee)}</span>
              </div>
              
              {/* Saldo restante */}
              <div className="flex justify-between items-center p-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Saldo após saque:</span>
                <span className={`text-sm font-medium ${remainingBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {formatBRL(remainingBalance)}
                </span>
              </div>
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Verifique se os dados estão corretos. Após confirmar, o saque será processado e não poderá ser cancelado.
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleConfirmWithdraw}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Saque
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Tela de entrada de dados (input)
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
                onChange={handlePixKeyChange}
                placeholder={t.pix?.pixKeyPlaceholder || "CPF, email, telefone ou chave aleatória"}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Digite CPF, CNPJ, telefone, email ou chave aleatória
                </p>
                {detectedKeyType && (
                  <span className="text-xs font-medium text-primary px-2 py-0.5 bg-primary/10 rounded">
                    {detectedKeyType}
                  </span>
                )}
              </div>
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

          {/* Valor - com auto-format de moeda */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t.pix?.amount || "Valor a receber"} (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                id="amount"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                type="text"
                inputMode="numeric"
                className="pl-10 text-lg font-medium"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Taxa de saque: {formatBRL(WITHDRAWAL_FEE_CENTS)} por transação
            </p>
          </div>

          {/* Botão de validar e continuar */}
          <Button
            onClick={handleValidateAndProceed}
            disabled={validating || availableBalanceCents <= 0}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Validando...
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" />
                Validar e Continuar
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {method === "pix" 
              ? (t.pix?.instantProcessing || "Saques são processados instantaneamente e automaticamente")
              : "Transferências bancárias podem levar até 1 dia útil"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixWithdrawDialog;