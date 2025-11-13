import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserX, Clock } from "lucide-react";

interface ChatModerationPanelProps {
  roomId: string;
  creatorId: string;
}

const ChatModerationPanel = ({ roomId, creatorId }: ChatModerationPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    subscribers_only: false,
    slow_mode_enabled: false,
    slow_mode_duration: 5,
    banned_words: [] as string[],
  });
  const [newBannedWord, setNewBannedWord] = useState("");
  const [userToBan, setUserToBan] = useState("");

  useEffect(() => {
    loadChatSettings();
  }, [roomId]);

  const loadChatSettings = async () => {
    const { data } = await supabase
      .from("chat_settings")
      .select("*")
      .eq("room_id", roomId)
      .single();

    if (data) {
      setSettings({
        subscribers_only: data.subscribers_only || false,
        slow_mode_enabled: data.slow_mode_enabled || false,
        slow_mode_duration: data.slow_mode_duration || 5,
        banned_words: data.banned_words || [],
      });
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("chat_settings")
        .upsert({
          room_id: roomId,
          subscribers_only: settings.subscribers_only,
          slow_mode_enabled: settings.slow_mode_enabled,
          slow_mode_duration: settings.slow_mode_duration,
          banned_words: settings.banned_words,
        });

      if (error) throw error;

      toast({
        title: "Configurações atualizadas!",
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

  const handleAddBannedWord = () => {
    if (!newBannedWord.trim()) return;
    
    setSettings({
      ...settings,
      banned_words: [...settings.banned_words, newBannedWord.trim().toLowerCase()],
    });
    setNewBannedWord("");
  };

  const handleRemoveBannedWord = (word: string) => {
    setSettings({
      ...settings,
      banned_words: settings.banned_words.filter((w) => w !== word),
    });
  };

  const handleBanUser = async () => {
    if (!userToBan.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite o ID do usuário",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("banned_users").insert({
        room_id: roomId,
        user_id: userToBan.trim(),
        banned_by: creatorId,
        is_permanent: true,
        reason: "Banido pelo moderador",
      });

      if (error) throw error;

      toast({
        title: "Usuário banido!",
      });
      setUserToBan("");
    } catch (error: any) {
      toast({
        title: "Erro ao banir usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Moderação do Chat
        </CardTitle>
        <CardDescription>
          Configure as regras e restrições do chat da sua live
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Chat Apenas para Assinantes</Label>
            <p className="text-sm text-muted-foreground">
              Apenas assinantes podem enviar mensagens
            </p>
          </div>
          <Switch
            checked={settings.subscribers_only}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, subscribers_only: checked })
            }
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Modo Lento
              </Label>
              <p className="text-sm text-muted-foreground">
                Limite de tempo entre mensagens
              </p>
            </div>
            <Switch
              checked={settings.slow_mode_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, slow_mode_enabled: checked })
              }
            />
          </div>
          {settings.slow_mode_enabled && (
            <div className="space-y-2">
              <Label htmlFor="slow-duration">Duração (segundos)</Label>
              <Input
                id="slow-duration"
                type="number"
                min="1"
                max="120"
                value={settings.slow_mode_duration}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    slow_mode_duration: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>Palavras Banidas</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Digite uma palavra..."
              value={newBannedWord}
              onChange={(e) => setNewBannedWord(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddBannedWord()}
            />
            <Button onClick={handleAddBannedWord} variant="secondary">
              Adicionar
            </Button>
          </div>
          {settings.banned_words.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {settings.banned_words.map((word) => (
                <div
                  key={word}
                  className="bg-destructive/10 text-destructive px-3 py-1 rounded-full flex items-center gap-2 text-sm"
                >
                  {word}
                  <button
                    onClick={() => handleRemoveBannedWord(word)}
                    className="hover:text-destructive/80"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Banir Usuário
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="ID do usuário"
              value={userToBan}
              onChange={(e) => setUserToBan(e.target.value)}
            />
            <Button onClick={handleBanUser} variant="destructive" disabled={loading}>
              Banir
            </Button>
          </div>
        </div>

        <Button onClick={handleUpdateSettings} className="w-full" disabled={loading}>
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChatModerationPanel;
