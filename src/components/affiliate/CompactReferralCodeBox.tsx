import { useState, useCallback, useMemo } from "react";
import { Save, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/siteUrl";
import { ShareDialog } from "@/components/ShareDialog";
import { useLanguage } from "@/hooks/useLanguage";

const CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;

interface CompactReferralCodeBoxProps {
  userId: string;
  initialCode?: string;
  onCodeSaved?: (code: string) => void;
}

const CompactReferralCodeBox: React.FC<CompactReferralCodeBoxProps> = ({ 
  userId, 
  initialCode = "", 
  onCodeSaved 
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [code, setCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const referralLink = useMemo(() => {
    if (!code.trim()) return null;
    return `${siteUrl}/subscribe?ref=${code.trim()}`;
  }, [code]);

  const handleSaveCode = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast({ title: t.affiliate.codeRequired, description: t.affiliate.defineCode, variant: "destructive" });
      return;
    }

    if (!CODE_REGEX.test(trimmed)) {
      toast({ title: t.affiliate.invalidFormat, description: t.affiliate.formatHint, variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", trimmed)
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        toast({ title: t.affiliate.codeInUse, description: t.affiliate.codeInUseDesc, variant: "destructive" });
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ referral_code: trimmed })
        .eq("id", userId);

      if (updateError) throw updateError;

      setCode(trimmed);
      onCodeSaved?.(trimmed);
      toast({ title: t.affiliate.codeSaved, description: t.affiliate.codeUpdated });
    } catch (err) {
      console.error("[compact-referral] save code error", err);
      toast({ title: t.affiliate.errorSavingCode, description: t.affiliate.errorLoading, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [code, userId, onCodeSaved, toast, t]);

  const handleShare = useCallback(() => {
    if (!code.trim()) {
      toast({ title: t.affiliate.defineCodeFirst, variant: "destructive" });
      return;
    }
    setShowShareDialog(true);
  }, [code, toast, t]);

  return (
    <>
      <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          {t.affiliate.createReferralCode || "Criar código de indicação"}
        </p>
        <div className="flex gap-2">
          <Input 
            value={code} 
            onChange={(e) => setCode(e.target.value.toUpperCase())} 
            placeholder="SEU-CODIGO" 
            className="uppercase text-xs h-8 flex-1" 
          />
          <Button 
            onClick={handleSaveCode} 
            disabled={saving} 
            size="sm" 
            className="h-8 px-2"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
        </div>
        
        {referralLink && (
          <Button 
            onClick={handleShare} 
            variant="default" 
            size="sm" 
            className="w-full h-8 text-xs gap-1"
          >
            <Share2 className="h-3 w-3" />
            {t.common.shareLink || "Compartilhar link"}
          </Button>
        )}
      </div>

      <ShareDialog 
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        link={referralLink || ""}
        title="Cadastre-se na StreamStar"
      />
    </>
  );
};

export default CompactReferralCodeBox;
