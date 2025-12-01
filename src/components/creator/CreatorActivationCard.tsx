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

type CreatorProfile = {
  display_name: string;
  bio?: string | null;
  tags?: string[] | null;
};

const CreatorActivationCard = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    const loadCreatorStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      const { data: creatorData } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (creatorData) {
        const profile: CreatorProfile = creatorData;
        setIsCreator(true);
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
        setTags(profile.tags?.join(", ") ?? "");
      }

      setLoading(false);
    };

    loadCreatorStatus();
  }, []);

  const handleActivate = async () => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Entre na sua conta para ativar o perfil de criador.",
        variant: "destructive",
      });
      return;
    }

    if (!displayName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um nome de exibição.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const formattedTags = tags
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const { error } = await supabase.from("creator_profiles").upsert(
        {
          id: user.id,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          tags: formattedTags,
        },
        { onConflict: "id" },
      );

      if (error) throw error;

      setIsCreator(true);
      toast({
        title: "Perfil de criador ativado!",
        description: "Agora você pode iniciar lives e configurar suas informações.",
      });
    } catch (error: unknown) {
      console.error("[creator] activation error", error);
      const message = error instanceof Error ? error.message : "Erro ao criar perfil";
      toast({
        title: "Erro ao criar perfil",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border shadow-card">
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando...
        </CardContent>
      </Card>
    );
  }

  if (isCreator) {
    return (
      <Card className="border-border shadow-card">
        <CardHeader>
          <CardTitle>Perfil de criador ativo</CardTitle>
          <CardDescription>Seu perfil de criador já está habilitado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Nome de exibição: <span className="font-semibold text-foreground">{displayName || "Não definido"}</span>
          </p>
          {tags && (
            <p className="text-sm text-muted-foreground">
              Tags: <span className="font-semibold text-foreground">{tags}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">Configure lives e edite detalhes no painel do criador.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-card">
      <CardHeader>
        <CardTitle>Ativar perfil de criador</CardTitle>
        <CardDescription>Defina seu nome de exibição e ative o perfil para poder iniciar transmissões ao vivo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="creator-display-name">Nome de Exibição *</Label>
          <Input
            id="creator-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome como criador"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="creator-bio">Bio</Label>
          <Textarea
            id="creator-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conte sobre você..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="creator-tags">Tags (separadas por vírgula)</Label>
          <Input
            id="creator-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Música, Jogos, Tecnologia"
          />
        </div>

        <Button onClick={handleActivate} className="w-full" disabled={submitting}>
          {submitting ? "Criando..." : "Ativar Perfil de Criador"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CreatorActivationCard;
