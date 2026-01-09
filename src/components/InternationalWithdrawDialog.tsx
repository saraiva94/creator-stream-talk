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
                Saques internacionais sujeitos a taxas. Faça uma conta em bancos digitais brasileiros para evitar taxas.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Vou usar uma conta brasileira (PIX)
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Recomendamos criar uma conta em bancos digitais brasileiros como Nubank, Inter ou C6 para saques sem taxas via PIX.
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
            Se você não possui uma conta bancária brasileira, recomendamos criar uma conta em um banco digital brasileiro para receber saques via PIX sem taxas.
          </p>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Banknote className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-primary">
                Bancos digitais como Nubank, Inter e C6 permitem abertura de conta para estrangeiros com documentação válida.
              </p>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-500">
                Saques PIX são processados apenas para contas bancárias brasileiras.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowConfirmation(true)}
            className="w-full"
            variant="outline"
          >
            <Globe className="h-4 w-4 mr-2" />
            Entendi, vou abrir uma conta brasileira
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InternationalWithdrawDialog;
