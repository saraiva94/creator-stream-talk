import { useCallback, useMemo, useState } from "react";
import { LinkIcon, Loader2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareDialog } from "@/components/ShareDialog";

interface ReferralLinkBoxProps {
  referralCode?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const ReferralLinkBox: React.FC<ReferralLinkBoxProps> = ({ referralCode, loading = false, onRefresh }) => {
  const [shareOpen, setShareOpen] = useState(false);

  const referralLink = useMemo(() => {
    if (!referralCode || typeof window === "undefined") return null;
    return `${window.location.origin}/subscribe?ref=${referralCode}`;
  }, [referralCode]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Link de Indicação
            </CardTitle>
            <CardDescription>Compartilhe este link para ganhar comissões de cadastro.</CardDescription>
          </div>
          {onRefresh ? (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only">Atualizar link de indicação</span>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando seu link...
            </div>
          ) : referralLink ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <code className="break-all rounded bg-muted px-3 py-2 text-sm flex-1">{referralLink}</code>
              <Button 
                variant="default" 
                onClick={() => setShareOpen(true)} 
                disabled={!referralLink}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar link
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum link de indicação disponível.</p>
          )}
        </CardContent>
      </Card>

      {referralLink && (
        <ShareDialog 
          open={shareOpen} 
          onOpenChange={setShareOpen} 
          url={referralLink}
          title="Compartilhar link de indicação"
        />
      )}
    </>
  );
};

export default ReferralLinkBox;
