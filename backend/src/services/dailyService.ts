import fetch from 'node-fetch';
import { getEnv } from '../lib/env';

const DAILY_API_BASE = 'https://api.daily.co/v1';

type DailyRoomResponse = {
  name: string;
};

type DailyTokenResponse = {
  token: string;
};

const normalizeProjectUrl = (url: string) => {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const request = async <T>(endpoint: string, body: Record<string, unknown>) => {
  const apiKey = getEnv('DAILY_API_KEY');
  const response = await fetch(`${DAILY_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Daily API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
};

export const createRoom = async (liveId?: string) => {
  const requestedRoomName = liveId ? `live-${liveId}` : `room-${Date.now()}`;
  const result = await request<DailyRoomResponse>('rooms', {
    name: requestedRoomName,
    privacy: 'private',
  });

  const projectUrl = normalizeProjectUrl(getEnv('DAILY_PROJECT_URL'));
  const roomName = result.name || requestedRoomName;

  return {
    roomName,
    roomUrl: projectUrl ? `${projectUrl}/${roomName}` : undefined,
  };
};

export const createHostToken = async (roomName: string, userId: string) => {
  const result = await request<DailyTokenResponse>('meeting-tokens', {
    properties: {
      room_name: roomName,
      user_id: userId,
      is_owner: true,
    },
  });

  return { token: result.token };
};

export const createViewerToken = async (roomName: string, userId: string) => {
  const result = await request<DailyTokenResponse>('meeting-tokens', {
    properties: {
      room_name: roomName,
      user_id: userId,
      is_owner: false,
    },
  });

  return { token: result.token };
};
