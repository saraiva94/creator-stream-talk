import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import JitsiPlayer from "@/components/JitsiPlayer";
import ChatBox from "@/components/ChatBox";
import ChatModerationPanel from "@/components/ChatModerationPanel";
import DeviceSelector from "@/components/DeviceSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, DollarSign, TrendingUp, Circle, MonitorOff } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type CreatorProfile = {
  approved_for_live?: boolean | null;
  daily_room_url?: string | null; // Legacy column name, stores Jitsi room
};

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
  const [jitsiRoomUrl, setJitsiRoomUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState(0);
  const [revenue, setRevenue] = useState({ total: 0, superchats: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      logger.auth.info("LiveManagement checkAuth started");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Get creator profile (align with backend guard)
      const { data: creatorProfile, error: creatorError } = await supabase
        .from("creator_profiles")
        .select("*, profiles(username)")
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

      if (!(creatorProfile as Record<string, unknown>).approved_for_live) {
        logger.creator.warn("Creator not approved for live");
        toast({
          title: "Aguardando aprovação",
          description: "Sua conta ainda não foi aprovada para transmissão ao vivo.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Check for Jitsi room (stored in legacy daily_room_url column)
      if (!creatorProfile?.daily_room_url) {
        logger.creator.warn("No Jitsi room configured");
        toast({
          title: "Erro",
          description: "Você precisa iniciar a transmissão primeiro",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setJitsiRoomUrl(creatorProfile.daily_room_url);
      logger.creator.info("Jitsi room loaded", { roomUrl: creatorProfile.daily_room_url });

      // Get active room
      const { data: activeRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("creator_id", session.user.id)
        .eq("is_active", true)
        .single();

      setRoom(activeRoom);
      logger.creator.info("Active room status", { hasRoom: !!activeRoom, roomId: activeRoom?.id });
      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  useEffect(() => {
    if (!room?.id) return;

    // Fetch participants count
    const fetchParticipants = async () => {
      const { count } = await supabase
        .from("room_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      setParticipants(count || 0);
      logger.live.debug("Participants count", { count: count || 0 });
    };

    fetchParticipants();

    // Real-time participants
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
        () => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Fetch revenue data
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
        logger.live.debug("Revenue fetched", { total, superchats });
      }
    };

    fetchRevenue();

    // Real-time revenue updates
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
        () => {
          fetchRevenue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleEndStream = async () => {
    if (!room?.id || !user?.id) return;

    logger.live.info("Ending stream", { roomId: room.id });

    try {
      // Update room status
      await supabase
        .from("rooms")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", room.id);

      // Update creator profile (clear Jitsi room from legacy column)
      await supabase
        .from("creator_profiles")
        .update({ is_streaming: false, daily_room_url: null })
        .eq("id", user.id);

      logger.live.info("Stream ended successfully");
      toast({
        title: "Transmissão encerrada",
        description: "Você está offline agora",
      });

      navigate("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao encerrar";
      logger.live.error("End stream error", { error: message });
      toast({
        title: "Erro ao encerrar",
        description: message,
        variant: "destructive",
      });
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

      <main className="container mx-auto px-4 py-6">
        {/* Header with stats */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge className="bg-destructive text-white animate-pulse h-8 px-4">
              <Circle className="h-3 w-3 mr-2 fill-white" />
              AO VIVO
            </Badge>
            <Button
              variant="destructive"
              onClick={handleEndStream}
              className="h-8"
            >
              <MonitorOff className="h-4 w-4 mr-2" />
              Encerrar Live
            </Button>
          </div>

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
                  <DollarSign className="h-5 w-5 text-success" />
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
            {/* Video */}
            <Card className="border-border overflow-hidden">
              <div className="aspect-video bg-secondary">
                {jitsiRoomUrl && (
                  <JitsiPlayer roomName={jitsiRoomUrl} />
                )}
              </div>
            </Card>

            {/* Chat */}
            {room && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Chat ao Vivo</CardTitle>
                  <CardDescription>
                    Interaja com seus espectadores
                  </CardDescription>
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

          {/* Moderation Panel & Device Settings */}
          <div className="space-y-6">
            <DeviceSelector />
            {room && (
              <ChatModerationPanel roomId={room.id} creatorId={user.id} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveManagement;
