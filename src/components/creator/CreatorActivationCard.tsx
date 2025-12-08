import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

type CreatorProfileRow = {
  display_name: string | null;
  bio: string | null;
  tags: string[] | null;
  approved_for_live: boolean | null;
};

const CreatorActivationCard = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    const loadCreatorStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUser(session.user);

      const { data: creatorData } = await supabase
        .from("creator_profiles")
        .select("display_name, bio, tags, approved_for_live")
        .eq("id", session.user.id)
        .maybeSingle();

      if (creatorData) {
        const row = creatorData as CreatorProfileRow;
        setIsCreator(true);
        setIsApproved(row.approved_for_live ?? false);
        setDisplayName(row.display_name ?? "");
        setBio(row.bio ?? "");
        setTags(row.tags?.join(", ") ?? "");
      }
      setLoading(false);
    };
    loadCreatorStatus();
  }, []);

  const handleActivate = async () => {
    if (!user) {
      toast({ title: t.creator.loginFirst, description: t.creator.loginDesc, variant: "destructive" });
      return;
    }
    if (!displayName.trim()) {
      toast({ title: t.creator.requiredField, description: t.creator.displayNameRequired, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const formattedTags = tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      const { error } = await supabase.from("creator_profiles").upsert(
        { id: user.id, display_name: displayName.trim(), bio: bio.trim() || null, tags: formattedTags, approved_for_live: false },
        { onConflict: "id" }
      ).select();
      if (error) throw error;

      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          type: "creator_activation_request",
          title: t.creator.requestSentTitle,
          message: `${displayName.trim()}`,
        }));
        await supabase.from("notifications").insert(notifications);
      }

      setIsCreator(true);
      toast({ title: t.creator.requestSent, description: t.creator.awaitApproval });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.creator.errorCreating;
      toast({ title: t.creator.errorCreating, description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border shadow-card">
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {t.creator.loading}
        </CardContent>
      </Card>
    );
  }

  if (isCreator) {
    return (
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle>{isApproved ? t.creator.profileActive : t.creator.requestSentTitle}</CardTitle>
          <CardDescription>{isApproved ? t.creator.approvedDesc : t.creator.waitingApproval}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{t.creator.displayName}: <span className="font-semibold text-foreground">{displayName || t.creator.notDefined}</span></p>
          {tags && <p className="text-sm text-muted-foreground">{t.creator.tags}: <span className="font-semibold text-foreground">{tags}</span></p>}
          {isApproved ? <p className="text-sm text-green-500">✅ {t.creator.approvedLive}</p> : <p className="text-sm text-warning">⏳ {t.creator.waitingAdmin}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-card">
      <CardHeader>
        <CardTitle>{t.creator.activateProfile}</CardTitle>
        <CardDescription>{t.creator.activateDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="creator-display-name">{t.creator.displayName} *</Label>
          <Input id="creator-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t.creator.displayNamePlaceholder} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="creator-bio">{t.creator.bio}</Label>
          <Textarea id="creator-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t.creator.bioPlaceholder} rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="creator-tags">{t.creator.tags}</Label>
          <Input id="creator-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t.creator.tagsPlaceholder} />
        </div>
        <Button onClick={handleActivate} className="w-full" disabled={submitting}>
          {submitting ? t.creator.creating : t.creator.activate}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CreatorActivationCard;
