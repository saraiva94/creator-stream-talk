import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WebRTCViewerProps {
  liveId: string;
  muted?: boolean;
  blurred?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
  onHostNotReady?: () => void;
  className?: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'waiting' | 'error';

/**
 * WebRTCViewer - LiveKit-based viewer component for spectators
 * Connects to LiveKit room and subscribes to video/audio tracks
 */
export const WebRTCViewer: React.FC<WebRTCViewerProps> = ({
  liveId,
  muted = false,
  blurred = false,
  onReady,
  onError,
  onHostNotReady,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<any>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebRTCViewer] Cleaning up...');
    
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (e) {
        console.warn('[WebRTCViewer] Error disconnecting:', e);
      }
      roomRef.current = null;
    }
    
    setHasRemoteVideo(false);
  }, []);

  // Connect to LiveKit
  const connect = useCallback(async () => {
    if (connectionState === 'connecting' || connectionState === 'connected') {
      console.log('[WebRTCViewer] Already connecting/connected');
      return;
    }

    setConnectionState('connecting');
    setErrorMessage(null);

    try {
      console.log('[WebRTCViewer] Requesting viewer token for live:', liveId);
      
      // Get viewer token from edge function
      const { data, error } = await supabase.functions.invoke('livekit-room', {
        body: { action: 'viewer-token', liveId }
      });

      if (error || !data?.token) {
        const errMsg = error?.message || data?.error || 'Failed to get token';
        
        // Check if live is not active yet
        if (data?.status && data.status !== 'live') {
          console.log('[WebRTCViewer] Host not ready, status:', data.status);
          setConnectionState('waiting');
          onHostNotReady?.();
          return;
        }
        
        throw new Error(errMsg);
      }

      const { token, roomName, livekitUrl } = data;
      console.log('[WebRTCViewer] Got token for room:', roomName);

      // Import LiveKit client dynamically
      const livekit = await import('livekit-client');
      const { Room, RoomEvent, Track } = livekit;

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('[WebRTCViewer] Connected to room');
        setConnectionState('connected');
        onReady?.();
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('[WebRTCViewer] Disconnected from room');
        setConnectionState('idle');
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('[WebRTCViewer] Track subscribed:', track.kind, 'from', participant.identity);
        
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setHasRemoteVideo(true);
        }
        
        if (track.kind === Track.Kind.Audio && videoRef.current) {
          track.attach(videoRef.current);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        console.log('[WebRTCViewer] Track unsubscribed:', track.kind);
        track.detach();
        
        if (track.kind === Track.Kind.Video) {
          setHasRemoteVideo(false);
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('[WebRTCViewer] Participant disconnected:', participant.identity);
        // Check if it was the host
        if (!participant.isLocal) {
          setHasRemoteVideo(false);
        }
      });

      // Connect to room
      await room.connect(livekitUrl, token);

      // Check if there are already remote participants publishing
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track && publication.track.kind === Track.Kind.Video && videoRef.current) {
            publication.track.attach(videoRef.current);
            setHasRemoteVideo(true);
          }
          if (publication.track && publication.track.kind === Track.Kind.Audio && videoRef.current) {
            publication.track.attach(videoRef.current);
          }
        });
      });

    } catch (err: any) {
      console.error('[WebRTCViewer] Connection error:', err);
      setConnectionState('error');
      setErrorMessage(err.message);
      onError?.(err.message);
    }
  }, [liveId, connectionState, onReady, onError, onHostNotReady]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return cleanup;
  }, []);

  // Retry for waiting state
  useEffect(() => {
    if (connectionState === 'waiting') {
      const retryTimer = setTimeout(() => {
        console.log('[WebRTCViewer] Retrying connection...');
        setConnectionState('idle');
        connect();
      }, 3000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [connectionState, connect]);

  // Handle mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Remote video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover transition-all duration-300 ${
          blurred ? 'blur-xl scale-105' : ''
        }`}
      />

      {/* Waiting for host overlay */}
      {connectionState === 'waiting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Aguardando criador iniciar...</span>
          </div>
        </div>
      )}

      {/* Connecting overlay */}
      {connectionState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Conectando...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {connectionState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <span className="text-destructive text-sm">
              {errorMessage || 'Erro de conexão'}
            </span>
            <button
              onClick={() => {
                cleanup();
                setTimeout(connect, 500);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* No video yet but connected */}
      {connectionState === 'connected' && !hasRemoteVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-muted-foreground text-sm">Aguardando vídeo do criador...</span>
        </div>
      )}

      {/* Muted indicator */}
      {muted && hasRemoteVideo && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          <span className="text-xs text-white">Mudo</span>
        </div>
      )}
    </div>
  );
};

export default WebRTCViewer;
