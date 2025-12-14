import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import ChatBox from "@/components/ChatBox";
import { CreatorJitsiEmbed } from "@/components/CreatorJitsiEmbed";
import { TwoStepStreamControl } from "@/components/TwoStepStreamControl";
import { LiveConfigPanel, type VideoOrientation } from "@/components/LiveConfigPanel";
import SuperChatQueue from "@/components/SuperChatQueue";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import { CreatorMobileFullscreen } from "@/components/live/CreatorMobileFullscreen";
import { useIsMobileOrTablet } from "@/hooks/useDeviceType";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Users, DollarSign, TrendingUp, Video, UserPlus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type RoomRecord = {
  id: string;
  daily_room_name: string | null;
};

type TransactionRow = {
  amount: number | string | null;
  type?: string | null;
};

type CreatorStatus = "loading" | "not_creator" | "pending_approval" | "approved";

// Two-step streaming flow:
// 1. "preparing" - Creator opens camera/mic, Jitsi room created but NOT visible to viewers
// 2. "live" - Creator confirms ready, live marked active and visible to viewers
type StreamPhase = "idle" | "preparing" | "live";

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
          // Room exists but no active live = preparing phase
          setStreamPhase("preparing");
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

  // Step 1: Prepare transmission - create room, open camera, but NOT visible to viewers
  const handlePrepareStream = async () => {
    if (!user) return;

    try {
      // Clean up any stale rooms first
      await supabase
        .from("rooms")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("creator_id", user.id)
        .eq("is_active", true);

      // Create new room (but don't create live entry yet)
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

      setStreamPhase("preparing");
      logger.live.info("Preparing stream - room created, waiting for creator to go live", { roomId: newRoom.id });
      toast({
        title: t.liveManagement?.preparingStream || "Preparando transmissão",
        description: t.liveManagement?.cameraReady || "Sua câmera está pronta. Clique em 'Ficar Online' quando estiver pronto.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao preparar transmissão";
      logger.live.error("Prepare stream error", { error: message });
      toast({
        title: t.common?.error || "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Step 2: Go live - mark the live as active, visible to viewers
  const handleGoLive = async () => {
    if (!user || !room) return;

    try {
      // Use the daily_room_name as the Jitsi room name
      const jitsiRoomName = room.daily_room_name || room.id;

      // Create live entry with active status - NOW visible to viewers
      // IMPORTANT: room_name must match the Jitsi room name the creator joined
      const { data: liveData, error: liveError } = await supabase.from("lives").insert({
        creator_id: user.id,
        title: liveTitle || "Live Stream",
        status: "live",
        is_active: true,
        room_name: jitsiRoomName, // Use the actual Jitsi room name
        thumbnail_url: thumbnailUrl,
      }).select().single();

      if (liveError) {
        console.error("Error creating live:", liveError);
        throw liveError;
      }
      
      setCurrentLiveId(liveData.id);

      // Update creator profile to show as streaming
      await supabase
        .from("creator_profiles")
        .update({ 
          is_streaming: true,
          daily_room_url: room.id,
        })
        .eq("id", user.id);

      setStreamPhase("live");
      setIsStreaming(true);
      logger.live.info("Stream is now LIVE and visible to viewers", { roomId: room.id, liveId: liveData.id });
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
        .update({ is_streaming: false, daily_room_url: null })
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

  // Legacy toggle handler for StreamToggle component
  const handleStreamToggle = async (streaming: boolean) => {
    if (streaming) {
      if (streamPhase === "idle") {
        await handlePrepareStream();
      } else if (streamPhase === "preparing") {
        await handleGoLive();
      }
    } else {
      await handleEndStream();
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
    if (!room?.id) {
      setPendingSuperchatCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      const { data, error } = await supabase
        .from("superchats")
        .select("id")
        .eq("room_id", room.id)
        .eq("status", "pending");

      if (!error && data) {
        setPendingSuperchatCount(data.length);
      }
    };

    fetchPendingCount();

    const channel = supabase
      .channel(`superchat_count:${room.id}`)
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
  }, [room?.id]);

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

  const handleOrientationChange = useCallback((orientation: VideoOrientation) => {
    setVideoOrientation(orientation);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t.common?.loading || "Loading..."}</div>
      </div>
    );
  }

  // Show overlay if user is not a creator or not approved
  if (creatorStatus === "not_creator" || creatorStatus === "pending_approval") {
    return (
      <AppLayout showSidebar={false}>
        <div className="relative">
          {/* Blurred background content placeholder */}
          <div className="container mx-auto px-4 py-6 blur-sm pointer-events-none opacity-30">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border h-[400px] bg-muted/20" />
                <Card className="border-border h-[200px] bg-muted/20" />
              </div>
              <div className="lg:col-span-1">
                <Card className="border-border h-[500px] bg-muted/20" />
              </div>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <Card className="max-w-md mx-4 border-primary/20 shadow-2xl">
              <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
                {/* REC indicator */}
                <div className="flex items-center justify-center gap-3">
                  <span 
                    className="w-4 h-4 bg-destructive rounded-full"
                    style={{
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }}
                  />
                  <div className="flex items-center gap-2 text-destructive font-bold text-lg">
                    <Video className="h-6 w-6" />
                    <span>REC</span>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {creatorStatus === "not_creator" 
                      ? (t.liveManagement?.notCreator || "You're not a creator yet")
                      : (t.liveManagement?.awaitingApproval || "Awaiting approval")
                    }
                  </h2>
                  <p className="text-muted-foreground">
                    {creatorStatus === "not_creator"
                      ? (t.liveManagement?.notCreatorDesc || "To broadcast live, you need to request a creator account.")
                      : (t.liveManagement?.awaitingApprovalDesc || "Your request is being reviewed. You will be notified when approved.")
                    }
                  </p>
                </div>

                {/* CTA Button */}
                <Button 
                  onClick={() => navigate("/profile")}
                  className="w-full gap-2"
                  size="lg"
                >
                  <UserPlus className="h-5 w-5" />
                  {creatorStatus === "not_creator"
                    ? (t.liveManagement?.requestCreatorAccount || "Request creator account")
                    : (t.liveManagement?.goToProfile || "Go to profile")
                  }
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Mobile/Tablet: Fullscreen TikTok-style layout
  if (isMobileOrTablet && creatorStatus === "approved") {
    return (
      <>
        <CreatorMobileFullscreen
          roomId={room?.id || null}
          jitsiRoomName={room?.daily_room_name || null}
          creatorId={user?.id || ""}
          creatorDisplayName={user?.email?.split("@")[0] || "Criador"}
          isStreaming={isStreaming}
          onStreamToggle={handleStreamToggle}
          participants={participants}
          revenue={revenue}
          activeSuperchat={activeSuperchat}
          onSuperchatExpire={() => setActiveSuperchat(null)}
          onOpenSettings={() => setShowSettingsSheet(true)}
          onSelectSuperchat={(superchat) => setActiveSuperchat(superchat)}
          pendingSuperchatCount={pendingSuperchatCount}
          liveUrl={room ? `${window.location.origin}/live/${currentLiveId || room.id}` : undefined}
          streamPhase={streamPhase}
        />

        {/* Settings Sheet for mobile */}
        <Sheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Configurações da Live</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <LiveConfigPanel
                roomId={room?.id || null}
                creatorId={user?.id || ""}
                onTitleChange={handleTitleChange}
                onDevicesChange={handleDevicesChange}
                onMirrorChange={handleMirrorChange}
                onThumbnailChange={handleThumbnailChange}
                onOrientationChange={handleOrientationChange}
                currentOrientation={videoOrientation}
              />
              
              {/* SuperChat Queue in settings */}
              {room && user && (
                <SuperChatQueue
                  roomId={room.id}
                  creatorId={user.id}
                  onSelectSuperchat={(sc) => {
                    setActiveSuperchat({
                      id: sc.id,
                      message: sc.message,
                      tier: sc.tier,
                      duration_seconds: sc.duration_seconds,
                      username: sc.username || "Usuário",
                      expires_at: (sc as { expires_at?: string }).expires_at || new Date(Date.now() + sc.duration_seconds * 1000).toISOString(),
                    });
                    setShowSettingsSheet(false);
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop layout
  return (
    <AppLayout showSidebar={false}>
      <main className="container mx-auto px-4 py-6">
        {/* Header with two-step stream control and stats */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <TwoStepStreamControl
            streamPhase={streamPhase}
            onPrepare={handlePrepareStream}
            onGoLive={handleGoLive}
            onEndStream={handleEndStream}
          />

          <div className="flex gap-4">
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
          {/* Video Preview - Creator enters Jitsi room in preparing AND live phases */}
          <Card className="border-border overflow-hidden relative aspect-video">
            {(streamPhase === "preparing" || streamPhase === "live") && room?.daily_room_name ? (
              <CreatorJitsiEmbed
                roomName={room.daily_room_name}
                displayName={user?.email?.split("@")[0] || "Criador"}
                onReady={() => console.log("[LiveManagement] Creator joined Jitsi room:", room.daily_room_name)}
              />
            ) : (
              <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg">Transmissão desligada</p>
                <p className="text-sm">Clique em "Preparar Transmissão" para iniciar</p>
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
            {/* Creator Jitsi Embed - Creator enters Jitsi room in preparing AND live phases */}
            <Card className="border-border overflow-hidden relative aspect-video">
              {(streamPhase === "preparing" || streamPhase === "live") && room?.daily_room_name ? (
                <CreatorJitsiEmbed
                  roomName={room.daily_room_name}
                  displayName={user?.email?.split("@")[0] || "Criador"}
                  onReady={() => console.log("[LiveManagement] Creator joined Jitsi room:", room.daily_room_name)}
                />
              ) : (
                <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="text-lg">Transmissão desligada</p>
                  <p className="text-sm">Clique em "Preparar Transmissão" para iniciar</p>
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
