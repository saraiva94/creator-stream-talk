import React, { useState } from "react";
import { ArrowLeft, Heart, Share2, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WebRTCViewer } from "@/components/webrtc";
import FloatingLiveChat from "@/components/live/FloatingLiveChat";
import PaywallOverlay from "@/components/PaywallOverlay";
import CreditRemainingOverlay from "@/components/CreditRemainingOverlay";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MobileFullscreenPlayerProps {
  roomName: string;
  liveId?: string;
  creatorName?: string | null;
  creatorAvatar?: string | null;
  title?: string | null;
  roomId: string | null;
  currentUserId: string | null;
  creatorId: string;
  isAuthenticated: boolean;
  hasEntitlement: boolean;
  showPaywall: boolean;
  paywallReason: 'preview' | 'credits' | null;
  priceLabel: string;
  onPurchase: () => void;
  localCredits: number;
  showPreviewPlayer: boolean;
  isOnline: boolean;
  muted?: boolean;
  blurred?: boolean;
}

const MobileFullscreenPlayer: React.FC<MobileFullscreenPlayerProps> = ({
  roomName,
  liveId,
  creatorName,
  creatorAvatar,
  title,
  roomId,
  currentUserId,
  isAuthenticated,
  hasEntitlement,
  showPaywall,
  paywallReason,
  priceLabel,
  onPurchase,
  localCredits,
  showPreviewPlayer,
  isOnline,
  muted: initialMuted = false,
  blurred = false,
}) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  
  const showCreditOverlay = hasEntitlement && !showPaywall && localCredits > 0;
  const canRenderLiveKit = Boolean(liveId && (hasEntitlement || showPreviewPlayer || showPaywall));

  // Derive effective muted state
  const effectiveMuted = isMuted || blurred;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video container - fullscreen vertical */}
      <div className="relative flex-1 w-full">
        {canRenderLiveKit && liveId ? (
          <WebRTCViewer
            liveId={liveId}
            muted={effectiveMuted}
            blurred={blurred}
            onHostNotReady={() => console.log("[MobileFullscreenPlayer] Waiting for host...")}
            className="w-full h-full"
          />
        ) : null}

        {/* Top overlay - back button and creator info */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 safe-area-inset-top">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            
            <div className="flex items-center gap-2 flex-1 mx-4">
              <Avatar className="h-10 w-10 border-2 border-destructive">
                <AvatarImage src={creatorAvatar || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {creatorName?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {creatorName || "Creator"}
                </p>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-white/80 text-xs">AO VIVO</span>
                </div>
              </div>
            </div>
          </div>
          {title && (
            <p className="text-white/90 text-sm mt-2 line-clamp-2 px-2">
              {title}
            </p>
          )}
        </div>

        {/* Right side actions - vertical menu */}
        <div className="absolute right-3 bottom-[28vh] z-20 flex flex-col items-center gap-5">
          {/* Mute/Unmute button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex flex-col items-center gap-1"
          >
            <div className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all",
              isMuted ? "bg-destructive/80" : "bg-black/40"
            )}>
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-white" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" />
              )}
            </div>
          </button>

          <button
            onClick={() => setLiked(!liked)}
            className="flex flex-col items-center gap-1"
          >
            <div className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all",
              liked ? "bg-destructive" : "bg-black/40"
            )}>
              <Heart className={cn(
                "h-5 w-5 transition-all",
                liked ? "text-white fill-white" : "text-white"
              )} />
            </div>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
              <Share2 className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {/* Floating Instagram-style chat overlay - bottom 25% */}
        {roomId && (
          <FloatingLiveChat
            roomId={roomId}
            currentUserId={currentUserId}
            isAuthenticated={isAuthenticated}
            disabled={showPaywall}
          />
        )}

        {/* Credit overlay */}
        {showCreditOverlay && (
          <div className="absolute top-20 right-3 z-10">
            <CreditRemainingOverlay creditsLeft={localCredits} />
          </div>
        )}

        {/* Paywall */}
        {showPaywall && (
          <PaywallOverlay
            priceLabel={priceLabel}
            onPurchase={onPurchase}
            reason={paywallReason ?? 'preview'}
            remainingCredits={localCredits}
            isAuthenticated={isAuthenticated}
          />
        )}

        {/* Offline indicator */}
        {!isOnline && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center text-white">
              <p className="text-lg font-semibold">Conexão perdida</p>
              <p className="text-sm text-white/70">Reconectando automaticamente...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileFullscreenPlayer;
