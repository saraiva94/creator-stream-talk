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
import { Copy, CheckCircle, Loader2, QrCode, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { usePaymentStatus, PaymentIntent } from "@/hooks/usePaymentStatus";
import QRCode from "qrcode";

export interface PixPaymentData {
  qrCode: string;
  qrCodeImage?: string;
  expiresAt: string;
  transactionId: string;
  paymentId: string;
  amount: number;
  eventType: string;
  description?: string;
  externalRef?: string;
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
}: PixPaymentDialogProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [localStatus, setLocalStatus] = useState<'pending' | 'confirmed'>('pending');
  const [checking, setChecking] = useState(false);
  const [generatedQrImage, setGeneratedQrImage] = useState<string | null>(null);

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

  const { status: paymentStatus, isPaid, refetch } = usePaymentStatus({
    externalRef: open ? externalRef : null,
    onPaid: handlePaid,
    pollingIntervalMs: 3000,
    maxPollingDurationMs: 600000, // 10 minutes - no auto-expiration
  });

  // Reset status when dialog opens with new data
  useEffect(() => {
    if (open && pixData) {
      setLocalStatus('pending');
      setGeneratedQrImage(null);
    }
  }, [open, pixData?.paymentId]);

  // Generate QR code image from the PIX string if no image provided
  useEffect(() => {
    if (!pixData?.qrCode || pixData.qrCodeImage) return;
    
    QRCode.toDataURL(pixData.qrCode, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        setGeneratedQrImage(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });
  }, [pixData?.qrCode, pixData?.qrCodeImage]);

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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  // Handle dialog close - only allow manual close
  const handleOpenChange = (newOpen: boolean) => {
    // Always allow closing (user clicked close or navigated away)
    onOpenChange(newOpen);
  };

  if (!pixData) return null;

  const displayStatus = isPaid ? 'confirmed' : localStatus;
  const qrImageToShow = pixData.qrCodeImage || generatedQrImage;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {/* Status - Confirmed */}
          {displayStatus === 'confirmed' && (
            <Alert className="bg-green-500/10 border-green-500/50">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">
                Pagamento confirmado com sucesso!
              </AlertDescription>
            </Alert>
          )}

          {/* QR Code - Always visible when pending */}
          {displayStatus === 'pending' && (
            <>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  {qrImageToShow ? (
                    <img
                      src={qrImageToShow}
                      alt="PIX QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* PIX Copy-Paste Code - Always visible */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center font-medium">
                  Código PIX Copia e Cola:
                </p>
                <div className="relative">
                  <textarea
                    readOnly
                    value={pixData.qrCode}
                    className="w-full h-24 text-xs p-3 pr-20 rounded-md bg-muted border font-mono resize-none focus:outline-none"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </div>
                
                {/* Copy button - prominent */}
                <Button
                  variant={copied ? "default" : "secondary"}
                  className="w-full"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código
                    </>
                  )}
                </Button>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
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

          {/* Close button - always visible */}
          <Button 
            variant={displayStatus === 'confirmed' ? "default" : "ghost"}
            className="w-full" 
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentDialog;
