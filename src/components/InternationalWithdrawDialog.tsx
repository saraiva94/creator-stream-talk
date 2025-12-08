import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Globe, Banknote } from "lucide-react";

interface InternationalWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InternationalWithdrawDialog = ({
  open,
  onOpenChange,
}: InternationalWithdrawDialogProps) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleProceed = () => {
    // Open Mercado Pago international transfer page
    window.open("https://www.mercadopago.com.br/money-out/bank-transfer", "_blank");
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setShowConfirmation(false);
    onOpenChange(false);
  };

  if (showConfirmation) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              Atenção - Saque Internacional
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-yellow-500 font-medium text-center">
                Saques internacionais sujeitos a taxas. Faça uma conta em bancos ou bancos digitais brasileiros para evitar taxas.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleProceed}
                variant="outline"
                className="w-full border-primary/50 hover:bg-primary/10"
              >
                <Globe className="h-4 w-4 mr-2" />
                Prefiro sacar pro meu banco internacional
              </Button>
              
              <Button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Vou usar uma conta brasileira (PIX)
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Recomendamos criar uma conta em bancos digitais brasileiros como Nubank, Inter, C6 ou Mercado Pago para saques sem taxas via PIX.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Saque Internacional
          </DialogTitle>
          <DialogDescription>
            Para usuários fora do Brasil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Se você não possui uma conta bancária brasileira, pode realizar saques via transferência bancária internacional através do Mercado Pago.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-500">
                Taxas de transferência internacional podem ser aplicadas pelo banco de destino.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowConfirmation(true)}
            className="w-full"
            variant="outline"
          >
            <Globe className="h-4 w-4 mr-2" />
            Continuar com saque internacional
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InternationalWithdrawDialog;
