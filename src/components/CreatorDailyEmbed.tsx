import React, { useEffect, useRef } from "react";

interface CreatorDailyEmbedProps {
  roomUrl: string;
  token: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onLeft?: () => void;
  className?: string;
}

/**
 * CreatorDailyEmbed - Embeds the creator in the Daily room as owner/broadcaster
 * Uses Daily's iframe embed with owner token for full broadcast permissions
 */
export const CreatorDailyEmbed: React.FC<CreatorDailyEmbedProps> = ({
  roomUrl,
  token,
  onReady,
  onError,
  onLeft,
  className = "",
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasReportedReady = useRef(false);

  const dailyUrl = React.useMemo(() => {
    const url = new URL(roomUrl);
    url.searchParams.set("t", token);
    // Creator settings
    url.searchParams.set("showLeaveButton", "false");
    url.searchParams.set("showFullscreenButton", "true");
    url.searchParams.set("showLocalVideo", "true");
    url.searchParams.set("showParticipantsBar", "false");
    url.searchParams.set("activeSpeakerMode", "false");
    return url.toString();
  }, [roomUrl, token]);

  useEffect(() => {
    console.debug("[CreatorDailyEmbed] Mounting with room:", roomUrl);

    // Listen for Daily iframe messages
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(roomUrl).origin) return;
      
      const { action } = event.data || {};
      
      if (action === "joined-meeting" && !hasReportedReady.current) {
        hasReportedReady.current = true;
        onReady?.();
        console.debug("[CreatorDailyEmbed] Creator joined meeting");
      }
      
      if (action === "left-meeting") {
        onLeft?.();
        console.debug("[CreatorDailyEmbed] Creator left meeting");
      }
      
      if (action === "error") {
        onError?.(event.data.errorMsg || "Unknown error");
        console.error("[CreatorDailyEmbed] Error:", event.data);
      }
    };

    window.addEventListener("message", handleMessage);

    // Report ready after iframe loads (fallback)
    const readyTimer = setTimeout(() => {
      if (!hasReportedReady.current) {
        hasReportedReady.current = true;
        onReady?.();
        console.debug("[CreatorDailyEmbed] Reported ready (timeout fallback)");
      }
    }, 5000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(readyTimer);
      console.debug("[CreatorDailyEmbed] Unmounting");
    };
  }, [roomUrl, onReady, onError, onLeft]);

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        title="Daily Creator Stream"
        src={dailyUrl}
        className="w-full h-full border-0"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        allowFullScreen
      />
    </div>
  );
};

export default CreatorDailyEmbed;
