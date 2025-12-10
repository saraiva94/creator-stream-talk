import { useEffect, useRef, useState, useCallback } from "react";
import { CameraOff, SwitchCamera, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export type VideoOrientation = "vertical" | "horizontal";

interface DualCameraPreviewProps {
  audioDeviceId: string | null;
  isStreaming: boolean;
  isMirrored?: boolean;
  orientation?: VideoOrientation;
}

interface CameraInfo {
  deviceId: string;
  label: string;
  facingMode?: "user" | "environment";
}

export const DualCameraPreview: React.FC<DualCameraPreviewProps> = ({
  audioDeviceId,
  isStreaming,
  isMirrored = false,
  orientation = "vertical",
}) => {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);
  
  const [mainStream, setMainStream] = useState<MediaStream | null>(null);
  const [pipStream, setPipStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [mainCameraId, setMainCameraId] = useState<string | null>(null);
  const [pipCameraId, setPipCameraId] = useState<string | null>(null);
  const [pipEnabled, setPipEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PiP drag state
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  // Enumerate cameras
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        // Request permission first to get labels
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(d => d.kind === "videoinput")
          .map(d => {
            const label = d.label.toLowerCase();
            let facingMode: "user" | "environment" | undefined;
            
            if (label.includes("front") || label.includes("frontal") || label.includes("user")) {
              facingMode = "user";
            } else if (label.includes("back") || label.includes("traseira") || label.includes("rear") || label.includes("environment")) {
              facingMode = "environment";
            }
            
            return {
              deviceId: d.deviceId,
              label: d.label || `Câmera ${d.deviceId.slice(0, 4)}`,
              facingMode,
            };
          });
        
        setCameras(videoDevices);
        
        // Set initial cameras - prefer front for main, back for PiP
        const frontCamera = videoDevices.find(c => c.facingMode === "user") || videoDevices[0];
        const backCamera = videoDevices.find(c => c.facingMode === "environment") || videoDevices[1];
        
        if (frontCamera) setMainCameraId(frontCamera.deviceId);
        if (backCamera && backCamera.deviceId !== frontCamera?.deviceId) {
          setPipCameraId(backCamera.deviceId);
        }
      } catch (err) {
        console.error("Error enumerating cameras:", err);
      }
    };
    
    enumerateCameras();
  }, []);

  // Main camera stream
  useEffect(() => {
    const startMainStream = async () => {
      try {
        if (mainStream) {
          mainStream.getTracks().forEach(track => track.stop());
        }

        if (!isStreaming || !mainCameraId) {
          setMainStream(null);
          if (mainVideoRef.current) mainVideoRef.current.srcObject = null;
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: { deviceId: { exact: mainCameraId } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setMainStream(stream);
        
        if (mainVideoRef.current) {
          mainVideoRef.current.srcObject = stream;
        }
        setError(null);
      } catch (err) {
        console.error("Error accessing main camera:", err);
        setError("Não foi possível acessar a câmera principal");
      }
    };

    startMainStream();

    return () => {
      if (mainStream) {
        mainStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mainCameraId, audioDeviceId, isStreaming]);

  // PiP camera stream
  useEffect(() => {
    const startPipStream = async () => {
      try {
        if (pipStream) {
          pipStream.getTracks().forEach(track => track.stop());
        }

        if (!isStreaming || !pipEnabled || !pipCameraId) {
          setPipStream(null);
          if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: { deviceId: { exact: pipCameraId } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setPipStream(stream);
        
        if (pipVideoRef.current) {
          pipVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing PiP camera:", err);
      }
    };

    startPipStream();

    return () => {
      if (pipStream) {
        pipStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [pipCameraId, pipEnabled, isStreaming]);

  // Switch cameras
  const handleSwitchCameras = useCallback(() => {
    if (!mainCameraId || !pipCameraId) return;
    
    const tempMain = mainCameraId;
    setMainCameraId(pipCameraId);
    setPipCameraId(tempMain);
  }, [mainCameraId, pipCameraId]);

  // Toggle PiP
  const togglePip = useCallback(() => {
    if (!pipCameraId && cameras.length > 1) {
      // Find a camera that's not the main one
      const otherCamera = cameras.find(c => c.deviceId !== mainCameraId);
      if (otherCamera) setPipCameraId(otherCamera.deviceId);
    }
    setPipEnabled(prev => !prev);
  }, [cameras, mainCameraId, pipCameraId]);

  // PiP drag handlers
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { ...pipPosition };
  }, [pipPosition]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const newX = Math.max(8, Math.min(window.innerWidth - 120, positionStartRef.current.x + deltaX));
    const newY = Math.max(8, Math.min(window.innerHeight - 180, positionStartRef.current.y + deltaY));
    
    setPipPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Check if device has multiple cameras
  const hasMultipleCameras = cameras.length > 1;

  if (!isStreaming) {
    return (
      <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
        <CameraOff className="h-16 w-16 mb-4" />
        <p className="text-lg">Transmissão desligada</p>
        <p className="text-sm">Ative a transmissão para iniciar</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center text-destructive">
        <Camera className="h-16 w-16 mb-4" />
        <p className="text-lg">{error}</p>
        <p className="text-sm">Verifique as permissões do navegador</p>
      </div>
    );
  }

  const objectFit = orientation === "vertical" ? "object-cover" : "object-contain";

  return (
    <div 
      className="w-full h-full bg-black relative"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      {/* Main camera - fullscreen */}
      <video
        ref={mainVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full h-full",
          objectFit,
          isMirrored && "scale-x-[-1]"
        )}
      />

      {/* PiP camera - floating window */}
      {pipEnabled && pipStream && (
        <div
          ref={pipContainerRef}
          className={cn(
            "absolute rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl",
            "bg-black cursor-move select-none",
            isDragging && "ring-2 ring-primary"
          )}
          style={{
            width: "100px",
            height: "150px",
            left: pipPosition.x,
            top: pipPosition.y,
            zIndex: 30,
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Switch button on PiP */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSwitchCameras();
            }}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toggle PiP button - only show if device has multiple cameras */}
      {hasMultipleCameras && (
        <button
          onClick={togglePip}
          className={cn(
            "absolute top-20 right-4 z-20",
            "w-12 h-12 rounded-full flex items-center justify-center",
            "backdrop-blur-sm transition-all",
            pipEnabled 
              ? "bg-primary text-white" 
              : "bg-white/20 text-white"
          )}
        >
          <Camera className="h-5 w-5" />
        </button>
      )}

      {/* Switch cameras button - only show when PiP is enabled */}
      {pipEnabled && hasMultipleCameras && (
        <button
          onClick={handleSwitchCameras}
          className="absolute top-20 right-20 z-20 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default DualCameraPreview;
