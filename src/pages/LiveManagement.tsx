import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import ChatBox from "@/components/ChatBox";
import { WebRTCPublisher } from "@/components/webrtc";
import { SingleStepStreamControl } from "@/components/SingleStepStreamControl";
import { LiveConfigPanel, type VideoOrientation } from "@/components/LiveConfigPanel";
import SuperChatQueue from "@/components/SuperChatQueue";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import { CreatorMobileFullscreen } from "@/components/live/CreatorMobileFullscreen";
import { useIsMobileOrTablet } from "@/hooks/useDeviceType";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Users, DollarSign, TrendingUp, Video, UserPlus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type RoomRecord = {
  id: string;
};

type TransactionRow = {
  amount: number | string | null;
  type?: string | null;
};

type CreatorStatus = "loading" | "not_creator" | "pending_approval" | "approved";

// LiveKit single-step flow: idle -> live (no preparing phase)
type StreamPhase = "idle" | "live";

const LiveManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [user, setUser] = useState<User | null>(null);
  const [creatorStatus, setCreatorStatus] = useState<CreatorStatus>("loading");
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [revenue, setRevenue] = useState({ total: 0, superchats: 0 });
  const [loading, setLoading] = useState(true);
  const [liveTitle, setLiveTitle] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | null>(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [videoOrientation, setVideoOrientation] = useState<VideoOrientation>("vertical");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [currentLiveId, setCurrentLiveId] = useState<string | null>(null);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [pendingSuperchatCount, setPendingSuperchatCount] = useState(0);
  const [activeSuperchat, setActiveSuperchat] = useState<{
    id: string;
    message: string;
    tier: "blue" | "yellow" | "red";
    duration_seconds: number;
    username: string;
    expires_at: string;
  } | null>(null);

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
        setCreatorStatus("not_creator");
        setLoading(false);
        return;
      }

      if (!creatorProfile.approved_for_live) {
        logger.creator.warn("Creator not approved for live");
        setCreatorStatus("pending_approval");
        setLoading(false);
        return;
      }

      setCreatorStatus("approved");

      // Check for existing active room
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("creator_id", session.user.id)
        .eq("is_active", true)
        .single();

      if (existingRoom) {
        setRoom(existingRoom);
        // Check if there's an active live to determine phase
        const { data: activeLive } = await supabase
          .from("lives")
          .select("id")
          .eq("creator_id", session.user.id)
          .eq("is_active", true)
          .maybeSingle();
        
        if (activeLive) {
          setStreamPhase("live");
          setIsStreaming(true);
          setCurrentLiveId(activeLive.id);
        } else {
          // Room exists but no active live - go back to idle
          setStreamPhase("idle");
          setIsStreaming(false);
        }
        logger.creator.info("Active room found", { roomId: existingRoom.id });
      } else if (creatorProfile.is_streaming) {
        // Out of sync - reset streaming flag
        await supabase.from("creator_profiles").update({ is_streaming: false }).eq("id", session.user.id);
        setStreamPhase("idle");
        setIsStreaming(false);
      } else {
        setRoom(null);
        setStreamPhase("idle");
        setIsStreaming(false);
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  // Single-step "Go Live" - create room and go live immediately
  const handleGoLive = async () => {
    if (!user) return;

    try {
      // Clean up any stale rooms first
      await supabase
        .from("rooms")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("creator_id", user.id)
        .eq("is_active", true);

      // Create local room record first (for chat)
      const { data: newRoom, error: roomError } = await supabase
        .from("rooms")
        .insert({
          creator_id: user.id,
          title: liveTitle || "Live Stream",
          is_active: true,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create chat settings for the room
      await supabase.from("chat_settings").insert({
        room_id: newRoom.id,
      });

      // Create live entry immediately as "live" (active)
      const { data: liveData, error: liveError } = await supabase.from("lives").insert({
        creator_id: user.id,
        title: liveTitle || "Live Stream",
        status: "live",
        is_active: true,
        chat_room_id: newRoom.id,
        thumbnail_url: thumbnailUrl,
        host_joined_at: new Date().toISOString(),
        host_last_heartbeat: new Date().toISOString(),
      }).select().single();

      if (liveError) throw liveError;

      // Update creator profile to show as streaming
      await supabase
        .from("creator_profiles")
        .update({ is_streaming: true })
        .eq("id", user.id);

      setCurrentLiveId(liveData.id);
      setRoom(newRoom);
      setStreamPhase("live");
      setIsStreaming(true);

      logger.live.info("Stream is now LIVE", { roomId: newRoom.id, liveId: liveData.id });
      toast({
        title: t.liveManagement?.streamStarted || "Você está ao vivo!",
        description: t.liveManagement?.youAreLiveNow || "Sua transmissão está visível para todos.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao iniciar transmissão";
      logger.live.error("Go live error", { error: message });
      toast({
        title: t.common?.error || "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  // End streaming
  const handleEndStream = async () => {
    if (!user) return;

    try {
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
        .update({ is_streaming: false })
        .eq("id", user.id);

      setStreamPhase("idle");
      setIsStreaming(false);
      setRoom(null);
      setCurrentLiveId(null);
      logger.live.info("Stream ended");
      toast({
        title: t.liveManagement?.streamEnded || "Transmissão encerrada",
        description: t.liveManagement?.youAreOfflineNow || "Você está offline agora",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (t.liveManagement?.toggleError || "Error changing stream");
      logger.live.error("Stream end error", { error: message });
      toast({
        title: t.common?.error || "Error",
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

  // Fetch pending superchat count
  useEffect(() => {
    if (!room?.id || !user?.id) return;

    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from("superchats")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("status", "pending");
      
      setPendingSuperchatCount(count || 0);
    };

    fetchPendingCount();

    const channel = supabase
      .channel(`superchats_count:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "superchats",
          filter: `room_id=eq.${room.id}`,
        },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, user?.id]);

  const handleTitleChange = useCallback((title: string) => {
    setLiveTitle(title);
  }, []);

  const handleDevicesChange = useCallback((audioId: string | null, videoId: string | null) => {
    setSelectedAudioDevice(audioId);
    setSelectedVideoDevice(videoId);
  }, []);

  const handleMirrorChange = useCallback((mirrored: boolean) => {
    setIsMirrored(mirrored);
  }, []);

  const handleThumbnailChange = useCallback((url: string | null) => {
    setThumbnailUrl(url);
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground animate-pulse">{t.common?.loading || "Loading..."}</p>
        </div>
      </AppLayout>
    );
  }

  if (creatorStatus === "not_creator") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <Video className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">{t.liveManagement?.notCreator || "Creator Access Only"}</h2>
          <p className="text-muted-foreground max-w-md">
            {t.liveManagement?.notCreatorDesc || "Activate your creator profile to start streaming."}
          </p>
          <Button onClick={() => navigate("/profile")}>
            {t.liveManagement?.goToProfile || "Go to Profile"}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (creatorStatus === "pending_approval") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <UserPlus className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">{t.liveManagement?.awaitingApproval || "Pending Approval"}</h2>
          <p className="text-muted-foreground max-w-md">
            {t.liveManagement?.awaitingApprovalDesc || "Your creator account is awaiting approval. You'll be able to stream once approved."}
          </p>
        </div>
      </AppLayout>
    );
  }

  // Mobile/Tablet: Fullscreen vertical layout
  if (isMobileOrTablet) {
    return (
      <CreatorMobileFullscreen
        roomId={room?.id || null}
        creatorId={user?.id || ""}
        creatorDisplayName={user?.user_metadata?.display_name}
        isStreaming={isStreaming}
        onStreamToggle={() => {}}
        onGoLive={handleGoLive}
        onEndStream={handleEndStream}
        participants={participants}
        revenue={revenue}
        activeSuperchat={activeSuperchat}
        onSuperchatExpire={() => setActiveSuperchat(null)}
        onOpenSettings={() => setShowSettingsSheet(true)}
        onSelectSuperchat={(sc) => setActiveSuperchat(sc)}
        pendingSuperchatCount={pendingSuperchatCount}
        liveUrl={currentLiveId ? `${window.location.origin}/live/${currentLiveId}` : undefined}
        streamPhase={streamPhase}
        liveId={currentLiveId}
      />
    );
  }

  // Desktop Layout
  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6">
        {/* Header with MODE badge and Stream Control */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Video className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">{t.liveManagement?.streamControl || "Live Management"}</h1>
            <Badge variant="secondary" className="ml-2">
              MODE: LIVEKIT
            </Badge>
          </div>
          <SingleStepStreamControl
            isLive={streamPhase === "live"}
            onGoLive={handleGoLive}
            onEndStream={handleEndStream}
          />
        </div>

        {/* Stats Cards */}
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{participants}</p>
                    <p className="text-xs text-muted-foreground">{t.liveManagement?.viewers || "Viewers"}</p>
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
                    <p className="text-xs text-muted-foreground">{t.liveManagement?.totalRevenue || "Total Revenue"}</p>
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

        {/* Mobile Layout: Video + Chat stacked, Config below */}
          <div className="lg:hidden space-y-4">
            {/* Video Preview - Only show when live */}
            <Card className="border-border overflow-hidden relative aspect-video">
              {streamPhase === "live" && currentLiveId ? (
                <WebRTCPublisher
                  liveId={currentLiveId}
                  onReady={() => console.log("[LiveManagement] WebRTC Publisher ready")}
                  onError={(err) => console.error("[LiveManagement] WebRTC error:", err)}
                />
              ) : (
                <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="text-lg">Transmissão desligada</p>
                  <p className="text-sm">Clique em "Ficar Online" para iniciar</p>
                </div>
              )}
              {activeSuperchat && (
                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <SuperChatDisplay
                    superchat={activeSuperchat}
                    onExpire={() => setActiveSuperchat(null)}
                  />
                </div>
              )}
            </Card>
          {/* Chat immediately below video on mobile */}
          <div className="h-[350px]">
            {room && user ? (
              <ChatBox
                roomId={room.id}
                currentUserId={user.id}
                creatorId={user.id}
                isCreator={true}
              />
            ) : (
              <Card className="border-border h-full flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  {t.liveManagement?.startToActivateChat || "Start streaming to activate chat"}
                </p>
              </Card>
            )}
          </div>

          {/* SuperChat Queue */}
          {room && user && (
            <SuperChatQueue
              roomId={room.id}
              creatorId={user.id}
              onSelectSuperchat={(sc) => setActiveSuperchat({
                id: sc.id,
                message: sc.message,
                tier: sc.tier,
                duration_seconds: sc.duration_seconds,
                username: sc.username || "Usuário",
                expires_at: (sc as { expires_at?: string }).expires_at || new Date(Date.now() + sc.duration_seconds * 1000).toISOString(),
              })}
            />
          )}

          {/* Config Panel */}
          <LiveConfigPanel
            roomId={room?.id || null}
            creatorId={user?.id || ""}
            onTitleChange={handleTitleChange}
            onDevicesChange={handleDevicesChange}
            onMirrorChange={handleMirrorChange}
            onThumbnailChange={handleThumbnailChange}
          />
        </div>

        {/* Desktop Layout: Video + Config on left, Chat on right */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {/* Left side: Video + Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Creator Embed - Only show when live */}
            <Card className="border-border overflow-hidden relative aspect-video">
              {streamPhase === "live" && currentLiveId ? (
                <WebRTCPublisher
                  liveId={currentLiveId}
                  onReady={() => console.log("[LiveManagement] WebRTC Publisher ready (desktop)")}
                  onError={(err) => console.error("[LiveManagement] WebRTC error:", err)}
                />
              ) : (
                <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="text-lg">Transmissão desligada</p>
                  <p className="text-sm">Clique em "Ficar Online" para iniciar</p>
                </div>
              )}
              {activeSuperchat && (
                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <SuperChatDisplay
                    superchat={activeSuperchat}
                    onExpire={() => setActiveSuperchat(null)}
                  />
                </div>
              )}
            </Card>
            {/* SuperChat Queue for creator */}
            {room && user && (
              <SuperChatQueue
                roomId={room.id}
                creatorId={user.id}
                onSelectSuperchat={(sc) => setActiveSuperchat({
                  id: sc.id,
                  message: sc.message,
                  tier: sc.tier,
                  duration_seconds: sc.duration_seconds,
                  username: sc.username || "Usuário",
                  expires_at: (sc as { expires_at?: string }).expires_at || new Date(Date.now() + sc.duration_seconds * 1000).toISOString(),
                })}
              />
            )}

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

          {/* Chat - Right side on desktop */}
          <div className="lg:col-span-1">
            {room && user ? (
              <div className="h-[calc(100vh-200px)] min-h-[500px] sticky top-24">
                <ChatBox
                  roomId={room.id}
                  currentUserId={user.id}
                  creatorId={user.id}
                  isCreator={true}
                />
              </div>
            ) : (
              <Card className="border-border h-[500px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  {t.liveManagement?.startToActivateChat || "Start streaming to activate chat"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  );
};

export default LiveManagement;
