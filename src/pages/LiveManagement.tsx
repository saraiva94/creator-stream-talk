import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ChatBox from "@/components/ChatBox";
import { NativeVideoPreview } from "@/components/NativeVideoPreview";
import { StreamToggle } from "@/components/StreamToggle";
import { LiveConfigPanel } from "@/components/LiveConfigPanel";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, DollarSign, TrendingUp } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type RoomRecord = {
  id: string;
};

type TransactionRow = {
  amount: number | string | null;
  type?: string | null;
};

const LiveManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [revenue, setRevenue] = useState({ total: 0, superchats: 0 });
  const [loading, setLoading] = useState(true);
  const [liveTitle, setLiveTitle] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | null>(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      logger.auth.info("LiveManagement checkAuth started");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data: creatorProfile, error: creatorError } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (creatorError || !creatorProfile) {
        logger.creator.warn("Creator profile not found", { error: creatorError?.message });
        toast({
          title: "Acesso negado",
          description: "Apenas criadores podem acessar esta página",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (!creatorProfile.approved_for_live) {
        logger.creator.warn("Creator not approved for live");
        toast({
          title: "Aguardando aprovação",
          description: "Sua conta ainda não foi aprovada para transmissão ao vivo.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Check for existing active room
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("creator_id", session.user.id)
        .eq("is_active", true)
        .single();

      if (existingRoom) {
        setRoom(existingRoom);
        setIsStreaming(true);
        logger.creator.info("Active room found", { roomId: existingRoom.id });
      } else if (creatorProfile.is_streaming) {
        // Out of sync - create a new room since we're marked as streaming
        const roomName = `stream-${session.user.id}-${Date.now()}`;
        const { data: newRoom, error: newRoomError } = await supabase
          .from("rooms")
          .insert({
            creator_id: session.user.id,
            title: "Live Stream",
            is_active: true,
            daily_room_name: roomName,
          })
          .select()
          .single();

        if (!newRoomError && newRoom) {
          setRoom(newRoom);
          setIsStreaming(true);
          await supabase.from("chat_settings").insert({ room_id: newRoom.id });
          logger.creator.info("Created sync room", { roomId: newRoom.id });
        } else {
          // Reset streaming flag since we couldn't create a room
          await supabase.from("creator_profiles").update({ is_streaming: false }).eq("id", session.user.id);
          setIsStreaming(false);
        }
      } else {
        setRoom(null);
        setIsStreaming(false);
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  const handleStreamToggle = async (streaming: boolean) => {
    if (!user) return;

    try {
      if (streaming) {
        // First, clean up any stale rooms
        await supabase
          .from("rooms")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("creator_id", user.id)
          .eq("is_active", true);

        // Create new room
        const roomName = `stream-${user.id}-${Date.now()}`;
        const { data: newRoom, error: roomError } = await supabase
          .from("rooms")
          .insert({
            creator_id: user.id,
            title: liveTitle || "Live Stream",
            is_active: true,
            daily_room_name: roomName,
          })
          .select()
          .single();

        if (roomError) throw roomError;
        
        setRoom(newRoom);

        // Create chat settings for the room
        await supabase.from("chat_settings").insert({
          room_id: newRoom.id,
        });

        // Create live entry with active status
        const { error: liveError } = await supabase.from("lives").insert({
          creator_id: user.id,
          title: liveTitle || "Live Stream",
          status: "live",
          is_active: true,
          room_name: newRoom.id,
          thumbnail_url: thumbnailUrl,
        });

        if (liveError) {
          console.error("Error creating live:", liveError);
        }

        // Update creator profile
        await supabase
          .from("creator_profiles")
          .update({ 
            is_streaming: true,
            daily_room_url: newRoom.id,
          })
          .eq("id", user.id);

        setIsStreaming(true);
        logger.live.info("Stream started", { roomId: newRoom.id });
        toast({
          title: "Transmissão iniciada!",
          description: "Você está ao vivo agora",
        });
      } else {
        // End streaming
        if (room?.id) {
          await supabase
            .from("rooms")
            .update({ is_active: false, ended_at: new Date().toISOString() })
            .eq("id", room.id);
        }

        await supabase
          .from("lives")
          .update({ 
            is_active: false, 
            status: "ended",
            ended_at: new Date().toISOString() 
          })
          .eq("creator_id", user.id)
          .eq("is_active", true);

        await supabase
          .from("creator_profiles")
          .update({ is_streaming: false, daily_room_url: null })
          .eq("id", user.id);

        setIsStreaming(false);
        setRoom(null);
        logger.live.info("Stream ended");
        toast({
          title: "Transmissão encerrada",
          description: "Você está offline agora",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao alterar transmissão";
      logger.live.error("Stream toggle error", { error: message });
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Fetch participants
  useEffect(() => {
    if (!room?.id) return;

    const fetchParticipants = async () => {
      const { count } = await supabase
        .from("room_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      setParticipants(count || 0);
    };

    fetchParticipants();

    const channel = supabase
      .channel(`live_participants:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${room.id}`,
        },
        () => fetchParticipants()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // Fetch revenue
  useEffect(() => {
    if (!user?.id) return;

    const fetchRevenue = async () => {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("creator_id", user.id)
        .eq("status", "approved");

      if (transactions) {
        const total = transactions.reduce((sum: number, t: TransactionRow) => sum + Number(t.amount ?? 0), 0);
        const superchats = transactions
          .filter((t: TransactionRow) => t.type === "superchat")
          .reduce((sum: number, t: TransactionRow) => sum + Number(t.amount ?? 0), 0);
        setRevenue({ total, superchats });
      }
    };

    fetchRevenue();

    const channel = supabase
      .channel(`live_revenue:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `creator_id=eq.${user.id}`,
        },
        () => fetchRevenue()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleDevicesChange = useCallback((audioId: string, videoId: string) => {
    setSelectedAudioDevice(audioId);
    setSelectedVideoDevice(videoId);
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setLiveTitle(title);
  }, []);

  const handleMirrorChange = useCallback((mirrored: boolean) => {
    setIsMirrored(mirrored);
  }, []);

  const handleThumbnailChange = useCallback((url: string) => {
    setThumbnailUrl(url);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-6">
        {/* Header with toggle and stats */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <StreamToggle
            isStreaming={isStreaming}
            onToggle={handleStreamToggle}
          />

          <div className="flex gap-4">
            <Card className="border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{participants}</p>
                    <p className="text-xs text-muted-foreground">Espectadores</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">R$ {revenue.total.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">R$ {revenue.superchats.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">SuperChats</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main content - Twitch-style layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side: Video + Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Native Video Preview */}
            <Card className="border-border overflow-hidden">
              <NativeVideoPreview
                audioDeviceId={selectedAudioDevice}
                videoDeviceId={selectedVideoDevice}
                isStreaming={isStreaming}
                isMirrored={isMirrored}
              />
            </Card>

            {/* Config Panel below video */}
            <LiveConfigPanel
              roomId={room?.id || null}
              creatorId={user?.id || ""}
              onTitleChange={handleTitleChange}
              onDevicesChange={handleDevicesChange}
              onMirrorChange={handleMirrorChange}
              onThumbnailChange={handleThumbnailChange}
            />
          </div>

          {/* Right side: Chat */}
          <div className="lg:col-span-1">
            {room && user ? (
              <div className="h-[calc(100vh-200px)] min-h-[500px] sticky top-24">
                <ChatBox
                  roomId={room.id}
                  currentUserId={user.id}
                  creatorId={user.id}
                />
              </div>
            ) : (
              <Card className="border-border h-[500px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  Inicie a transmissão para ativar o chat
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveManagement;
