import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WebRTCPublisherProps {
  liveId: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

/**
 * WebRTCPublisher - LiveKit-based publisher component for creators
 * Connects to LiveKit room and publishes video/audio tracks
 */
export const WebRTCPublisher: React.FC<WebRTCPublisherProps> = ({
  liveId,
  onReady,
  onError,
  onDisconnect,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebRTCPublisher] Cleaning up...');
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (e) {
        console.warn('[WebRTCPublisher] Error disconnecting:', e);
      }
      roomRef.current = null;
    }
  }, [localStream]);

  // Connect to LiveKit
  const connect = useCallback(async () => {
    if (connectionState === 'connecting' || connectionState === 'connected') {
      console.log('[WebRTCPublisher] Already connecting/connected');
      return;
    }

    setConnectionState('connecting');
    setErrorMessage(null);

    try {
      console.log('[WebRTCPublisher] Requesting host token for live:', liveId);
      
      // Get host token from edge function
      const { data, error } = await supabase.functions.invoke('livekit-room', {
        body: { action: 'host-token', liveId }
      });

      if (error || !data?.token) {
        throw new Error(error?.message || data?.error || 'Failed to get token');
      }

      const { token, roomName, livekitUrl } = data;
      console.log('[WebRTCPublisher] Got token for room:', roomName);

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true
      });
      
      setLocalStream(stream);

      // Display local preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Import LiveKit client dynamically
      const { Room, RoomEvent, Track } = await import('livekit-client');

      // Create and connect to room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 }
        }
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('[WebRTCPublisher] Connected to room');
        setConnectionState('connected');
        onReady?.();
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('[WebRTCPublisher] Disconnected from room');
        setConnectionState('disconnected');
        onDisconnect?.();
      });

      room.on(RoomEvent.MediaDevicesError, (e: Error) => {
        console.error('[WebRTCPublisher] Media devices error:', e);
        setErrorMessage(e.message);
        onError?.(e.message);
      });

      // Connect to room
      await room.connect(livekitUrl, token);

      // Publish tracks
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack, {
          name: 'camera',
          source: Track.Source.Camera
        });
      }

      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          name: 'microphone',
          source: Track.Source.Microphone
        });
      }

      console.log('[WebRTCPublisher] Tracks published successfully');

      // Start heartbeat
      heartbeatRef.current = setInterval(async () => {
        try {
          await supabase.functions.invoke('livekit-room', {
            body: { action: 'heartbeat', liveId }
          });
          console.log('[WebRTCPublisher] Heartbeat sent');
        } catch (e) {
          console.warn('[WebRTCPublisher] Heartbeat failed:', e);
        }
      }, 15000); // Every 15 seconds

    } catch (err: any) {
      console.error('[WebRTCPublisher] Connection error:', err);
      setConnectionState('error');
      setErrorMessage(err.message);
      onError?.(err.message);
      cleanup();
    }
  }, [liveId, connectionState, onReady, onError, onDisconnect, cleanup]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return cleanup;
  }, []);

  // Reconnect handler
  const handleReconnect = () => {
    cleanup();
    setTimeout(connect, 500);
  };

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Local video preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Connection status overlay */}
      {connectionState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Conectando ao LiveKit...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {connectionState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <span className="text-destructive text-sm">
              {errorMessage || 'Erro de conexão'}
            </span>
            <button
              onClick={handleReconnect}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Connected indicator */}
      {connectionState === 'connected' && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 px-2 py-1 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-white">LiveKit</span>
        </div>
      )}
    </div>
  );
};

export default WebRTCPublisher;
