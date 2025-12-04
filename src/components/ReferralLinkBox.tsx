import { useCallback, useMemo, useState } from "react";
import { LinkIcon, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ReferralLinkBoxProps {
  referralCode?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const ReferralLinkBox: React.FC<ReferralLinkBoxProps> = ({ referralCode, loading = false, onRefresh }) => {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

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
        toast({ title: "Copied!", description: "Referral link copied to clipboard" });
      })
      .catch((error) => {
        console.debug("[referral-link] copy failed", error);
        toast({ title: "Unable to copy", description: "Please try again", variant: "destructive" });
      })
      .finally(() => setCopying(false));
  }, [copying, referralLink, toast]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Referral link
          </CardTitle>
          <CardDescription>Share this link to earn registration commissions.</CardDescription>
        </div>
        {onRefresh ? (
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh referral link</span>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating your link...
          </div>
        ) : referralLink ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all rounded bg-muted px-3 py-2 text-sm">{referralLink}</code>
            <Button variant="secondary" onClick={handleCopy} disabled={!referralLink || copying}>
              {copying ? "Copying..." : "Copy"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No referral link available yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralLinkBox;
