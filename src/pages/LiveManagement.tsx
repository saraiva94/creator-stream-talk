import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ChatBox from "@/components/ChatBox";
import { NativeVideoPreview } from "@/components/NativeVideoPreview";
import { StreamToggle } from "@/components/StreamToggle";
import { LiveConfigPanel } from "@/components/LiveConfigPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  useEffect(() => {
    const checkAuth = async () => {
      logger.auth.info("LiveManagement checkAuth started");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Get creator profile
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

      // Check current streaming status
      setIsStreaming(creatorProfile.is_streaming || false);

      // Get or create active room
      let activeRoom = null;
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("creator_id", session.user.id)
        .eq("is_active", true)
        .single();

      if (existingRoom) {
        activeRoom = existingRoom;
      }

      setRoom(activeRoom);
      logger.creator.info("Room status", { hasRoom: !!activeRoom, roomId: activeRoom?.id });
      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  // Handle streaming toggle
  const handleStreamToggle = async (streaming: boolean) => {
    if (!user) return;

    try {
      if (streaming) {
        // Create room if doesn't exist
        let roomId = room?.id;
        
        if (!roomId) {
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
          roomId = newRoom.id;
          setRoom(newRoom);

          // Create chat settings for the room
          await supabase.from("chat_settings").insert({
            room_id: roomId,
          });
        }

        // Create live record
        await supabase.from("lives").insert({
          creator_id: user.id,
          title: liveTitle || "Live Stream",
          status: "live",
          is_active: true,
          room_name: roomId,
        });

        // Update creator profile
        await supabase
          .from("creator_profiles")
          .update({ 
            is_streaming: true,
            daily_room_url: roomId,
          })
          .eq("id", user.id);

        setIsStreaming(true);
        logger.live.info("Stream started", { roomId });
        toast({
          title: "Transmissão iniciada!",
          description: "Você está ao vivo agora",
        });
      } else {
        // End stream
        if (room?.id) {
          await supabase
            .from("rooms")
            .update({ is_active: false, ended_at: new Date().toISOString() })
            .eq("id", room.id);
        }

        // Update any active lives
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

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video + Chat */}
          <div className="lg:col-span-2 space-y-6">
            {/* Native Video Preview */}
            <Card className="border-border overflow-hidden">
              <NativeVideoPreview
                audioDeviceId={selectedAudioDevice}
                videoDeviceId={selectedVideoDevice}
                isStreaming={isStreaming}
              />
            </Card>

            {/* Chat */}
            {room && user && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Chat ao Vivo</CardTitle>
                  <CardDescription>Interaja com seus espectadores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ChatBox
                      roomId={room.id}
                      currentUserId={user.id}
                      creatorId={user.id}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Configuration Panel */}
          <div>
            <LiveConfigPanel
              roomId={room?.id || null}
              creatorId={user?.id || ""}
              onTitleChange={handleTitleChange}
              onDevicesChange={handleDevicesChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveManagement;
