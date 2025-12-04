import { createDailyCall, joinRoom, leaveRoom, type DailyCallControls } from "@/lib/daily";

export type { DailyCallControls };

export type JitsiControlState = {
  isMuted: boolean;
  isCameraOff: boolean;
  isReconnecting: boolean;
};

export const createCall = (roomUrl: string) => {
  return createDailyCall(roomUrl);
};

export const joinJitsiRoom = async (call: DailyCallControls | null, roomUrl: string) => {
  await joinRoom(call, roomUrl);
};

export const leaveJitsiRoom = async (call: DailyCallControls | null) => {
  await leaveRoom(call);
};

export const toggleMute = async (call: DailyCallControls | null, muted: boolean) => {
  if (!call) return;
  await call.setLocalAudio(!muted);
};

export const toggleCamera = async (call: DailyCallControls | null, cameraOff: boolean) => {
  if (!call) return;
  await call.setLocalVideo(!cameraOff);
};

export const reconnectCall = async (call: DailyCallControls | null, roomUrl: string) => {
  if (!call) return;
  await leaveJitsiRoom(call);
  await joinJitsiRoom(call, roomUrl);
};
