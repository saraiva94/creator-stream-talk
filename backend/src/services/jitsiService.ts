import crypto from 'crypto';

const sanitizeFragment = (value: string) => {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, '');
  return normalized.length > 0 ? normalized : 'creator';
};

export const createPrivateRoom = async (creatorId: string): Promise<{ roomName: string }> => {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(6).toString('hex');
  const fragment = sanitizeFragment(creatorId);
  const roomName = `creator_${fragment}_${timestamp}_${randomHex}`;
  return { roomName };
};

export const generateAccessLink = (roomName: string): string => {
  const normalized = roomName.trim();
  return `https://meet.jit.si/${normalized}`;
};
