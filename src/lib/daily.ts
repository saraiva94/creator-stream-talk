// Daily.co integration utilities
import Daily, { DailyCall } from "@daily-co/daily-js";

export type DailyCallControls = {
  setLocalAudio: (enabled: boolean) => Promise<void> | void;
  setLocalVideo: (enabled: boolean) => Promise<void> | void;
  destroy: () => void;
  join: (options?: { url: string }) => Promise<void>;
  leave: () => Promise<void>;
};

let callInstance: DailyCall | null = null;

export const createDailyCall = (roomUrl: string): DailyCallControls => {
  if (callInstance) {
    try {
      callInstance.destroy();
    } catch (e) {
      console.warn("[daily] Failed to destroy previous call instance", e);
    }
  }

  callInstance = Daily.createCallObject({
    url: roomUrl,
  });

  return {
    setLocalAudio: async (enabled: boolean) => {
      if (callInstance) {
        callInstance.setLocalAudio(enabled);
      }
    },
    setLocalVideo: async (enabled: boolean) => {
      if (callInstance) {
        callInstance.setLocalVideo(enabled);
      }
    },
    destroy: () => {
      if (callInstance) {
        callInstance.destroy();
        callInstance = null;
      }
    },
    join: async (options?: { url: string }) => {
      if (callInstance) {
        await callInstance.join(options);
      }
    },
    leave: async () => {
      if (callInstance) {
        await callInstance.leave();
      }
    },
  };
};

export const joinRoom = async (call: DailyCallControls | null, roomUrl: string) => {
  if (!call) return;
  await call.join({ url: roomUrl });
};

export const leaveRoom = async (call: DailyCallControls | null) => {
  if (!call) return;
  await call.leave();
};

export const destroyCall = () => {
  if (callInstance) {
    callInstance.destroy();
    callInstance = null;
  }
};
