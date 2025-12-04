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
import { logger } from "@/lib/logger";

type CreatorProfileRow = {
  display_name: string | null;
  bio: string | null;
  tags: string[] | null;
  approved_for_live: boolean | null;
};

const CreatorActivationCard = () => {
  const { toast } = useToast();
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
      logger.creator.info('Carregando status de criador');
      
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        logger.creator.debug('Sem sessão ativa, não é possível carregar status');
        setLoading(false);
        return;
      }

      logger.creator.debug('Sessão encontrada', { userId: session.user.id });
      setUser(session.user);

      const { data: creatorData, error } = await supabase
        .from("creator_profiles")
        .select("display_name, bio, tags, approved_for_live")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        logger.creator.error('Erro ao buscar perfil de criador', { userId: session.user.id }, error);
      }

      if (creatorData) {
        const row = creatorData as CreatorProfileRow;
        logger.creator.info('Perfil de criador encontrado', {
          userId: session.user.id,
          displayName: row.display_name,
          approved: row.approved_for_live,
          hasBio: !!row.bio,
          tagsCount: row.tags?.length ?? 0,
        });
        
        setIsCreator(true);
        setIsApproved(row.approved_for_live ?? false);
        setDisplayName(row.display_name ?? "");
        setBio(row.bio ?? "");
        setTags(row.tags?.join(", ") ?? "");
      } else {
        logger.creator.debug('Usuário ainda não tem perfil de criador', { userId: session.user.id });
      }

      setLoading(false);
    };

    loadCreatorStatus();
  }, []);

  const handleActivate = async () => {
    if (!user) {
      logger.creator.warn('Tentativa de ativar sem usuário logado');
      toast({
        title: "Faça login",
        description: "Entre na sua conta para ativar o perfil de criador.",
        variant: "destructive",
      });
      return;
    }

    if (!displayName.trim()) {
      logger.creator.warn('Validação falhou: Nome de exibição vazio');
      toast({
        title: "Campo obrigatório",
        description: "Digite um nome de exibição.",
        variant: "destructive",
      });
      return;
    }

    logger.creator.info('Iniciando ativação de perfil de criador', {
      userId: user.id,
      displayName: displayName.trim(),
      hasBio: !!bio.trim(),
      tags: tags,
    });

    setSubmitting(true);
    try {
      const formattedTags = tags
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      logger.creator.debug('Tags formatadas', { tags: formattedTags });

      const upsertPayload = {
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        tags: formattedTags,
        approved_for_live: false,
      };

      logger.creator.info('Executando upsert no creator_profiles', { payload: upsertPayload });

      const { error, data } = await supabase.from("creator_profiles").upsert(
        upsertPayload,
        { onConflict: "id" },
      ).select();

      if (error) {
        logger.creator.error('Erro no upsert do creator_profiles', { 
          userId: user.id,
          errorCode: error.code,
          errorMessage: error.message,
        }, error);
        throw error;
      }

      logger.creator.info('Perfil de criador criado/atualizado com sucesso', { data });

      // Notificar admins
      logger.creator.debug('Buscando administradores para notificação');
      const { data: admins, error: adminsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminsError) {
        logger.creator.warn('Erro ao buscar admins', {}, adminsError);
      }

      if (admins && admins.length > 0) {
        logger.creator.info('Admins encontrados, enviando notificações', { adminCount: admins.length });
        
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          type: "creator_activation_request",
          title: "Nova solicitação de criador",
          message: `O usuário ${displayName.trim()} solicitou aprovação para fazer lives.`,
        }));

        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        
        if (notifError) {
          logger.creator.warn('Erro ao criar notificações', {}, notifError);
        } else {
          logger.creator.info('Notificações enviadas com sucesso', { count: notifications.length });
        }
      } else {
        logger.creator.warn('Nenhum admin encontrado para notificar');
      }

      setIsCreator(true);
      logger.creator.info('Ativação de criador concluída com sucesso');
      
      toast({
        title: "Solicitação enviada!",
        description: "Aguarde a aprovação de um administrador para iniciar suas lives.",
      });
    } catch (error: unknown) {
      logger.creator.error('Erro fatal na ativação de criador', { userId: user.id }, error as Error);
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
          <CardTitle>
            {isApproved ? "Perfil de Criador Ativo" : "Solicitação de criador enviada"}
          </CardTitle>
          <CardDescription>
            {isApproved 
              ? "Você está aprovado para fazer lives!" 
              : "Sua solicitação foi enviada para aprovação."}
          </CardDescription>
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
          {isApproved ? (
            <p className="text-sm text-green-500">
              ✅ Aprovado! Acesse o Dashboard para iniciar suas lives.
            </p>
          ) : (
            <p className="text-sm text-warning">
              ⏳ Aguardando aprovação de um administrador para iniciar lives.
            </p>
          )}
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
