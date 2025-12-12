import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff } from "lucide-react";
import { useAutoThumbnail } from "@/hooks/useAutoThumbnail";

export type VideoOrientation = "vertical" | "horizontal";

interface NativeVideoPreviewProps {
  audioDeviceId: string | null;
  videoDeviceId: string | null;
  isStreaming: boolean;
  isMirrored?: boolean;
  orientation?: VideoOrientation;
  fullscreen?: boolean;
  liveId?: string | null;
  creatorId?: string;
  autoCaptureThumbnail?: boolean;
}

export const NativeVideoPreview = ({
  audioDeviceId,
  videoDeviceId,
  isStreaming,
  isMirrored = false,
  orientation = "vertical",
  fullscreen = false,
  liveId = null,
  creatorId = "",
  autoCaptureThumbnail = false,
}: NativeVideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialCaptureRef = useRef(false);

  const { captureAndUpload } = useAutoThumbnail({
    liveId,
    creatorId,
    intervalMs: 30000, // Capture every 30 seconds
  });

  // Auto-capture thumbnail periodically while streaming
  const startAutoCapture = useCallback(() => {
    if (!autoCaptureThumbnail || !videoRef.current || captureIntervalRef.current) return;

    // Initial capture after 5 seconds (allow stream to stabilize)
    if (!initialCaptureRef.current) {
      setTimeout(() => {
        if (videoRef.current && isStreaming) {
          captureAndUpload(videoRef.current);
          initialCaptureRef.current = true;
        }
      }, 5000);
    }

    // Then capture every 30 seconds
    captureIntervalRef.current = setInterval(() => {
      if (videoRef.current && isStreaming) {
        captureAndUpload(videoRef.current);
      }
    }, 30000);
  }, [autoCaptureThumbnail, captureAndUpload, isStreaming]);

  const stopAutoCapture = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    initialCaptureRef.current = false;
  }, []);

  useEffect(() => {
    const startStream = async () => {
      try {
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        if (!isStreaming) {
          setStream(null);
          stopAutoCapture();
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError(null);
        
        // Start auto-capture after stream is ready
        if (autoCaptureThumbnail) {
          startAutoCapture();
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setError("Não foi possível acessar câmera/microfone");
      }
    };

    startStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stopAutoCapture();
    };
  }, [audioDeviceId, videoDeviceId, isStreaming]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle auto-capture start/stop
  useEffect(() => {
    if (isStreaming && autoCaptureThumbnail && stream) {
      startAutoCapture();
    } else {
      stopAutoCapture();
    }

    return () => stopAutoCapture();
  }, [isStreaming, autoCaptureThumbnail, stream, startAutoCapture, stopAutoCapture]);

  if (!isStreaming) {
    return (
      <div className={`${fullscreen ? "w-full h-full" : "aspect-video"} bg-secondary/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground`}>
        <CameraOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Transmissão desligada</p>
        <p className="text-sm">Ative a transmissão para iniciar</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${fullscreen ? "w-full h-full" : "aspect-video"} bg-destructive/10 rounded-lg flex flex-col items-center justify-center text-destructive`}>
        <Camera className="h-16 w-16 mb-4" />
        <p className="text-lg">{error}</p>
        <p className="text-sm">Verifique as permissões do navegador</p>
      </div>
    );
  }

  // For fullscreen mode, use object-cover for vertical and contain for horizontal
  const objectFit = fullscreen 
    ? (orientation === "vertical" ? "object-cover" : "object-contain")
    : "object-cover";

  return (
    <div className={`${fullscreen ? "w-full h-full" : "aspect-video"} bg-black rounded-lg overflow-hidden relative`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full ${objectFit} ${isMirrored ? "scale-x-[-1]" : ""}`}
      />
      {isStreaming && !fullscreen && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive text-white px-3 py-1 rounded-full text-sm font-medium animate-live-pulse">
          <span className="w-2 h-2 bg-white rounded-full animate-live-dot" />
          AO VIVO
        </div>
      )}
    </div>
  );
};
