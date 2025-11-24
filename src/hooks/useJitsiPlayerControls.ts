import { useCallback, useState } from "react";
import { toggleMute, toggleCamera, reconnectCall, type JitsiControlState } from "@/lib/jitsiPlayerService";

type UseJitsiPlayerControlsParams = {
  call: any;
  roomUrl: string;
};

export const useJitsiPlayerControls = ({ call, roomUrl }: UseJitsiPlayerControlsParams) => {
  const [state, setState] = useState<JitsiControlState>({
    isMuted: false,
    isCameraOff: false,
    isReconnecting: false,
  });

  const handleToggleMute = useCallback(async () => {
    const nextMuted = !state.isMuted;
    setState((prev) => ({ ...prev, isMuted: nextMuted }));
    await toggleMute(call, nextMuted);
  }, [call, state.isMuted]);

  const handleToggleCamera = useCallback(async () => {
    const nextCameraOff = !state.isCameraOff;
    setState((prev) => ({ ...prev, isCameraOff: nextCameraOff }));
    await toggleCamera(call, nextCameraOff);
  }, [call, state.isCameraOff]);

  const handleReconnect = useCallback(async () => {
    if (state.isReconnecting) return;
    setState((prev) => ({ ...prev, isReconnecting: true }));
    try {
      await reconnectCall(call, roomUrl);
    } finally {
      setState((prev) => ({ ...prev, isReconnecting: false }));
    }
  }, [call, roomUrl, state.isReconnecting]);

  return {
    state,
    handleToggleMute,
    handleToggleCamera,
    handleReconnect,
  };
};
