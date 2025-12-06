import React from "react";

export interface JitsiPlayerProps {
  roomName: string;
  token?: string | null;
  width?: string | number;
  height?: string | number;
  className?: string;
  muted?: boolean;
  blurred?: boolean;
}

const DEFAULT_DIMENSION = "100%";

const buildJitsiUrl = (roomName: string, token?: string | null, muted?: boolean) => {
  const trimmedRoom = roomName.trim();
  const params = new URLSearchParams();
  
  if (token) {
    params.set("jwt", token);
  }
  
  // If muted, start with audio/video muted
  if (muted) {
    params.set("config.startWithAudioMuted", "true");
    params.set("config.startWithVideoMuted", "false");
  }
  
  const baseUrl = `https://meet.jit.si/${encodeURIComponent(trimmedRoom)}`;
  const paramString = params.toString();
  
  return paramString ? `${baseUrl}?${paramString}` : baseUrl;
};

/**
 * JitsiPlayer renders a simple iframe that loads a Meet session for the supplied room name.
 * Supports muting and blurring for paywall scenarios.
 */
export const JitsiPlayer: React.FC<JitsiPlayerProps> = ({
  roomName,
  token = null,
  width = DEFAULT_DIMENSION,
  height = DEFAULT_DIMENSION,
  className,
  muted = false,
  blurred = false,
}) => {
  const jitsiUrl = React.useMemo(() => buildJitsiUrl(roomName, token, muted), [roomName, token, muted]);
  const isTrustedHost = React.useMemo(() => jitsiUrl.startsWith("https://meet.jit.si/"), [jitsiUrl]);

  React.useEffect(() => {
    console.debug("[JitsiPlayer] mount", { roomName, jitsiUrl, muted, blurred });
    if (!isTrustedHost) {
      console.warn("[JitsiPlayer] Untrusted Jitsi host detected", { jitsiUrl });
    }
    return () => {
      console.debug("[JitsiPlayer] unmount", { roomName });
    };
  }, [isTrustedHost, jitsiUrl, roomName, muted, blurred]);

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
