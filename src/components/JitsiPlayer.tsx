import React from "react";

export interface JitsiPlayerProps {
  roomName: string;
  token?: string | null;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const DEFAULT_DIMENSION = "100%";

const buildJitsiUrl = (roomName: string, token?: string | null) => {
  const trimmedRoom = roomName.trim();
  const baseUrl = `https://meet.jit.si/${encodeURIComponent(trimmedRoom)}`;
  if (!token) {
    return baseUrl;
  }
  const params = new URLSearchParams({ jwt: token });
  return `${baseUrl}?${params.toString()}`;
};

/**
 * JitsiPlayer renders a simple iframe that loads a Meet session for the supplied room name.
 * Future work: plug in JWT-secured rooms once server-side tokens are available.
 */
export const JitsiPlayer: React.FC<JitsiPlayerProps> = ({
  roomName,
  token = null,
  width = DEFAULT_DIMENSION,
  height = DEFAULT_DIMENSION,
  className,
}) => {
  const jitsiUrl = React.useMemo(() => buildJitsiUrl(roomName, token), [roomName, token]);
  const isTrustedHost = React.useMemo(() => jitsiUrl.startsWith("https://meet.jit.si/"), [jitsiUrl]);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("[JitsiPlayer] mount", { roomName, jitsiUrl });
    if (!isTrustedHost) {
      console.warn("[JitsiPlayer] Untrusted Jitsi host detected", { jitsiUrl });
    }
    return () => {
      // eslint-disable-next-line no-console
      console.debug("[JitsiPlayer] unmount", { roomName });
    };
  }, [isTrustedHost, jitsiUrl, roomName]);

  const sandbox = isTrustedHost
    ? "allow-same-origin allow-forms allow-scripts allow-modals allow-popups"
    : "allow-forms allow-scripts allow-modals allow-popups";

  return (
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
  );
};

export default JitsiPlayer;
