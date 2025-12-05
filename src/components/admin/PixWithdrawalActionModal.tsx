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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ProcessAction } from "@/lib/pixWithdrawalsService";

type Props = {
  open: boolean;
  action: ProcessAction;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing?: boolean;
  adminNotes: string;
  onAdminNotesChange: (notes: string) => void;
};

const actionConfig: Record<ProcessAction, { 
  title: string; 
  description: string; 
  cta: string; 
  variant: "default" | "destructive";
  showNotes: boolean;
}> = {
  approve: {
    title: "Aprovar Saque PIX",
    description: "Ao aprovar, você confirma que verificou os dados e o saque está pronto para ser processado.",
    cta: "Aprovar",
    variant: "default",
    showNotes: false,
  },
  reject: {
    title: "Rejeitar Saque PIX",
    description: "Ao rejeitar, o valor será devolvido ao saldo do usuário. Informe o motivo da rejeição.",
    cta: "Rejeitar",
    variant: "destructive",
    showNotes: true,
  },
  complete: {
    title: "Marcar como Pago",
    description: "Confirme que a transferência PIX foi realizada com sucesso. Esta ação é irreversível.",
    cta: "Confirmar Pagamento",
    variant: "default",
    showNotes: false,
  },
};

const PixWithdrawalActionModal = ({ 
  open, 
  action, 
  onOpenChange, 
  onConfirm, 
  isProcessing,
  adminNotes,
  onAdminNotesChange,
}: Props) => {
  const config = actionConfig[action];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {config.showNotes && (
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Motivo (opcional)</Label>
            <Textarea
              id="admin-notes"
              placeholder="Informe o motivo da rejeição..."
              value={adminNotes}
              onChange={(e) => onAdminNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={onConfirm}
            className={config.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isProcessing ? "Processando..." : config.cta}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PixWithdrawalActionModal;
