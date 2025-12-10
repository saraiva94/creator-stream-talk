import React from "react";
import { ArrowLeft, MessageCircle, X, Users, Heart, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JitsiPlayer } from "@/components/JitsiPlayer";
import ChatBox from "@/components/ChatBox";
import PreviewCountdownOverlay from "@/components/PreviewCountdownOverlay";
import PaywallOverlay from "@/components/PaywallOverlay";
import CreditRemainingOverlay from "@/components/CreditRemainingOverlay";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MobileFullscreenPlayerProps {
  roomName: string;
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
  isPreviewing: boolean;
  hasExpired: boolean;
  remainingMs: number;
  durationMs: number;
  showPreviewPlayer: boolean;
  isOnline: boolean;
  muted?: boolean;
  blurred?: boolean;
}

const MobileFullscreenPlayer: React.FC<MobileFullscreenPlayerProps> = ({
  roomName,
  creatorName,
  creatorAvatar,
  title,
  roomId,
  currentUserId,
  creatorId,
  isAuthenticated,
  hasEntitlement,
  showPaywall,
  paywallReason,
  priceLabel,
  onPurchase,
  localCredits,
  isPreviewing,
  hasExpired,
  remainingMs,
  durationMs,
  showPreviewPlayer,
  isOnline,
  muted = false,
  blurred = false,
}) => {
  const navigate = useNavigate();
  const [showChat, setShowChat] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  
  const showCountdown = isPreviewing && !hasExpired && !showPaywall;
  const showCreditOverlay = hasEntitlement && !showPaywall && localCredits > 0;
  const canRenderJitsi = Boolean(roomName && (hasEntitlement || showPreviewPlayer || showPaywall));

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video container - fullscreen vertical */}
      <div className="relative flex-1 w-full">
        {canRenderJitsi && (
          <JitsiPlayer 
            roomName={roomName} 
            width="100%"
            height="100%"
            className="absolute inset-0 object-cover"
            muted={muted || blurred}
            blurred={blurred}
          />
        )}

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

        {/* Right side actions - TikTok style */}
        <div className="absolute right-3 bottom-32 z-10 flex flex-col items-center gap-5">
          <button
            onClick={() => setLiked(!liked)}
            className="flex flex-col items-center gap-1"
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all",
              liked ? "bg-destructive" : "bg-white/20"
            )}>
              <Heart className={cn(
                "h-6 w-6 transition-all",
                liked ? "text-white fill-white" : "text-white"
              )} />
            </div>
            <span className="text-white text-xs font-medium">Curtir</span>
          </button>
          
          <button
            onClick={() => setShowChat(true)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Chat</span>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Compartilhar</span>
          </button>
        </div>

        {/* Credit overlay */}
        {showCreditOverlay && (
          <div className="absolute top-20 right-3 z-10">
            <CreditRemainingOverlay creditsLeft={localCredits} />
          </div>
        )}

        {/* Preview countdown */}
        {showCountdown && (
          <PreviewCountdownOverlay remainingMs={remainingMs} totalMs={durationMs} />
        )}

        {/* Paywall */}
        {showPaywall && (
          <PaywallOverlay
            priceLabel={priceLabel}
            onPurchase={onPurchase}
            reason={paywallReason ?? 'preview'}
            remainingCredits={localCredits}
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

      {/* Chat slide-up panel */}
      {showChat && (
        <div className="absolute inset-0 z-30 bg-black/50" onClick={() => setShowChat(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 h-[70vh] bg-background rounded-t-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Chat ao vivo</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="h-[calc(70vh-64px)]">
              {roomId && currentUserId && creatorId ? (
                <ChatBox
                  roomId={roomId}
                  currentUserId={currentUserId}
                  creatorId={creatorId}
                  isCreator={false}
                  disabled={showPaywall}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {!isAuthenticated ? "Faça login para participar do chat" : "Carregando chat..."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFullscreenPlayer;
