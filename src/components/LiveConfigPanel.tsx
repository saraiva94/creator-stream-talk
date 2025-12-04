import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, MessageSquare, X, Camera, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LiveConfigPanelProps {
  roomId: string | null;
  creatorId: string;
  onTitleChange: (title: string) => void;
  onDevicesChange: (audioId: string, videoId: string) => void;
}

interface MediaDevice {
  deviceId: string;
  label: string;
}

export const LiveConfigPanel = ({
  roomId,
  creatorId,
  onTitleChange,
  onDevicesChange,
}: LiveConfigPanelProps) => {
  // Live settings
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Chat settings
  const [slowModeEnabled, setSlowModeEnabled] = useState(false);
  const [slowModeDuration, setSlowModeDuration] = useState(5);
  const [subscribersOnly, setSubscribersOnly] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [newBannedWord, setNewBannedWord] = useState("");
  const [charLimit, setCharLimit] = useState(200);

  // Device settings
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          .then(stream => {
            // Stop the stream immediately after getting permissions
            stream.getTracks().forEach(track => track.stop());
            setPermissionsGranted(true);
          });

        const devices = await navigator.mediaDevices.enumerateDevices();

        const audio = devices
          .filter((d) => d.kind === "audioinput" && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microfone ${d.deviceId.slice(0, 8)}`,
          }));

        const video = devices
          .filter((d) => d.kind === "videoinput" && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Câmera ${d.deviceId.slice(0, 8)}`,
          }));

        setAudioDevices(audio);
        setVideoDevices(video);

        // Auto-select first devices
        if (audio.length > 0 && !selectedAudio) {
          setSelectedAudio(audio[0].deviceId);
        }
        if (video.length > 0 && !selectedVideo) {
          setSelectedVideo(video[0].deviceId);
        }
      } catch (err) {
        console.error("Error loading devices:", err);
      }
    };

    loadDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    };
  }, []);

  // Propagate device changes
  useEffect(() => {
    if (selectedAudio && selectedVideo) {
      onDevicesChange(selectedAudio, selectedVideo);
    }
  }, [selectedAudio, selectedVideo, onDevicesChange]);

  // Propagate title changes
  useEffect(() => {
    onTitleChange(title);
  }, [title, onTitleChange]);

  // Load chat settings if room exists
  useEffect(() => {
    if (!roomId) return;

    const loadChatSettings = async () => {
      const { data } = await supabase
        .from("chat_settings")
        .select("*")
        .eq("room_id", roomId)
        .single();

      if (data) {
        setSlowModeEnabled(data.slow_mode_enabled || false);
        setSlowModeDuration(data.slow_mode_duration || 5);
        setSubscribersOnly(data.subscribers_only || false);
        setBannedWords(data.banned_words || []);
      }
    };

    loadChatSettings();
  }, [roomId]);

  // Save chat settings
  const saveChatSettings = async () => {
    if (!roomId) return;

    await supabase
      .from("chat_settings")
      .upsert({
        room_id: roomId,
        slow_mode_enabled: slowModeEnabled,
        slow_mode_duration: slowModeDuration,
        subscribers_only: subscribersOnly,
        banned_words: bannedWords,
      });
  };

  // Auto-save chat settings on change
  useEffect(() => {
    if (roomId) {
      const timeout = setTimeout(saveChatSettings, 500);
      return () => clearTimeout(timeout);
    }
  }, [slowModeEnabled, slowModeDuration, subscribersOnly, bannedWords, roomId]);

  const addBannedWord = () => {
    if (newBannedWord.trim() && !bannedWords.includes(newBannedWord.trim().toLowerCase())) {
      setBannedWords([...bannedWords, newBannedWord.trim().toLowerCase()]);
      setNewBannedWord("");
    }
  };

  const removeBannedWord = (word: string) => {
    setBannedWords(bannedWords.filter((w) => w !== word));
  };

  return (
    <div className="space-y-4">
      {/* Live Title & Description */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" />
            Configurações da Live
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="live-title">Título da Live</Label>
            <Input
              id="live-title"
              placeholder="Ex: Live de games com premiação!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{title.length}/100</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="live-description">Descrição (opcional)</Label>
            <Textarea
              id="live-description"
              placeholder="Descreva o que vai rolar na sua live..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Device Settings */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Dispositivos
          </CardTitle>
          <CardDescription>
            {permissionsGranted 
              ? "Selecione câmera e microfone"
              : "Permita acesso à câmera e microfone"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audio-device" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microfone
            </Label>
            <Select value={selectedAudio} onValueChange={setSelectedAudio}>
              <SelectTrigger id="audio-device">
                <SelectValue placeholder="Selecione um microfone" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-device" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Câmera
            </Label>
            <Select value={selectedVideo} onValueChange={setSelectedVideo}>
              <SelectTrigger id="video-device">
                <SelectValue placeholder="Selecione uma câmera" />
              </SelectTrigger>
              <SelectContent>
                {videoDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Chat Settings */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Configurações do Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Slow Mode */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Modo lento</Label>
              <p className="text-xs text-muted-foreground">
                Intervalo entre mensagens
              </p>
            </div>
            <Switch
              checked={slowModeEnabled}
              onCheckedChange={setSlowModeEnabled}
            />
          </div>
          {slowModeEnabled && (
            <Select
              value={slowModeDuration.toString()}
              onValueChange={(v) => setSlowModeDuration(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 segundos</SelectItem>
                <SelectItem value="5">5 segundos</SelectItem>
                <SelectItem value="10">10 segundos</SelectItem>
                <SelectItem value="30">30 segundos</SelectItem>
                <SelectItem value="60">1 minuto</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Subscribers Only */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Apenas inscritos</Label>
              <p className="text-xs text-muted-foreground">
                Somente inscritos podem enviar mensagens
              </p>
            </div>
            <Switch
              checked={subscribersOnly}
              onCheckedChange={setSubscribersOnly}
            />
          </div>

          {/* Character Limit */}
          <div className="space-y-2">
            <Label>Limite de caracteres</Label>
            <Select
              value={charLimit.toString()}
              onValueChange={(v) => setCharLimit(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 caracteres</SelectItem>
                <SelectItem value="200">200 caracteres</SelectItem>
                <SelectItem value="300">300 caracteres</SelectItem>
                <SelectItem value="500">500 caracteres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Banned Words */}
          <div className="space-y-2">
            <Label>Palavras bloqueadas</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar palavra..."
                value={newBannedWord}
                onChange={(e) => setNewBannedWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBannedWord()}
              />
              <Button variant="outline" size="sm" onClick={addBannedWord}>
                Adicionar
              </Button>
            </div>
            {bannedWords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {bannedWords.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeBannedWord(word)}
                  >
                    {word}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
