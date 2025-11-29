import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCredits?: () => void;
  onContinue?: () => void;
};

const JitsiLowCreditModal = ({ open, onOpenChange, onAddCredits, onContinue }: Props) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créditos baixos</AlertDialogTitle>
          <AlertDialogDescription>
            Seu saldo está abaixo do limite mínimo. Adicione créditos para continuar assistindo sem interrupções.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
          <AlertDialogCancel>Fechar</AlertDialogCancel>
          {onContinue && (
            <AlertDialogAction onClick={onContinue}>
              Continuar
            </AlertDialogAction>
          )}
          {onAddCredits && <AlertDialogAction onClick={onAddCredits}>Adicionar créditos</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default JitsiLowCreditModal;
