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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Video } from "lucide-react";
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
import ChatModerationPanel from "@/components/ChatModerationPanel";
import type { User } from "@supabase/supabase-js";

type DailyRoomResponse = {
  url: string;
  name?: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const [showGoLiveDialog, setShowGoLiveDialog] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [approvedForLive, setApprovedForLive] = useState(false);

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
        setDisplayName(creatorData.display_name);
        setBio(creatorData.bio || "");
        setTags(creatorData.tags?.join(", ") || "");
        setIsStreaming(creatorData.is_streaming);
        setDailyRoomUrl(creatorData.daily_room_url);
        setApprovedForLive(Boolean((creatorData as Record<string, unknown>).approved_for_live ?? false));

        // Get current room if streaming
        if (creatorData.is_streaming) {
          const { data: roomData } = await supabase
            .from("rooms")
            .select("id")
            .eq("creator_id", session.user.id)
            .eq("is_active", true)
            .single();
          
          if (roomData) {
            setCurrentRoomId(roomData.id);
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);



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
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar";
      toast({
        title: "Erro ao atualizar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStreamingRequest = (checked: boolean) => {
    if (checked) {
      if (!approvedForLive) {
        toast({
          title: "Aguardando aprovacao",
          description: "Sua conta ainda nao foi aprovada para iniciar lives.",
          variant: "destructive",
        });
        return;
      }
      setShowGoLiveDialog(true);
    } else {
      handleToggleStreaming(false);
    }
  };

  const handleConfirmGoLive = () => {
    setShowGoLiveDialog(false);
    handleToggleStreaming(true);
  };

  const handleToggleStreaming = async (checked: boolean) => {
    if (checked && !approvedForLive) {
      toast({
        title: "Aguardando aprovacao",
        description: "Sua conta ainda nao foi aprovada para iniciar lives.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let roomUrl = dailyRoomUrl;

      // Create Daily.co room if going live and no room exists
      if (checked && !roomUrl) {
        const { data: roomData, error: roomError } = await supabase.functions.invoke<DailyRoomResponse>(
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
          .eq("id", user?.id);

        // Create room record
        const { data: newRoom } = await supabase
          .from("rooms")
          .insert({
            creator_id: user?.id,
            title: displayName,
            daily_room_name: roomData.name,
            is_active: true,
          })
          .select()
          .single();

        if (newRoom) {
          setCurrentRoomId(newRoom.id);
        }
      }

      const { error } = await supabase
        .from("creator_profiles")
        .update({ is_streaming: checked })
        .eq("id", user?.id);

      if (error) throw error;

      setIsStreaming(checked);
      
      if (checked) {
        toast({
          title: "TransmissÃ£o ativada!",
          description: "Redirecionando para painel de controle...",
        });
        
        // Redirect to live management page
        setTimeout(() => {
          navigate("/live-management");
        }, 1000);
      } else {
        toast({
          title: "TransmissÃ£o desativada",
          description: "VocÃª ficou offline",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao alterar status";
      toast({
        title: "Erro ao alterar status",
        description: message,
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
              <CardTitle>Ative seu perfil de criador</CardTitle>
              <CardDescription>
                Para comecar a transmitir, ative seu perfil de criador na pagina de perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Va ate a pagina de perfil para definir seu nome de exibicao e ativar o perfil de criador.
              </p>
              <Button onClick={() => navigate("/profile")} className="w-full">
                Ir para meu perfil
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {!approvedForLive && (
              <Alert>
                <AlertTitle>Conta em avaliacao</AlertTitle>
                <AlertDescription>
                  Aguarde a aprovacao da equipe para iniciar transmissao ao vivo. Voce ja pode configurar seu perfil.
                </AlertDescription>
              </Alert>
            )}
            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle>Status de TransmissÃ£o</CardTitle>
                <CardDescription>
                  Ative para aparecer como AO VIVO na pÃ¡gina inicial
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
                    onCheckedChange={handleToggleStreamingRequest}
                    disabled={loading || (!approvedForLive && !isStreaming)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-card">
              <CardHeader>
                <CardTitle>Editar Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informaÃ§Ãµes de criador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-display-name">Nome de ExibiÃ§Ã£o</Label>
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
                  {loading ? "Salvando..." : "Salvar AlteraÃ§Ãµes"}
                </Button>
              </CardContent>
            </Card>

            {isStreaming && dailyRoomUrl && currentRoomId && (
              <>
                <Card className="border-border shadow-card bg-gradient-card">
                  <CardHeader>
                    <CardTitle>Sua TransmissÃ£o</CardTitle>
                    <CardDescription>
                      Controle sua cÃ¢mera, microfone e compartilhamento de tela
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
                      <DailyVideoPlayer roomUrl={dailyRoomUrl} isCreator={true} />
                    </div>
                  </CardContent>
                </Card>

                <ChatModerationPanel roomId={currentRoomId} creatorId={user.id} />

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

      <AlertDialog open={showGoLiveDialog} onOpenChange={setShowGoLiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar TransmissÃ£o ao Vivo?</AlertDialogTitle>
            <AlertDialogDescription>
              VocÃª estÃ¡ prestes a ficar online. Seus espectadores poderÃ£o ver sua transmissÃ£o assim que vocÃª confirmar. Sua cÃ¢mera e microfone serÃ£o ativados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGoLive}>
              Sim, Ficar Online
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;



