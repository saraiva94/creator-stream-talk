import React from "react";

export interface JitsiPlayerProps {
  roomName: string;
  token?: string | null;
  width?: string | number;
  height?: string | number;
  className?: string;
  muted?: boolean;
  blurred?: boolean;
  /** If true, joins as viewer only - no camera/mic prompts, just watches the stream */
  viewerOnly?: boolean;
}

const DEFAULT_DIMENSION = "100%";

const buildJitsiUrl = (roomName: string, token?: string | null, muted?: boolean, viewerOnly?: boolean) => {
  const trimmedRoom = roomName.trim();
  const params = new URLSearchParams();
  
  if (token) {
    params.set("jwt", token);
  }
  
  // Core settings for all users - allow joining even without moderator
  params.set("config.enableWelcomePage", "false");
  params.set("config.requireDisplayName", "false");
  params.set("config.enableLobby", "false");
  params.set("config.enableClosePage", "false");
  params.set("config.disableModeratorIndicator", "true");
  params.set("config.enableNoAudioDetection", "false");
  params.set("config.enableNoisyMicDetection", "false");
  
  // Viewer-only mode: disable all device prompts and UI, just watch
  if (viewerOnly) {
    // Start with devices muted/disabled - viewer doesn't broadcast
    params.set("config.startWithAudioMuted", "true");
    params.set("config.startWithVideoMuted", "true");
    // Disable pre-join screen completely
    params.set("config.prejoinConfig.enabled", "false");
    params.set("config.prejoinPageEnabled", "false");
    // Viewer doesn't need to request permissions
    params.set("config.startSilent", "true");
    // Hide toolbar buttons viewers don't need
    params.set("config.toolbarButtons", "[]");
    // Disable all prompts
    params.set("config.disableDeepLinking", "true");
    params.set("config.disableInviteFunctions", "true");
    params.set("config.disableJoinLeaveSounds", "true");
    // Filmstrip off - just show main video
    params.set("config.filmstrip.disabled", "true");
    // No notifications
    params.set("config.notifications", "[]");
    // Join as hidden participant (viewer mode)
    params.set("config.hiddenDomain", "true");
    // Interface config for cleaner viewer experience
    params.set("interfaceConfig.TOOLBAR_BUTTONS", "[]");
    params.set("interfaceConfig.FILM_STRIP_MAX_HEIGHT", "0");
    params.set("interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS", "true");
    params.set("interfaceConfig.HIDE_INVITE_MORE_HEADER", "true");
    params.set("interfaceConfig.SHOW_CHROME_EXTENSION_BANNER", "false");
    params.set("interfaceConfig.MOBILE_APP_PROMO", "false");
    params.set("interfaceConfig.DISABLE_VIDEO_BACKGROUND", "true");
  } else if (muted) {
    // Creator mode but muted
    params.set("config.startWithAudioMuted", "true");
    params.set("config.startWithVideoMuted", "false");
  }
  
  const baseUrl = `https://meet.jit.si/${encodeURIComponent(trimmedRoom)}`;
  const paramString = params.toString();
  
  return paramString ? `${baseUrl}#${paramString}` : baseUrl;
};

/**
 * JitsiPlayer renders a simple iframe that loads a Meet session for the supplied room name.
 * Supports muting and blurring for paywall scenarios.
 * viewerOnly mode joins as spectator without camera/mic prompts.
 */
export const JitsiPlayer: React.FC<JitsiPlayerProps> = ({
  roomName,
  token = null,
  width = DEFAULT_DIMENSION,
  height = DEFAULT_DIMENSION,
  className,
  muted = false,
  blurred = false,
  viewerOnly = false,
}) => {
  const jitsiUrl = React.useMemo(() => buildJitsiUrl(roomName, token, muted, viewerOnly), [roomName, token, muted, viewerOnly]);
  const isTrustedHost = React.useMemo(() => jitsiUrl.startsWith("https://meet.jit.si/"), [jitsiUrl]);

  React.useEffect(() => {
    console.debug("[JitsiPlayer] mount", { roomName, jitsiUrl, muted, blurred, viewerOnly });
    if (!isTrustedHost) {
      console.warn("[JitsiPlayer] Untrusted Jitsi host detected", { jitsiUrl });
    }
    return () => {
      console.debug("[JitsiPlayer] unmount", { roomName });
    };
  }, [isTrustedHost, jitsiUrl, roomName, muted, blurred, viewerOnly]);

  const sandbox = isTrustedHost
    ? "allow-same-origin allow-forms allow-scripts allow-modals allow-popups"
    : "allow-forms allow-scripts allow-modals allow-popups";

  return (
    <div className="relative w-full h-full">
      <iframe
        title={`Jitsi room ${roomName}`}
        src={jitsiUrl}
        style={{ width, height, border: 0 }}
        className={className}
        allow="camera; microphone; fullscreen; display-capture"
        sandbox={sandbox}
        loading="lazy"
        allowFullScreen
      />
      
      {/* Blur overlay when paywall active */}
      {blurred && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        />
      )}
      
      {/* Mute overlay indicator */}
      {muted && (
        <div className="absolute inset-0 pointer-events-none" />
      )}
    </div>
  );
};

export default JitsiPlayer;
