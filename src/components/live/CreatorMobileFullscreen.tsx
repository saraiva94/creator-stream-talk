import { useState } from "react";
import { NativeVideoPreview } from "@/components/NativeVideoPreview";
import ChatBox from "@/components/ChatBox";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import SuperChatQueue from "@/components/SuperChatQueue";
import { StreamToggle } from "@/components/StreamToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { 
  Users, 
  DollarSign, 
  MessageCircle, 
  Settings,
  X,
  Share2,
  Sparkles
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
  isStreaming: boolean;
  onStreamToggle: (streaming: boolean) => void;
  participants: number;
  revenue: { total: number; superchats: number };
  selectedAudioDevice: string | null;
  selectedVideoDevice: string | null;
  isMirrored: boolean;
  activeSuperchat: ActiveSuperchat | null;
  onSuperchatExpire: () => void;
  onOpenSettings: () => void;
  onSelectSuperchat: (superchat: ActiveSuperchat) => void;
  pendingSuperchatCount?: number;
  liveUrl?: string;
}

export const CreatorMobileFullscreen: React.FC<CreatorMobileFullscreenProps> = ({
  roomId,
  creatorId,
  isStreaming,
  onStreamToggle,
  participants,
  revenue,
  selectedAudioDevice,
  selectedVideoDevice,
  isMirrored,
  activeSuperchat,
  onSuperchatExpire,
  onOpenSettings,
  onSelectSuperchat,
  pendingSuperchatCount = 0,
  liveUrl,
}) => {
  const { t } = useLanguage();
  const [showChat, setShowChat] = useState(false);
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Fullscreen Video Preview */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <NativeVideoPreview
            audioDeviceId={selectedAudioDevice}
            videoDeviceId={selectedVideoDevice}
            isStreaming={isStreaming}
            isMirrored={isMirrored}
          />
        </div>

        {/* Top overlay - stats */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          {/* Viewer count */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white">{participants}</span>
          </div>

          {/* Revenue */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-white">R$ {revenue.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Active SuperChat display */}
        {activeSuperchat && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <SuperChatDisplay
              superchat={activeSuperchat}
              onExpire={onSuperchatExpire}
            />
          </div>
        )}

        {/* Bottom overlay - TikTok style interaction bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="flex items-end justify-between">
            {/* Left side - Stream toggle with smooth animation */}
            <div className="flex flex-col gap-3">
              <div className="transition-all duration-500 ease-in-out transform">
                <StreamToggle
                  isStreaming={isStreaming}
                  onToggle={onStreamToggle}
                  compact
                />
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex flex-col items-center gap-4">
              {/* Share button */}
              <button 
                onClick={handleShare}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                  <Share2 className="h-6 w-6" />
                </div>
                <span className="text-xs">{t.common?.shareLink || "Compartilhar"}</span>
              </button>

              {/* SuperChat queue indicator */}
              <button 
                onClick={() => setShowSuperchatQueue(true)}
                className="flex flex-col items-center gap-1 text-white relative"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                  {pendingSuperchatCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-xs font-bold text-white">{pendingSuperchatCount > 9 ? '9+' : pendingSuperchatCount}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs">SuperChats</span>
              </button>

              {/* Chat button */}
              <button 
                onClick={() => setShowChat(true)}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="text-xs">Chat</span>
              </button>

              {/* Settings button */}
              <button 
                onClick={onOpenSettings}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                  <Settings className="h-6 w-6" />
                </div>
                <span className="text-xs">Config</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-up Chat Panel */}
      {showChat && (
        <div 
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-slide-up"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <h3 className="text-lg font-semibold text-foreground">Chat</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(false)}
              className="text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            {roomId ? (
              <ChatBox
                roomId={roomId}
                currentUserId={creatorId}
                creatorId={creatorId}
                isCreator={true}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t.liveManagement?.startToActivateChat || "Start streaming to activate chat"}
              </div>
            )}
          </div>
        </div>
      )}

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
