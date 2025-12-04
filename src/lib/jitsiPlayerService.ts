// Jitsi Player Service - handles Jitsi room management

export type JitsiControlState = {
  isMuted: boolean;
  isCameraOff: boolean;
  isReconnecting: boolean;
};

// Jitsi uses iframe-based embedding, so we don't need complex call management
// The JitsiPlayer component handles the iframe directly

export const buildJitsiRoomUrl = (roomName: string, token?: string | null): string => {
  const trimmedRoom = roomName.trim();
  const baseUrl = `https://meet.jit.si/${encodeURIComponent(trimmedRoom)}`;
  if (!token) {
    return baseUrl;
  }
  const params = new URLSearchParams({ jwt: token });
  return `${baseUrl}?${params.toString()}`;
};

export const generateRoomName = (creatorId: string, liveId?: string): string => {
  const timestamp = Date.now();
  const suffix = liveId ? liveId.slice(0, 8) : timestamp.toString(36);
  return `streamstar-${creatorId.slice(0, 8)}-${suffix}`;
};
