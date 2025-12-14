import React, { useEffect, useRef } from "react";

interface CreatorJitsiEmbedProps {
  roomName: string;
  displayName?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * CreatorJitsiEmbed - Embeds the creator in the Jitsi room as a moderator/host
 * This component ensures the creator joins the Jitsi room BEFORE viewers,
 * preventing the "waiting for moderator" screen.
 */
export const CreatorJitsiEmbed: React.FC<CreatorJitsiEmbedProps> = ({
  roomName,
  displayName = "Criador",
  onReady,
  onError,
  className = "",
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasReportedReady = useRef(false);

  const jitsiUrl = React.useMemo(() => {
    const trimmedRoom = roomName.trim();
    const params = new URLSearchParams();
    
    // Creator settings - join as the host/moderator
    params.set("config.enableWelcomePage", "false");
    params.set("config.requireDisplayName", "false");
    params.set("config.enableLobby", "false");
    params.set("config.enableClosePage", "false");
    params.set("config.disableModeratorIndicator", "true");
    params.set("config.enableNoAudioDetection", "false");
    params.set("config.enableNoisyMicDetection", "false");
    // Disable pre-join screen - creator goes directly into the room
    params.set("config.prejoinConfig.enabled", "false");
    params.set("config.prejoinPageEnabled", "false");
    // Start with video ON (creator is broadcasting)
    params.set("config.startWithAudioMuted", "false");
    params.set("config.startWithVideoMuted", "false");
    // Disable deep linking to prevent redirect to app
    params.set("config.disableDeepLinking", "true");
    // Disable invite functions
    params.set("config.disableInviteFunctions", "true");
    // Join/leave sounds off
    params.set("config.disableJoinLeaveSounds", "true");
    // Clean UI for creator
    params.set("interfaceConfig.SHOW_CHROME_EXTENSION_BANNER", "false");
    params.set("interfaceConfig.MOBILE_APP_PROMO", "false");
    params.set("interfaceConfig.HIDE_INVITE_MORE_HEADER", "true");
    // Display name
    if (displayName) {
      params.set("userInfo.displayName", displayName);
    }
    
    const baseUrl = `https://meet.jit.si/${encodeURIComponent(trimmedRoom)}`;
    return `${baseUrl}#${params.toString()}`;
  }, [roomName, displayName]);

  useEffect(() => {
    console.debug("[CreatorJitsiEmbed] Mounting with room:", roomName);
    
    // Report ready after a short delay to allow iframe to load
    const readyTimer = setTimeout(() => {
      if (!hasReportedReady.current) {
        hasReportedReady.current = true;
        onReady?.();
        console.debug("[CreatorJitsiEmbed] Reported ready");
      }
    }, 3000);

    return () => {
      clearTimeout(readyTimer);
      console.debug("[CreatorJitsiEmbed] Unmounting");
    };
  }, [roomName, onReady]);

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        title={`Creator Jitsi Room ${roomName}`}
        src={jitsiUrl}
        className="w-full h-full border-0"
        allow="camera; microphone; fullscreen; display-capture"
        sandbox="allow-same-origin allow-forms allow-scripts allow-modals allow-popups"
        loading="eager"
        allowFullScreen
      />
    </div>
  );
};

export default CreatorJitsiEmbed;
