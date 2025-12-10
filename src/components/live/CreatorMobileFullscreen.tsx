import { useState } from "react";
import { NativeVideoPreview } from "@/components/NativeVideoPreview";
import ChatBox from "@/components/ChatBox";
import SuperChatDisplay from "@/components/SuperChatDisplay";
import { StreamToggle } from "@/components/StreamToggle";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  DollarSign, 
  MessageCircle, 
  Settings,
  X 
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

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
}) => {
  const { t } = useLanguage();
  const [showChat, setShowChat] = useState(false);

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
            {/* Left side - Stream toggle */}
            <div className="flex flex-col gap-3">
              <StreamToggle
                isStreaming={isStreaming}
                onToggle={onStreamToggle}
                compact
              />
            </div>

            {/* Right side - Action buttons */}
            <div className="flex flex-col items-center gap-4">
              {/* Chat button */}
              <button 
                onClick={() => setShowChat(true)}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="text-xs">Chat</span>
              </button>

              {/* Settings button */}
              <button 
                onClick={onOpenSettings}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
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
    </div>
  );
};

export default CreatorMobileFullscreen;
