import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NativeVideoPreview, type VideoOrientation } from "@/components/NativeVideoPreview";
import { DualCameraPreview } from "@/components/live/DualCameraPreview";
import FloatingLiveChat from "@/components/live/FloatingLiveChat";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import SuperChatQueue from "@/components/SuperChatQueue";
import { StreamToggle } from "@/components/StreamToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { 
  Users, 
  DollarSign, 
  Settings,
  Share2,
  Sparkles,
  Home,
  ChevronLeft
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
  orientation?: VideoOrientation;
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
  orientation = "vertical",
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
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
          <DualCameraPreview
            audioDeviceId={selectedAudioDevice}
            isStreaming={isStreaming}
            isMirrored={isMirrored}
            orientation={orientation}
          />
        </div>

        {/* Top overlay - navigation and stats */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          {/* Back/Home button */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 text-white hover:bg-black/80 transition-colors active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
            <Home className="h-4 w-4" />
          </button>

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

        {/* Active SuperChat display - positioned above chat */}
        {activeSuperchat && (
          <div className="absolute bottom-[28vh] left-4 right-16 z-20">
            <SuperChatDisplay
              superchat={activeSuperchat}
              onExpire={onSuperchatExpire}
            />
          </div>
        )}

        {/* Floating Instagram-style chat - bottom 25% */}
        {roomId && (
          <FloatingLiveChat
            roomId={roomId}
            currentUserId={creatorId}
            isAuthenticated={true}
            disabled={false}
          />
        )}

        {/* Right side action buttons - above chat area */}
        <div className="absolute right-3 bottom-[28vh] z-20 flex flex-col items-center gap-4">
          {/* Share button */}
          <button 
            onClick={handleShare}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Share2 className="h-5 w-5" />
            </div>
          </button>

          {/* SuperChat queue indicator */}
          <button 
            onClick={() => setShowSuperchatQueue(true)}
            className="flex flex-col items-center gap-1 text-white relative"
          >
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              {pendingSuperchatCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-xs font-bold text-white">{pendingSuperchatCount > 9 ? '9+' : pendingSuperchatCount}</span>
                </div>
              )}
            </div>
          </button>

          {/* Settings button */}
          <button 
            onClick={onOpenSettings}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
              <Settings className="h-5 w-5" />
            </div>
          </button>
        </div>

        {/* Stream toggle - top left */}
        <div className="absolute top-20 left-4 z-20">
          <div className="transition-all duration-500 ease-in-out transform">
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
