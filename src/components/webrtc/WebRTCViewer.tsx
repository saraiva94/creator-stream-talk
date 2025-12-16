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
 * 
 * CRITICAL: This component uses refs for connection state to prevent
 * re-render loops and duplicate connection attempts.
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
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentLiveIdRef = useRef<string>(liveId);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  // Update ref when liveId changes
  useEffect(() => {
    currentLiveIdRef.current = liveId;
  }, [liveId]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebRTCViewer] Cleaning up...');
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (e) {
        console.warn('[WebRTCViewer] Error disconnecting:', e);
      }
      roomRef.current = null;
    }
    
    connectingRef.current = false;
    setHasRemoteVideo(false);
  }, []);

  // Connect to LiveKit
  const connect = useCallback(async () => {
    // Prevent duplicate connections using ref (not state)
    if (connectingRef.current || roomRef.current) {
      console.log('[WebRTCViewer] Already connecting/connected, skipping');
      return;
    }

    // Validate liveId
    if (!liveId) {
      console.warn('[WebRTCViewer] No liveId provided');
      return;
    }

    connectingRef.current = true;
    setConnectionState('connecting');
    setErrorMessage(null);

    // Create abort controller for this connection attempt
    abortControllerRef.current = new AbortController();

    try {
      console.log('[WebRTCViewer] Requesting viewer token for live:', liveId);
      
      // Get viewer token from edge function
      const { data, error } = await supabase.functions.invoke('livekit-room', {
        body: { action: 'viewer-token', liveId }
      });

      // Check if component unmounted or liveId changed during request
      if (!mountedRef.current || currentLiveIdRef.current !== liveId) {
        console.log('[WebRTCViewer] Component unmounted or liveId changed, aborting');
        connectingRef.current = false;
        return;
      }

      if (error || !data?.token) {
        const errMsg = error?.message || data?.error || 'Failed to get token';
        
        // Check if live is not active yet
        if (data?.status && data.status !== 'live') {
          console.log('[WebRTCViewer] Host not ready, status:', data.status);
          setConnectionState('waiting');
          connectingRef.current = false;
          onHostNotReady?.();
          return;
        }
        
        throw new Error(errMsg);
      }

      const { token, roomName, livekitUrl: rawLivekitUrl } = data;
      
      console.log('[WebRTCViewer] Edge function response:', { 
        hasToken: !!token, 
        tokenLength: token?.length,
        roomName, 
        rawLivekitUrl 
      });
      
      // === URL SANITIZATION ===
      if (!rawLivekitUrl || typeof rawLivekitUrl !== 'string') {
        throw new Error('LiveKit URL inválida (wsUrl vazio)');
      }
      
      let livekitUrl = rawLivekitUrl.trim();
      if (!livekitUrl) {
        throw new Error('LiveKit URL está vazia após trim');
      }
      
      // Check for invalid characters BEFORE any processing
      const hasInternalSpace = livekitUrl.includes(' ');
      const hasEquals = livekitUrl.includes('=');
      const protocolMatches = livekitUrl.match(/:\/\//g) || [];
      const hasMultipleProtocols = protocolMatches.length > 1;
      
      if (hasInternalSpace || hasEquals || hasMultipleProtocols) {
        const displayValue = livekitUrl.substring(0, 60).replace(/./g, (c) => c === ' ' ? '␣' : c);
        throw new Error(`LIVEKIT_URL inválida (chars: space=${hasInternalSpace}, equals=${hasEquals}, multiProto=${hasMultipleProtocols}): ${displayValue}`);
      }
      
      // Remove duplicate protocol prefixes
      livekitUrl = livekitUrl
        .replace(/^(wss:\/\/)+/g, 'wss://')
        .replace(/^(ws:\/\/)+/g, 'ws://')
        .replace(/^(https:\/\/)+/g, 'https://')
        .replace(/^(http:\/\/)+/g, 'http://');
      
      // Always force wss:// in production (https:// site)
      const isSecureSite = typeof window !== 'undefined' && window.location.protocol === 'https:';
      
      if (livekitUrl.startsWith('https://')) {
        livekitUrl = livekitUrl.replace('https://', 'wss://');
      } else if (livekitUrl.startsWith('http://')) {
        livekitUrl = isSecureSite 
          ? livekitUrl.replace('http://', 'wss://') 
          : livekitUrl.replace('http://', 'ws://');
      } else if (livekitUrl.startsWith('ws://') && isSecureSite) {
        livekitUrl = livekitUrl.replace('ws://', 'wss://');
      } else if (!livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('ws://')) {
        livekitUrl = `wss://${livekitUrl}`;
      }
      
      console.log('[WebRTCViewer] sanitizedLivekitUrl:', livekitUrl, 'room:', roomName, 'isSecureSite:', isSecureSite);

      // Check again before expensive import
      if (!mountedRef.current || currentLiveIdRef.current !== liveId) {
        console.log('[WebRTCViewer] Component state changed, aborting before import');
        connectingRef.current = false;
        return;
      }

      // Import LiveKit client dynamically
      const livekit = await import('livekit-client');
      const { Room, RoomEvent, Track } = livekit;

      // Final check before creating room
      if (!mountedRef.current || currentLiveIdRef.current !== liveId) {
        console.log('[WebRTCViewer] Component state changed, aborting before room creation');
        connectingRef.current = false;
        return;
      }

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Prevent unwanted disconnects in embedded/iframe contexts
        disconnectOnPageLeave: false,
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        if (!mountedRef.current) return;
        console.log('[WebRTCViewer] Connected to room');
        setConnectionState('connected');
        connectingRef.current = false;
        onReady?.();
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!mountedRef.current) return;
        console.log('[WebRTCViewer] Disconnected from room');
        setConnectionState('idle');
        roomRef.current = null;
        connectingRef.current = false;
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (!mountedRef.current) return;
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
        if (!mountedRef.current) return;
        console.log('[WebRTCViewer] Track unsubscribed:', track.kind);
        track.detach();
        
        if (track.kind === Track.Kind.Video) {
          setHasRemoteVideo(false);
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
      
      // Detailed error logging for debugging
      console.error('[WebRTCViewer] Connection error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      
      setConnectionState('error');
      setErrorMessage(err.message);
      connectingRef.current = false;
      onError?.(err.message);
    }
  }, [liveId, onReady, onError, onHostNotReady]);

  // Single connection effect - runs once on mount
  useEffect(() => {
    mountedRef.current = true;
    
    // Small delay to ensure component is stable
    const connectTimer = setTimeout(() => {
      if (mountedRef.current && liveId) {
        connect();
      }
    }, 100);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(connectTimer);
      cleanup();
    };
  }, [liveId]); // Only reconnect when liveId changes

  // Retry for waiting state
  useEffect(() => {
    if (connectionState === 'waiting' && mountedRef.current) {
      const retryTimer = setTimeout(() => {
        if (mountedRef.current && !connectingRef.current && !roomRef.current) {
          console.log('[WebRTCViewer] Retrying connection...');
          connect();
        }
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

  const handleRetry = useCallback(() => {
    cleanup();
    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 500);
  }, [cleanup, connect]);

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
      {/* Remote video - fills height, letterbox on sides for portrait content */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-auto object-contain transition-all duration-300 ${
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
              onClick={handleRetry}
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