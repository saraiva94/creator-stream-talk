import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, CheckCircle, Loader2, QrCode, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { usePaymentStatus, PaymentIntent } from "@/hooks/usePaymentStatus";

export interface PixPaymentData {
  qrCode: string;
  qrCodeImage?: string;
  expiresAt: string;
  transactionId: string;
  paymentId: string;
  amount: number;
  eventType: string;
  description?: string;
  externalRef?: string; // New: use this for realtime tracking
}

interface PixPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pixData: PixPaymentData | null;
  onPaymentConfirmed?: () => void;
  onPaymentExpired?: () => void;
}

export const PixPaymentDialog = ({
  open,
  onOpenChange,
  pixData,
  onPaymentConfirmed,
  onPaymentExpired,
}: PixPaymentDialogProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [localStatus, setLocalStatus] = useState<'pending' | 'confirmed' | 'expired'>('pending');
  const [checking, setChecking] = useState(false);

  // Use the realtime hook for payment status
  const externalRef = pixData?.externalRef || pixData?.paymentId || null;
  
  const handlePaid = useCallback((intent: PaymentIntent) => {
    setLocalStatus('confirmed');
    toast({
      title: "Pagamento confirmado! ✅",
      description: "Seu pagamento foi processado com sucesso.",
    });
    onPaymentConfirmed?.();
  }, [onPaymentConfirmed, toast]);

  const handleFailed = useCallback((intent: PaymentIntent) => {
    if (intent.status === 'expired') {
      setLocalStatus('expired');
      onPaymentExpired?.();
    }
  }, [onPaymentExpired]);

  const { status: paymentStatus, isPaid, refetch } = usePaymentStatus({
    externalRef: open ? externalRef : null,
    onPaid: handlePaid,
    onFailed: handleFailed,
    pollingIntervalMs: 3000,
    maxPollingDurationMs: 180000,
  });

  // Reset status when dialog opens with new data
  useEffect(() => {
    if (open && pixData) {
      setLocalStatus('pending');
    }
  }, [open, pixData?.paymentId]);

  // Calculate time left
  useEffect(() => {
    if (!pixData?.expiresAt || !open) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(pixData.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0 && localStatus === 'pending') {
        setLocalStatus('expired');
        onPaymentExpired?.();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [pixData?.expiresAt, localStatus, onPaymentExpired, open]);

  // Manual check payment status
  const checkPaymentStatus = useCallback(async () => {
    setChecking(true);
    try {
      await refetch();
    } finally {
      setChecking(false);
    }
  }, [refetch]);

  const handleCopyCode = async () => {
    if (!pixData?.qrCode) return;

    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole no seu app de banco para pagar.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: t.common?.error || "Erro",
        description: "Não foi possível copiar o código.",
        variant: "destructive",
      });
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  if (!pixData) return null;

  const displayStatus = isPaid ? 'confirmed' : localStatus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagamento PIX
          </DialogTitle>
          <DialogDescription>
            {pixData.description || "Escaneie o QR code ou copie o código"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Amount */}
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {formatAmount(pixData.amount)}
            </p>
          </div>

          {/* Status indicators */}
          {displayStatus === 'confirmed' && (
            <Alert className="bg-green-500/10 border-green-500/50">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">
                Pagamento confirmado com sucesso!
              </AlertDescription>
            </Alert>
          )}

          {displayStatus === 'expired' && (
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Este QR code expirou. Por favor, gere um novo.
              </AlertDescription>
            </Alert>
          )}

          {/* QR Code */}
          {displayStatus === 'pending' && (
            <>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  {pixData.qrCodeImage ? (
                    <img
                      src={pixData.qrCodeImage}
                      alt="PIX QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                      <QrCode className="h-24 w-24 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Timer */}
              {timeLeft !== null && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    Expira em: {formatTimeLeft(timeLeft)}
                  </span>
                </div>
              )}

              {/* Copy code section */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Ou copie o código Copia e Cola:
                </p>
                <div className="relative">
                  <textarea
                    readOnly
                    value={pixData.qrCode}
                    className="w-full h-20 text-xs p-2 rounded-md bg-muted border font-mono resize-none"
                  />
                  <Button
                    size="sm"
                    variant={copied ? "default" : "secondary"}
                    className="absolute right-2 top-2"
                    onClick={handleCopyCode}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando confirmação do pagamento...
              </div>

              {/* Check status button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={checkPaymentStatus}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Já paguei, verificar
                  </>
                )}
              </Button>
            </>
          )}

          {/* Close button */}
          {displayStatus !== 'pending' && (
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentDialog;
