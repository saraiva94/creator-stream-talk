import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DualCameraPreview, DualCameraControlsRef, RecordingQuality } from "@/components/live/DualCameraPreview";
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
  RefreshCw,
  Settings2,
  Circle,
  Square,
  Download,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import type { VideoOrientation } from "@/components/NativeVideoPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const QUALITY_LABELS: Record<RecordingQuality, string> = {
  high: "Alta (1080p)",
  medium: "Média (720p)",
  low: "Baixa (480p)",
};

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
  onFlipCamera?: () => void;
}

export const CreatorMobileFullscreen: React.FC<CreatorMobileFullscreenProps> = ({
  roomId,
  creatorId,
  isStreaming,
  onStreamToggle,
  participants,
  revenue,
  selectedAudioDevice,
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
  const [showSuperchatQueue, setShowSuperchatQueue] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  
  // Ref for camera controls
  const cameraControlsRef = useRef<DualCameraControlsRef | null>(null);
  
  // Local state synced from camera controls
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("medium");
  const [hasTwoCameras, setHasTwoCameras] = useState(false);

  // Sync state from camera controls ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (cameraControlsRef.current) {
        setIsRecording(cameraControlsRef.current.isRecording);
        setRecordedVideoUrl(cameraControlsRef.current.recordedVideoUrl);
        setRecordingQuality(cameraControlsRef.current.recordingQuality);
        setHasTwoCameras(cameraControlsRef.current.hasTwoCameras);
      }
    }, 100);
    return () => clearInterval(interval);
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

  const handleToggleRecording = () => {
    if (!cameraControlsRef.current) return;
    
    if (cameraControlsRef.current.isRecording) {
      cameraControlsRef.current.stopRecording();
    } else {
      cameraControlsRef.current.startRecording();
    }
  };

  const handleDownload = () => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.downloadRecording();
    }
  };

  const handleSwitchCamera = () => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.switchCamera();
    }
  };

  const handleQualityChange = (quality: RecordingQuality) => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.setRecordingQuality(quality);
    }
    setShowQualitySelector(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Fullscreen Video Preview */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 w-full h-full">
          <DualCameraPreview
            audioDeviceId={selectedAudioDevice}
            isStreaming={isStreaming}
            isMirrored={isMirrored}
            orientation={orientation}
            hideControls={true}
            externalControlsRef={cameraControlsRef}
          />
        </div>

        {/* Top overlay - status indicator + viewer count + revenue */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between z-20 px-3">
          {/* Status indicator - shows "Preview" when not streaming, or green when live */}
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1",
            isStreaming 
              ? "bg-green-500/20 border border-green-500" 
              : "bg-black/60 backdrop-blur-sm"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              isStreaming ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            )} />
            <span className="text-xs font-medium text-white">
              {isStreaming ? "Ao Vivo" : "Preview"}
            </span>
          </div>

          {/* Viewer count - center */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white">{participants}</span>
          </div>

          {/* Revenue - right edge */}
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-white">R$ {revenue.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Active SuperChat display - positioned above chat */}
        {activeSuperchat && (
          <div className="absolute bottom-[28vh] left-16 right-16 z-20">
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

        {/* Left side action buttons - stacked vertically */}
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

          {/* Stream toggle ON/OFF - same size as other buttons */}
          <div className="w-12 h-12 flex items-center justify-center">
            <StreamToggle
              isStreaming={isStreaming}
              onToggle={onStreamToggle}
              compact
            />
          </div>
        </div>

        {/* Right side action buttons - quality, camera flip, recording */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3">
          {/* Quality selector button (only when not recording) */}
          {!isRecording && (
            <div className="relative">
              <button 
                onClick={() => setShowQualitySelector(!showQualitySelector)}
                className="flex flex-col items-center text-white"
              >
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                  <Settings2 className="h-5 w-5" />
                </div>
              </button>
              
              {/* Quality dropdown */}
              {showQualitySelector && (
                <div className="absolute right-14 top-0 bg-black/90 backdrop-blur-sm rounded-lg p-2 min-w-[140px]">
                  {(["high", "medium", "low"] as RecordingQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQualityChange(q)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded text-sm text-white hover:bg-white/20 transition-colors",
                        recordingQuality === q && "bg-primary/30"
                      )}
                    >
                      {QUALITY_LABELS[q]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Flip/Switch camera button */}
          {hasTwoCameras && (
            <button 
              onClick={handleSwitchCamera}
              className="flex flex-col items-center text-white"
            >
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                <RefreshCw className="h-5 w-5" />
              </div>
            </button>
          )}

          {/* Record button */}
          {!recordedVideoUrl && (
            <button 
              onClick={handleToggleRecording}
              className="flex flex-col items-center text-white"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
                isRecording 
                  ? "bg-red-500/80 backdrop-blur-sm" 
                  : "bg-black/40 backdrop-blur-sm border-2 border-red-500"
              )}>
                {isRecording ? (
                  <Square className="h-5 w-5 text-white fill-white" />
                ) : (
                  <Circle className="h-5 w-5 text-red-500 fill-red-500" />
                )}
              </div>
            </button>
          )}

          {/* Download button (after recording stopped) */}
          {recordedVideoUrl && (
            <button 
              onClick={handleDownload}
              className="flex flex-col items-center text-white"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/80 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90">
                <Download className="h-5 w-5" />
              </div>
            </button>
          )}
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