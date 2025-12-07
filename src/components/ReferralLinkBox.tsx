import { useCallback, useMemo, useState } from "react";
import { LinkIcon, Loader2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/ShareDialog";

interface ReferralLinkBoxProps {
  referralCode?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const ReferralLinkBox: React.FC<ReferralLinkBoxProps> = ({ referralCode, loading = false, onRefresh }) => {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const referralLink = useMemo(() => {
    if (!referralCode || typeof window === "undefined") return null;
    return `${window.location.origin}/subscribe?ref=${referralCode}`;
  }, [referralCode]);

  const handleCopy = useCallback(() => {
    if (!referralLink || copying) return;
    setCopying(true);
    navigator.clipboard
      ?.writeText(referralLink)
      .then(() => {
        toast({ title: "Copiado!", description: "Link copiado para a área de transferência" });
      })
      .catch((error) => {
        console.debug("[referral-link] copy failed", error);
        toast({ title: "Erro ao copiar", description: "Tente novamente", variant: "destructive" });
      })
      .finally(() => setCopying(false));
  }, [copying, referralLink, toast]);

  const handleShare = useCallback(() => {
    setShareDialogOpen(true);
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Link de Afiliado
            </CardTitle>
            <CardDescription>Compartilhe para ganhar comissões de cadastros.</CardDescription>
          </div>
          {onRefresh ? (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only">Atualizar</span>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando seu link...
            </div>
          ) : referralLink ? (
            <div className="flex flex-col gap-3">
              <code className="break-all rounded bg-muted px-3 py-2 text-sm">{referralLink}</code>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  onClick={handleShare} 
                  disabled={!referralLink}
                  className="flex-1 gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar link
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum link disponível ainda.</p>
          )}
        </CardContent>
      </Card>

      <ShareDialog 
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        link={referralLink || ""}
        title="Cadastre-se na StreamStar"
      />
    </>
  );
};

export default ReferralLinkBox;
