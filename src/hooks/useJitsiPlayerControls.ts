import { useCallback, useState } from "react";
import type { JitsiControlState } from "@/lib/jitsiPlayerService";

type UseJitsiPlayerControlsParams = {
  roomUrl: string;
};

// Jitsi uses iframe-based embedding, so audio/video controls are handled
// directly by the Jitsi Meet interface within the iframe.
// This hook provides local state tracking for UI consistency.

export const useJitsiPlayerControls = ({ roomUrl }: UseJitsiPlayerControlsParams) => {
  const [state, setState] = useState<JitsiControlState>({
    isMuted: false,
    isCameraOff: false,
    isReconnecting: false,
  });

  const handleToggleMute = useCallback(() => {
    // Jitsi controls audio via its own interface
    // This is for local UI state only
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const handleToggleCamera = useCallback(() => {
    // Jitsi controls video via its own interface
    // This is for local UI state only
    setState((prev) => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  }, []);

  const handleReconnect = useCallback(() => {
    if (state.isReconnecting) return;
    setState((prev) => ({ ...prev, isReconnecting: true }));
    // Reload the iframe by forcing a re-render
    // The actual reconnection happens when the component remounts
    setTimeout(() => {
      setState((prev) => ({ ...prev, isReconnecting: false }));
      // Force page to reload the iframe
      window.location.reload();
    }, 1000);
  }, [state.isReconnecting]);

  return {
    state,
    handleToggleMute,
    handleToggleCamera,
    handleReconnect,
  };
};
