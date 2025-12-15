import React, { useEffect, useRef, useMemo } from "react";
import { VolumeX } from "lucide-react";

interface DailyPlayerProps {
  roomUrl: string;
  token?: string | null;
  width?: string;
  height?: string;
  muted?: boolean;
  blurred?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
}

/**
 * DailyPlayer - Viewer embed for watching Daily streams
 * Viewers join as non-owners with receive-only permissions
 */
export const DailyPlayer: React.FC<DailyPlayerProps> = ({
  roomUrl,
  token,
  width = "100%",
  height = "100%",
  muted = false,
  blurred = false,
  onReady,
  onError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasReportedReady = useRef(false);

  const dailyUrl = useMemo(() => {
    if (!roomUrl) return "";
    
    try {
      const url = new URL(roomUrl);
      
      // Add token if provided
      if (token) {
        url.searchParams.set("t", token);
      }
      
      // Viewer settings - minimal UI, receive-only
      url.searchParams.set("showLeaveButton", "false");
      url.searchParams.set("showFullscreenButton", "true");
      url.searchParams.set("showLocalVideo", "false");
      url.searchParams.set("showParticipantsBar", "false");
      url.searchParams.set("activeSpeakerMode", "true");
      
      return url.toString();
    } catch (e) {
      console.error("[DailyPlayer] Invalid room URL:", roomUrl);
      return "";
    }
  }, [roomUrl, token]);

  useEffect(() => {
    if (!dailyUrl) return;

    console.debug("[DailyPlayer] Mounting with room:", roomUrl);

    // Listen for Daily iframe messages
    const handleMessage = (event: MessageEvent) => {
      try {
        const roomOrigin = new URL(roomUrl).origin;
        if (event.origin !== roomOrigin) return;
      } catch {
        return;
      }

      const { action } = event.data || {};

      if (action === "joined-meeting" && !hasReportedReady.current) {
        hasReportedReady.current = true;
        onReady?.();
        console.debug("[DailyPlayer] Viewer joined meeting");
      }

      if (action === "error") {
        onError?.(event.data.errorMsg || "Unknown error");
        console.error("[DailyPlayer] Error:", event.data);
      }
    };

    window.addEventListener("message", handleMessage);

    // Report ready after iframe loads (fallback)
    const readyTimer = setTimeout(() => {
      if (!hasReportedReady.current) {
        hasReportedReady.current = true;
        onReady?.();
        console.debug("[DailyPlayer] Reported ready (timeout fallback)");
      }
    }, 5000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(readyTimer);
      console.debug("[DailyPlayer] Unmounting");
    };
  }, [dailyUrl, roomUrl, onReady, onError]);

  if (!dailyUrl) {
    return (
      <div
        className="flex items-center justify-center bg-black text-muted-foreground"
        style={{ width, height }}
      >
        <p>Stream não disponível</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden" style={{ width, height }}>
      <iframe
        ref={iframeRef}
        title="Daily Stream Player"
        src={dailyUrl}
        className="w-full h-full border-0"
        style={{
          filter: blurred ? "blur(20px)" : "none",
          transition: "filter 0.3s ease-in-out",
        }}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        allowFullScreen
      />
      
      {/* Blur overlay */}
      {blurred && (
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      )}
      
      {/* Muted indicator */}
      {muted && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
          <VolumeX className="w-4 h-4" />
          <span>Muted</span>
        </div>
      )}
    </div>
  );
};

export default DailyPlayer;
