import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";

interface NativeVideoPreviewProps {
  audioDeviceId: string | null;
  videoDeviceId: string | null;
  isStreaming: boolean;
  isMirrored?: boolean;
}

export const NativeVideoPreview = ({
  audioDeviceId,
  videoDeviceId,
  isStreaming,
  isMirrored = false,
}: NativeVideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startStream = async () => {
      try {
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        if (!isStreaming) {
          setStream(null);
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
    };
  }, [audioDeviceId, videoDeviceId, isStreaming]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!isStreaming) {
    return (
      <div className="aspect-video bg-secondary/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground">
        <CameraOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Transmissão desligada</p>
        <p className="text-sm">Ative a transmissão para iniciar</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-destructive/10 rounded-lg flex flex-col items-center justify-center text-destructive">
        <Camera className="h-16 w-16 mb-4" />
        <p className="text-lg">{error}</p>
        <p className="text-sm">Verifique as permissões do navegador</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`}
      />
      {isStreaming && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive text-white px-3 py-1 rounded-full text-sm font-medium">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          AO VIVO
        </div>
      )}
    </div>
  );
};
