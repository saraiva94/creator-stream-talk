import React, { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { WebRTCViewer } from "@/components/webrtc";
import ChatBox from "@/components/ChatBox";
import MobileFullscreenPlayer from "@/components/live/MobileFullscreenPlayer";
import PaywallOverlay from "@/components/PaywallOverlay";
import CreditRemainingOverlay from "@/components/CreditRemainingOverlay";
import { ReportStreamDialog } from "@/components/live/ReportStreamDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { api, ApiError } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobileOrTablet } from "@/hooks/useDeviceType";
import { usePreviewTimer } from "@/hooks/usePreviewTimer";
import { useCredits } from "@/contexts/CreditsContext";
import { 
  Users, 
  Heart, 
  Share2, 
  MoreVertical, 
  ArrowLeft,
  WifiOff,
  AlertCircle,
  Flag
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LiveData {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  is_active: boolean;
  room_name: string | null;
  webrtc_room_name: string | null;
  chat_room_id: string | null;
  creator_id: string;
  price: number | null;
  thumbnail_url: string | null;
}

interface CreatorData {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_streaming: boolean;
  viewer_count: number;
}

const HEARTBEAT_INTERVAL_MS = 5000;

const LiveViewer: React.FC = () => {
  const { liveId } = useParams<{ liveId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobileOrTablet = useIsMobileOrTablet();
  const { creditBalance, setCredits } = useCredits();

  // States
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [creatorData, setCreatorData] = useState<CreatorData | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasEntitlement, setHasEntitlement] = useState(false);
  const [localCredits, setLocalCredits] = useState<number>(creditBalance);
  const [paywallReason, setPaywallReason] = useState<'preview' | 'credits' | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Refs for heartbeat
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Preview timer
  const previewTimer = usePreviewTimer({
    role: isAuthenticated ? "authenticated" : "anonymous",
    entitlementState: hasEntitlement ? "entitled" : "unentitled",
    liveId: liveId || "",
    durationOverrideMs: 20000, // 20 seconds preview
  });
  
  const { 
    start: startPreview, 
    stop: stopPreview, 
    isPreviewing, 
    hasExpired, 
    remainingMs, 
    durationMs 
  } = previewTimer;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Check auth state and admin role
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(Boolean(data.session));
      setCurrentUserId(data.session?.user?.id || null);
      setCurrentUser(data.session?.user || null);
      
      // Check admin role
      if (data.session?.user?.id) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        setIsAdmin(roles?.some(r => r.role === "admin") || false);
      }
    };
    
    checkAuth();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_, session) => {
      setIsAuthenticated(Boolean(session));
      setCurrentUserId(session?.user?.id || null);
      setCurrentUser(session?.user || null);
      
      if (session?.user?.id) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        setIsAdmin(roles?.some(r => r.role === "admin") || false);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch live data and check access
  const fetchLiveData = useCallback(async () => {
    if (!liveId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch live data from Supabase
      const { data: live, error: liveError } = await supabase
        .from("lives")
        .select("id, title, description, status, is_active, room_name, webrtc_room_name, chat_room_id, creator_id, price, thumbnail_url")
        .eq("id", liveId)
        .maybeSingle();

      if (liveError) throw liveError;
      
      if (!live) {
        setError(t.liveViewer?.notFound || "Live não encontrada");
        setIsLoading(false);
        return;
      }

      setLiveData(live);

      // Fetch creator data
      const { data: creator } = await supabase
        .from("creator_profiles")
        .select("id, display_name, is_streaming, viewer_count")
        .eq("id", live.creator_id)
        .maybeSingle();

      if (creator) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", live.creator_id)
          .maybeSingle();

        setCreatorData({
          ...creator,
          avatar_url: profile?.avatar_url || null,
        });
        setViewerCount(creator.viewer_count || 0);
      }

      // Fetch room ID for chat - prefer chat_room_id if available
      const chatRoomSource = live.chat_room_id || live.room_name;
      if (chatRoomSource) {
        const { data: room } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", chatRoomSource)
          .maybeSingle();
        
        if (room) {
          setRoomId(room.id);
        }
      }

      // Check if user has credits - this determines entitlement
      if (currentUserId) {
        const { data: wallet } = await supabase
          .from("credits_wallet")
          .select("balance_credits")
          .eq("user_id", currentUserId)
          .maybeSingle();
        
        const credits = wallet?.balance_credits ?? 0;
        setLocalCredits(credits);
        setCredits(credits);
        
        // User has entitlement if they have credits
        if (credits > 0) {
          setHasEntitlement(true);
          
          // Try to get/create live_access
          const { data: existingAccess } = await supabase
            .from("live_access")
            .select("id")
            .eq("user_id", currentUserId)
            .eq("live_id", liveId)
            .maybeSingle();
          
          if (!existingAccess) {
            await supabase
              .from("live_access")
              .insert({ user_id: currentUserId, live_id: liveId, status: "active" });
          }
        }

        // Check if user is following
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("creator_id", live.creator_id)
          .eq("status", "active")
          .maybeSingle();
        
        setIsFollowing(Boolean(subscription));
      }

    } catch (err) {
      console.error("[LiveViewer] Error fetching live:", err);
      setError(t.liveViewer?.loadError || "Falha ao carregar informações da transmissão.");
    } finally {
      setIsLoading(false);
    }
  }, [liveId, currentUserId, t, setCredits]);

  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  // Realtime subscription for live status changes
  useEffect(() => {
    if (!liveId) return;

    const channel = supabase
      .channel(`live-status-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lives',
          filter: `id=eq.${liveId}`,
        },
        (payload) => {
          console.log('[LiveViewer] Live status update received:', payload.new);
          const newData = payload.new as Partial<LiveData>;
          setLiveData(prev => prev ? { ...prev, ...newData } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // Update credits from context
  useEffect(() => {
    if (creditBalance !== localCredits) {
      setLocalCredits(creditBalance);
      if (creditBalance > 0 && !hasEntitlement) {
        setHasEntitlement(true);
      }
    }
  }, [creditBalance, localCredits, hasEntitlement]);

  // Track if we've shown the consumption notification
  const consumptionNotifiedRef = useRef(false);

  // Heartbeat mechanism - consume credits while watching
  useEffect(() => {
    if (!hasEntitlement || !liveId || !currentUserId || paywallReason === "credits") {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    const ensureSessionToken = () => {
      if (sessionTokenRef.current) return sessionTokenRef.current;
      const fallback = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : fallback;
      return sessionTokenRef.current;
    };

    // Create discrete notification for credit consumption start
    const notifyConsumptionStarted = async () => {
      if (consumptionNotifiedRef.current) return;
      consumptionNotifiedRef.current = true;
      
      try {
        // Add notification to database for bell icon
        await supabase.from("notifications").insert({
          user_id: currentUserId,
          type: "credit_consumption",
          title: t.notifications?.creditConsumptionStarted || "Consumo de créditos iniciado",
          message: `${t.notifications?.watchingLive || "Você está assistindo a live de"} ${creatorData?.display_name || "criador"}. ${t.notifications?.creditsBeingConsumed || "Seus créditos estão sendo consumidos."}`,
        });
        
        console.debug("[LiveViewer] Consumption notification created");
      } catch (error) {
        console.debug("[LiveViewer] Failed to create consumption notification:", error);
      }
    };

    const sendHeartbeat = async () => {
      try {
        const token = ensureSessionToken();
        const response = await api.lives.heartbeat(liveId, token);
        
        if (!isMountedRef.current) return;

        // Update credits
        setLocalCredits(response.remainingCredits);
        setCredits(response.remainingCredits);

        console.debug("[LiveViewer] Heartbeat response:", {
          status: response.status,
          remaining: response.remainingCredits,
          charged: response.creditsChargedThisTick,
        });

        // Check if credits ran out
        if (response.status === "NO_CREDITS" || response.ranOutOfCredits || response.remainingCredits <= 0) {
          setPaywallReason("credits");
          setHasEntitlement(false);
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.debug("[LiveViewer] Heartbeat failed:", error);
        // Don't stop heartbeat on error, just log it
      }
    };

    // Send initial heartbeat and notify about consumption
    sendHeartbeat();
    notifyConsumptionStarted();

    // Set up interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [hasEntitlement, liveId, currentUserId, paywallReason, setCredits, creatorData?.display_name, t]);

  // Handle preview timer
  useEffect(() => {
    if (hasEntitlement) {
      stopPreview();
      setPaywallReason(null);
      return;
    }

    if (hasExpired) {
      setPaywallReason("preview");
      return;
    }

    // Start preview for all users (authenticated or not) if they don't have entitlement
    if (liveData && !hasEntitlement) {
      startPreview();
    }
  }, [hasEntitlement, hasExpired, liveData, startPreview, stopPreview, isAuthenticated]);

  // Credits paywall
  useEffect(() => {
    if (hasEntitlement && localCredits <= 0) {
      setPaywallReason("credits");
      setHasEntitlement(false);
    } else if (paywallReason === "credits" && localCredits > 0) {
      setPaywallReason(null);
      setHasEntitlement(true);
    }
  }, [hasEntitlement, localCredits, paywallReason]);

  // Realtime viewer count subscription
  useEffect(() => {
    if (!liveData?.creator_id || !roomId) return;

    const channel = supabase
      .channel(`viewer-count-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newViewerCount = (payload.new as { viewer_count?: number }).viewer_count;
          if (typeof newViewerCount === 'number') {
            setViewerCount(newViewerCount);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'creator_profiles',
          filter: `id=eq.${liveData.creator_id}`,
        },
        (payload) => {
          const newViewerCount = (payload.new as { viewer_count?: number }).viewer_count;
          if (typeof newViewerCount === 'number') {
            setViewerCount(newViewerCount);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveData?.creator_id, roomId]);

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handlePurchaseCredits = () => {
    navigate("/profile");
  };

  const handleFollow = async () => {
    if (!currentUserId || !liveData?.creator_id) return;
    
    try {
      if (isFollowing) {
        await supabase
          .from("subscriptions")
          .delete()
          .eq("user_id", currentUserId)
          .eq("creator_id", liveData.creator_id);
        setIsFollowing(false);
        toast({ title: t.liveViewer?.unfollowed || "Deixou de seguir" });
      } else {
        await supabase
          .from("subscriptions")
          .insert({
            user_id: currentUserId,
            creator_id: liveData.creator_id,
            status: "active",
          });
        setIsFollowing(true);
        toast({ title: t.liveViewer?.followed || "Seguindo!" });
      }
    } catch (error) {
      console.error("[LiveViewer] Follow error:", error);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: liveData?.title || "Live Stream",
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: t.common?.copied || "Link copiado!" });
    }
  };

  // MUST define all callbacks before any early returns (React hooks rules)
  const handleHostNotReady = useCallback(() => {
    console.log("[LiveViewer] Waiting for host...");
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={currentUser} isAdmin={isAdmin} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="space-y-4 w-full max-w-4xl p-4">
            <Skeleton className="aspect-video w-full" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !liveData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={currentUser} isAdmin={isAdmin} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">{error || t.liveViewer?.notFound || "Live não encontrada"}</h2>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.common?.backToHome || "Voltar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Determine if we should show content
  const showPaywall = Boolean(paywallReason);
  const shouldMuteAndBlur = showPaywall || (isPreviewing && !hasEntitlement);
  const canShowVideo = liveData.is_active && liveData.status === "live";
  const showCreditOverlay = hasEntitlement && !showPaywall && localCredits > 0;

  // Mobile: Fullscreen vertical layout
  if (isMobileOrTablet) {
    return (
      <MobileFullscreenPlayer
        roomName={liveData.room_name || ""}
        liveId={liveData.id}
        creatorName={creatorData?.display_name}
        creatorAvatar={creatorData?.avatar_url}
        title={liveData.title}
        roomId={roomId}
        currentUserId={currentUserId}
        creatorId={liveData.creator_id}
        isAuthenticated={isAuthenticated}
        hasEntitlement={hasEntitlement}
        showPaywall={showPaywall}
        paywallReason={paywallReason}
        priceLabel="R$ 5,00"
        onPurchase={handlePurchaseCredits}
        localCredits={localCredits}
        showPreviewPlayer={!hasEntitlement && !showPaywall}
        isOnline={isOnline}
        muted={shouldMuteAndBlur}
        blurred={shouldMuteAndBlur}
      />
    );
  }

  // Desktop: Twitch-style layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={currentUser} isAdmin={isAdmin} />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content - Video + Info */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Player */}
          <div className="relative bg-black aspect-video lg:aspect-auto lg:flex-1">
            <WebRTCViewer
              liveId={liveData.id}
              muted={shouldMuteAndBlur}
              blurred={shouldMuteAndBlur}
              onHostNotReady={handleHostNotReady}
              className="w-full h-full"
            />

            {showCreditOverlay && (
              <CreditRemainingOverlay creditsLeft={localCredits} />
            )}

            {showPaywall && (
              <PaywallOverlay
                priceLabel="R$ 5,00"
                onPurchase={handlePurchaseCredits}
                reason={paywallReason ?? "preview"}
                remainingCredits={localCredits}
                isAuthenticated={isAuthenticated}
              />
            )}

            {!canShowVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {t.liveViewer?.waitingForStream || "Aguardando transmissão..."}
                  </p>
                </div>
              </div>
            )}

            {!isOnline && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="flex items-center gap-2 rounded-md bg-card px-4 py-2 text-sm shadow">
                  <WifiOff className="h-4 w-4" />
                  <span>
                    {t.liveViewer?.connectionLost || "Conexão perdida. Reconectando..."}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Stream Info Bar */}
          <div className="border-t border-border bg-card p-4">
            <div className="flex items-start gap-4">
              {/* Creator Avatar */}
              <Avatar className="h-14 w-14 border-2 border-primary">
                <AvatarImage src={creatorData?.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {creatorData?.display_name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              {/* Stream Details */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold truncate">
                  {liveData.title || t.liveViewer?.untitled || "Live Stream"}
                </h1>
                <button 
                  onClick={() => navigate(`/profile/${liveData.creator_id}`)}
                  className="text-primary hover:underline font-medium"
                >
                  {creatorData?.display_name || t.liveViewer?.unknownCreator || "Criador"}
                </button>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {canShowVideo ? (
                    <Badge variant="destructive" className="animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-1.5" />
                      LIVE
                    </Badge>
                  ) : (
                    <Badge variant="secondary">OFFLINE</Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {viewerCount} {t.liveViewer?.watching || "assistindo"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant={isFollowing ? "secondary" : "default"}
                  onClick={handleFollow}
                  disabled={!isAuthenticated}
                  className="gap-2"
                >
                  <Heart className={`h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
                  {isFollowing 
                    ? t.liveViewer?.following || "Seguindo" 
                    : t.liveViewer?.follow || "Seguir"
                  }
                </Button>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => setShowReportDialog(true)}
                      disabled={!isAuthenticated}
                      className="text-destructive focus:text-destructive"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      {t.report?.reportStream || "Denunciar transmissão"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sidebar - Twitch Style */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-border bg-card">
          {/* Chat Header */}
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">{t.liveViewer?.streamChat || "Chat da transmissão"}</h2>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            {roomId ? (
              <ChatBox
                roomId={roomId}
                currentUserId={currentUserId}
                creatorId={liveData.creator_id}
                isCreator={false}
                disabled={showPaywall}
                readOnly={!isAuthenticated}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-center px-4">
                  {t.common?.loading || "Carregando..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <ReportStreamDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        liveId={liveData.id}
        creatorId={liveData.creator_id}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default LiveViewer;
