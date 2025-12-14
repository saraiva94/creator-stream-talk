import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreatorJitsiEmbed } from "@/components/CreatorJitsiEmbed";
import FloatingLiveChat from "@/components/live/FloatingLiveChat";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import SuperChatQueue from "@/components/SuperChatQueue";
import { StreamToggle } from "@/components/StreamToggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { 
  Users, 
  DollarSign, 
  Settings,
  Share2,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import type { VideoOrientation } from "@/components/NativeVideoPreview";

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
  jitsiRoomName: string | null;
  creatorId: string;
  creatorDisplayName?: string;
  isStreaming: boolean;
  onStreamToggle: (streaming: boolean) => void;
  participants: number;
  revenue: { total: number; superchats: number };
  activeSuperchat: ActiveSuperchat | null;
  onSuperchatExpire: () => void;
  onOpenSettings: () => void;
  onSelectSuperchat: (superchat: ActiveSuperchat) => void;
  pendingSuperchatCount?: number;
  liveUrl?: string;
  orientation?: VideoOrientation;
  streamPhase?: "idle" | "preparing" | "live";
}

export const CreatorMobileFullscreen: React.FC<CreatorMobileFullscreenProps> = ({
  roomId,
  jitsiRoomName,
  creatorId,
  creatorDisplayName = "Criador",
  isStreaming,
  onStreamToggle,
  participants,
  revenue,
  activeSuperchat,
  onSuperchatExpire,
  onOpenSettings,
  onSelectSuperchat,
  pendingSuperchatCount = 0,
  liveUrl,
  streamPhase = "idle",
}) => {
  const { t } = useLanguage();
  const [showSuperchatQueue, setShowSuperchatQueue] = useState(false);

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

  const showJitsi = (streamPhase === "preparing" || streamPhase === "live") && jitsiRoomName;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Fullscreen Video Preview */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 w-full h-full">
          {showJitsi ? (
            <CreatorJitsiEmbed
              roomName={jitsiRoomName}
              displayName={creatorDisplayName}
              onReady={() => console.log("[CreatorMobileFullscreen] Creator joined Jitsi")}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-lg">Transmissão desligada</p>
              <p className="text-sm">Clique em "Preparar Transmissão" para iniciar</p>
            </div>
          )}
        </div>

        {/* Top overlay - status indicator + viewer count + revenue */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between z-20 px-3">
          {/* Status indicator */}
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1",
            streamPhase === "live" 
              ? "bg-green-500/20 border border-green-500" 
              : streamPhase === "preparing"
              ? "bg-yellow-500/20 border border-yellow-500"
              : "bg-black/60 backdrop-blur-sm"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              streamPhase === "live" ? "bg-green-500 animate-pulse" : 
              streamPhase === "preparing" ? "bg-yellow-500 animate-pulse" : 
              "bg-muted-foreground"
            )} />
            <span className="text-xs font-medium text-white">
              {streamPhase === "live" ? "Ao Vivo" : 
               streamPhase === "preparing" ? "Preparando" : 
               "Offline"}
            </span>
          </div>

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

        {/* Left side action buttons */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3">
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

          {/* Stream toggle */}
          <div className="w-12 h-12 flex items-center justify-center">
            <StreamToggle
              isStreaming={isStreaming}
              onToggle={onStreamToggle}
              compact
            />
          </div>
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
