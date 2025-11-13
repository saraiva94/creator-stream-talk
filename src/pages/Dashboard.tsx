import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import DailyVideoPlayer from "@/components/DailyVideoPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Video, Users } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Check if user is a creator
      const { data: creatorData } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (creatorData) {
        setIsCreator(true);
        setCreatorProfile(creatorData);
        setDisplayName(creatorData.display_name);
        setBio(creatorData.bio || "");
        setTags(creatorData.tags?.join(", ") || "");
        setIsStreaming(creatorData.is_streaming);
        setDailyRoomUrl(creatorData.daily_room_url);
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleBecomeCreator = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um nome de exibição",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("creator_profiles").insert({
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      });

      if (error) throw error;

      toast({
        title: "Perfil de criador ativado!",
        description: "Você agora pode fazer transmissões ao vivo.",
      });

      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({
        title: "Erro ao criar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStreaming = async (checked: boolean) => {
    setLoading(true);
    try {
      let roomUrl = dailyRoomUrl;

      // Create Daily.co room if going live and no room exists
      if (checked && !roomUrl) {
        const { data: roomData, error: roomError } = await supabase.functions.invoke(
          "create-daily-room",
          {
            body: { roomTitle: displayName },
          }
        );

        if (roomError) throw roomError;
        roomUrl = roomData.url;
        setDailyRoomUrl(roomUrl);

        // Update creator profile with room URL
        await supabase
          .from("creator_profiles")
          .update({ daily_room_url: roomUrl })
          .eq("id", user.id);
      }

      const { error } = await supabase
        .from("creator_profiles")
        .update({ is_streaming: checked })
        .eq("id", user.id);

      if (error) throw error;

      setIsStreaming(checked);
      toast({
        title: checked ? "Transmissão ativada!" : "Transmissão desativada",
        description: checked
          ? "Seu status agora está como AO VIVO"
          : "Você ficou offline",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Video className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Dashboard do Criador</h1>
        </div>

        {!isCreator ? (
          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle>Torne-se um Criador</CardTitle>
              <CardDescription>
                Configure seu perfil para começar a fazer transmissões ao vivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Nome de Exibição *</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome como criador"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte sobre você..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Música, Jogos, Tecnologia"
                />
              </div>

              <Button
                onClick={handleBecomeCreator}
                className="w-full"
                disabled={loading}
              >
                {loading ? "Criando..." : "Ativar Perfil de Criador"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle>Status de Transmissão</CardTitle>
                <CardDescription>
                  Ative para aparecer como AO VIVO na página inicial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isStreaming ? (
                      <>
                        <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                        <span className="font-semibold text-destructive">
                          AO VIVO
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">
                          OFFLINE
                        </span>
                      </>
                    )}
                  </div>
                  <Switch
                    checked={isStreaming}
                    onCheckedChange={handleToggleStreaming}
                    disabled={loading}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle>Editar Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações de criador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-display-name">Nome de Exibição</Label>
                  <Input
                    id="edit-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-bio">Bio</Label>
                  <Textarea
                    id="edit-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tags">Tags</Label>
                  <Input
                    id="edit-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleUpdateProfile}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>

            {isStreaming && dailyRoomUrl && (
              <>
                <Card className="border-border shadow-card bg-gradient-card">
                  <CardHeader>
                    <CardTitle>Sua Transmissão</CardTitle>
                    <CardDescription>
                      Controle sua câmera, microfone e compartilhamento de tela
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
                      <DailyVideoPlayer roomUrl={dailyRoomUrl} isCreator={true} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-card">
                  <CardHeader>
                    <CardTitle>Compartilhe sua Sala</CardTitle>
                    <CardDescription>
                      Envie este link para seus espectadores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${window.location.origin}/room/${user.id}`}
                        readOnly
                      />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/room/${user.id}`
                          );
                          toast({
                            title: "Link copiado!",
                          });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
