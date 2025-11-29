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

type DecisionAction = "approve" | "reject";

type Props = {
  open: boolean;
  action: DecisionAction;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing?: boolean;
};

const copy: Record<DecisionAction, { title: string; description: string; cta: string; variant: "default" | "destructive" }> =
  {
    approve: {
      title: "Aprovar saque",
      description: "Confirme para aprovar este pedido de saque.",
      cta: "Aprovar",
      variant: "default",
    },
    reject: {
      title: "Rejeitar saque",
      description: "Confirme para rejeitar este pedido de saque.",
      cta: "Rejeitar",
      variant: "destructive",
    },
  };

const WithdrawalDecisionModal = ({ open, action, onOpenChange, onConfirm, isProcessing }: Props) => {
  const content = copy[action];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={onConfirm}
            className={content.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isProcessing ? "Processando..." : content.cta}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default WithdrawalDecisionModal;
