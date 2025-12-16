import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import FloatingLiveChat from "@/components/live/FloatingLiveChat";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import SuperChatQueue from "@/components/SuperChatQueue";
import { SingleStepStreamControl } from "@/components/SingleStepStreamControl";
import { WebRTCPublisher } from "@/components/webrtc";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Users,
  DollarSign,
  Settings,
  Share2,
  Sparkles,
  SwitchCamera,
  FlipHorizontal,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";

interface ActiveSuperchat {
  id: string;
  message: string;
  tier: "blue" | "yellow" | "red";
  duration_seconds: number;
  username: string;
  expires_at: string;
}

interface CreatorMobileFullscreenProps {
  roomId: string | null;
  creatorId: string;
  creatorDisplayName?: string;
  isStreaming: boolean;
  onStreamToggle: (streaming: boolean) => void;
  onGoLive?: () => void;
  onEndStream?: () => void;
  participants: number;
  revenue: { total: number; superchats: number };
  activeSuperchat: ActiveSuperchat | null;
  onSuperchatExpire: () => void;
  onOpenSettings: () => void;
  onSelectSuperchat: (superchat: ActiveSuperchat) => void;
  pendingSuperchatCount?: number;
  liveUrl?: string;
  streamPhase?: "idle" | "live";
  liveId?: string | null;
  isGoingLive?: boolean;
}

export const CreatorMobileFullscreen: React.FC<CreatorMobileFullscreenProps> = ({
  roomId,
  creatorId,
  creatorDisplayName = "Criador",
  isStreaming,
  onStreamToggle,
  onGoLive,
  onEndStream,
  participants,
  revenue,
  activeSuperchat,
  onSuperchatExpire,
  onOpenSettings,
  onSelectSuperchat,
  pendingSuperchatCount = 0,
  liveUrl,
  streamPhase = "idle",
  liveId,
  isGoingLive = false,
}) => {
  const { t } = useLanguage();
  const [showSuperchatQueue, setShowSuperchatQueue] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMirrored, setIsMirrored] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-open camera preview on mount
  useEffect(() => {
    const startPreview = async () => {
      try {
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });
        
        setStream(mediaStream);
        setPreviewError(null);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("[CreatorMobile] Camera access error:", err);
        setPreviewError("Não foi possível acessar a câmera");
      }
    };

    // Only start preview if not live (preview mode)
    if (streamPhase === "idle") {
      startPreview();
    }

    // If we transitioned to LIVE, stop the preview stream (publisher will open its own tracks)
    if (streamPhase === "live" && stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, streamPhase]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCameraSwitch = useCallback(async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    toast({
      title: "Câmera alternada",
      description: newMode === "environment" ? "Usando câmera traseira" : "Usando câmera frontal",
    });
  }, [facingMode]);

  const handleMirrorToggle = useCallback(() => {
    setIsMirrored(prev => !prev);
  }, []);

  const handleShare = async () => {
    const shareUrl = liveUrl || window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: (t.liveManagement as any)?.shareTitle || "Assista minha live!",
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: (t.liveManagement as any)?.linkCopied || "Link copiado!",
        description: (t.liveManagement as any)?.linkCopiedDesc || "O link da live foi copiado para a área de transferência.",
      });
    }
  };

  const handleRetryCamera = async () => {
    setPreviewError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setPreviewError("Não foi possível acessar a câmera");
    }
  };

  const isLive = streamPhase === "live";

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Fullscreen Video Preview */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 w-full h-full">
          {isLive && liveId ? (
            <WebRTCPublisher
              liveId={liveId}
              facingMode={facingMode}
              className="w-full h-full rounded-none"
              onReady={() => console.log("[CreatorMobile] WebRTC Publisher ready")}
              onError={(err) => console.error("[CreatorMobile] WebRTC error:", err)}
            />
          ) : previewError ? (
            <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <p className="text-lg">{previewError}</p>
              <button
                onClick={handleRetryCamera}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full object-cover",
                isMirrored && "scale-x-[-1]"
              )}
            />
          )}
        </div>

        {/* Top overlay - viewer count + revenue */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-end gap-3 z-20">
          {/* Viewer count */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white">{participants}</span>
          </div>

          {/* Revenue */}
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-white">R$ {revenue.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Active SuperChat display */}
        {activeSuperchat && (
          <div className="absolute bottom-[28vh] left-16 right-16 z-20">
            <SuperChatDisplay
              superchat={activeSuperchat}
              onExpire={onSuperchatExpire}
            />
          </div>
        )}

        {/* Floating chat */}
        {roomId && (
          <FloatingLiveChat
            roomId={roomId}
            currentUserId={creatorId}
            isAuthenticated={true}
            disabled={false}
          />
        )}

        {/* Left side action buttons - positioned below status indicator */}
        <div className="absolute left-2 top-20 z-20 flex flex-col items-center gap-3">
          {/* Camera switch button */}
          <button 
            onClick={handleCameraSwitch}
            className="flex flex-col items-center text-white"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <SwitchCamera className="h-5 w-5" />
            </div>
          </button>

          {/* Mirror toggle */}
          <button 
            onClick={handleMirrorToggle}
            className="flex flex-col items-center text-white"
          >
            <div className={cn(
              "w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90",
              isMirrored ? "bg-primary/60" : "bg-black/40"
            )}>
              <FlipHorizontal className="h-5 w-5" />
            </div>
          </button>

          {/* Settings button */}
          <button 
            onClick={onOpenSettings}
            className="flex flex-col items-center text-white"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Settings className="h-5 w-5" />
            </div>
          </button>

          {/* SuperChat queue indicator */}
          <button 
            onClick={() => setShowSuperchatQueue(true)}
            className="flex flex-col items-center text-white relative"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              {pendingSuperchatCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-xs font-bold text-white">{pendingSuperchatCount > 9 ? '9+' : pendingSuperchatCount}</span>
                </div>
              )}
            </div>
          </button>

          {/* Share button */}
          <button 
            onClick={handleShare}
            className="flex flex-col items-center text-white"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Share2 className="h-5 w-5" />
            </div>
          </button>
        </div>
      </div>

      {/* Fixed footer CTA - Stream control with safe-area */}
      <div 
        className="w-full bg-black/80 backdrop-blur-sm border-t border-border/30 z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-4 py-3">
          {onGoLive && onEndStream ? (
            <SingleStepStreamControl
              isLive={isLive}
              onGoLive={onGoLive}
              onEndStream={onEndStream}
              fullWidth
              disabled={isGoingLive}
            />
          ) : null}
        </div>
      </div>

      {/* SuperChat Queue Sheet */}
      <Sheet open={showSuperchatQueue} onOpenChange={setShowSuperchatQueue}>
        <SheetContent side="bottom" className="h-[60vh] bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              SuperChats
              {pendingSuperchatCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingSuperchatCount}
                </span>
              )}
            </h3>
          </div>
          {roomId && (
            <SuperChatQueue
              roomId={roomId}
              creatorId={creatorId}
              onSelectSuperchat={(superchat: any) => {
                onSelectSuperchat({
                  id: superchat.id,
                  message: superchat.message,
                  tier: superchat.tier,
                  duration_seconds: superchat.duration_seconds,
                  username: superchat.username || "Usuário",
                  expires_at: superchat.expires_at || new Date(Date.now() + superchat.duration_seconds * 1000).toISOString()
                });
                setShowSuperchatQueue(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CreatorMobileFullscreen;
