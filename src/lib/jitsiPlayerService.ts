import { createDailyCall, joinRoom, leaveRoom } from "@/lib/daily";

export type JitsiControlState = {
  isMuted: boolean;
  isCameraOff: boolean;
  isReconnecting: boolean;
};

export const createCall = (roomUrl: string) => {
  return createDailyCall(roomUrl);
};

export const joinJitsiRoom = async (call: any, roomUrl: string) => {
  await joinRoom(call, roomUrl);
};

export const leaveJitsiRoom = async (call: any) => {
  await leaveRoom(call);
};

export const toggleMute = async (call: any, muted: boolean) => {
  if (!call) return;
  await call.setLocalAudio(!muted);
};

export const toggleCamera = async (call: any, cameraOff: boolean) => {
  if (!call) return;
  await call.setLocalVideo(!cameraOff);
};

export const reconnectCall = async (call: any, roomUrl: string) => {
  if (!call) return;
  await leaveJitsiRoom(call);
  await joinJitsiRoom(call, roomUrl);
};
