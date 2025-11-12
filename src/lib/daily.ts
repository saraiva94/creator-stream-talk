import DailyIframe, { DailyCall } from '@daily-co/daily-js';

export const createDailyCall = (roomUrl: string): DailyCall => {
  return DailyIframe.createFrame({
    iframeStyle: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      border: '0',
      borderRadius: '8px'
    },
    showLeaveButton: true,
    showFullscreenButton: true,
  });
};

export const joinRoom = async (call: DailyCall, roomUrl: string) => {
  await call.join({ url: roomUrl });
};

export const leaveRoom = async (call: DailyCall) => {
  await call.leave();
  call.destroy();
};

export const startScreenShare = async (call: DailyCall) => {
  await call.startScreenShare();
};

export const stopScreenShare = async (call: DailyCall) => {
  await call.stopScreenShare();
};
