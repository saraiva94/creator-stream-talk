import { Request, Response } from 'express';
import { createRoom, createHostToken, createViewerToken } from '../services/dailyService';

export const handleCreateRoom = async (req: Request, res: Response) => {
  try {
    const { liveId } = req.body as { liveId?: string };
    const room = await createRoom(liveId);
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const handleCreateHostToken = async (req: Request, res: Response) => {
  try {
    const { roomName, userId } = req.body as { roomName?: string; userId?: string };

    if (!roomName || !userId) {
      return res.status(400).json({ message: 'roomName and userId are required' });
    }

    const token = await createHostToken(roomName, userId);
    res.json(token);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const handleCreateViewerToken = async (req: Request, res: Response) => {
  try {
    const { roomName, userId } = req.body as { roomName?: string; userId?: string };

    if (!roomName || !userId) {
      return res.status(400).json({ message: 'roomName and userId are required' });
    }

    const token = await createViewerToken(roomName, userId);
    res.json(token);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
