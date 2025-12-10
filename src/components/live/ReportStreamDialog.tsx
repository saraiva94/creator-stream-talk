import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { Flag, Loader2, CheckCircle } from "lucide-react";

interface ReportStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveId: string;
  creatorId: string;
  currentUserId: string | null;
}

const REPORT_REASONS = [
  { value: "inappropriate_content", labelKey: "inappropriateContent" },
  { value: "harassment", labelKey: "harassment" },
  { value: "spam", labelKey: "spam" },
  { value: "violence", labelKey: "violence" },
  { value: "copyright", labelKey: "copyright" },
  { value: "other", labelKey: "other" },
] as const;

export const ReportStreamDialog: React.FC<ReportStreamDialogProps> = ({
  open,
  onOpenChange,
  liveId,
  creatorId,
  currentUserId,
}) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!currentUserId || !reason) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("content_reports").insert({
        reporter_id: currentUserId,
        live_id: liveId,
        creator_id: creatorId,
        reason,
        description: description.trim() || null,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: t.report?.submitted || "Denúncia enviada",
        description: t.report?.submittedDesc || "Sua denúncia foi enviada para análise.",
      });

      setTimeout(() => {
        onOpenChange(false);
        setIsSubmitted(false);
        setReason("");
        setDescription("");
      }, 2000);
    } catch (error) {
      console.error("[ReportStreamDialog] Error:", error);
      toast({
        title: t.common?.error || "Erro",
        description: t.report?.errorDesc || "Não foi possível enviar a denúncia.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonLabel = (key: string) => {
    const labels: Record<string, string> = {
      inappropriateContent: t.report?.inappropriateContent || "Conteúdo inapropriado",
      harassment: t.report?.harassment || "Assédio ou bullying",
      spam: t.report?.spam || "Spam ou conteúdo enganoso",
      violence: t.report?.violence || "Violência ou conteúdo gráfico",
      copyright: t.report?.copyright || "Violação de direitos autorais",
      other: t.report?.other || "Outro motivo",
    };
    return labels[key] || key;
  };

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h3 className="text-xl font-semibold">
              {t.report?.thankYou || "Obrigado!"}
            </h3>
            <p className="text-muted-foreground text-center">
              {t.report?.reviewMessage || "Nossa equipe irá analisar sua denúncia."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            {t.report?.title || "Denunciar transmissão"}
          </DialogTitle>
          <DialogDescription>
            {t.report?.description || "Selecione o motivo da sua denúncia. Sua identidade será mantida em sigilo."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <RadioGroup value={reason} onValueChange={setReason}>
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-3">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className="cursor-pointer">
                  {getReasonLabel(r.labelKey)}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t.report?.additionalDetails || "Detalhes adicionais (opcional)"}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.report?.placeholder || "Descreva o problema..."}
              className="resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t.common?.cancel || "Cancelar"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || isSubmitting || !currentUserId}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.common?.sending || "Enviando..."}
              </>
            ) : (
              t.report?.submit || "Enviar denúncia"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
