import { useEffect, useRef, useState, useCallback } from "react";
import { CameraOff, SwitchCamera, Camera, Flashlight, FlashlightOff } from "lucide-react";
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

const PIP_POSITION_KEY = "streamstar_pip_position";
const PIP_SIZE_KEY = "streamstar_pip_size";

const getStoredPipPosition = (): { x: number; y: number } => {
  try {
    const stored = localStorage.getItem(PIP_POSITION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return { x: 16, y: 16 };
};

const savePipPosition = (position: { x: number; y: number }) => {
  try {
    localStorage.setItem(PIP_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Ignore errors
  }
};

const getStoredPipSize = (): number => {
  try {
    const stored = localStorage.getItem(PIP_SIZE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2) {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return 1;
};

const savePipSize = (scale: number) => {
  try {
    localStorage.setItem(PIP_SIZE_KEY, scale.toString());
  } catch {
    // Ignore errors
  }
};

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
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  
  // PiP drag state - load from localStorage
  const [pipPosition, setPipPosition] = useState(getStoredPipPosition);
  const [pipScale, setPipScale] = useState(getStoredPipSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);

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

  // PiP camera stream with flash support check
  useEffect(() => {
    const startPipStream = async () => {
      try {
        if (pipStream) {
          pipStream.getTracks().forEach(track => track.stop());
        }

        if (!isStreaming || !pipEnabled || !pipCameraId) {
          setPipStream(null);
          setFlashSupported(false);
          setFlashEnabled(false);
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

        // Check if flash/torch is supported
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.();
          const hasTorch = capabilities && 'torch' in capabilities;
          setFlashSupported(!!hasTorch);
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

  // Toggle flash/torch
  const toggleFlash = useCallback(async () => {
    if (!pipStream) return;
    
    const videoTrack = pipStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const newFlashState = !flashEnabled;
      await videoTrack.applyConstraints({
        advanced: [{ torch: newFlashState } as MediaTrackConstraintSet]
      });
      setFlashEnabled(newFlashState);
    } catch (err) {
      console.error("Error toggling flash:", err);
    }
  }, [pipStream, flashEnabled]);

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
    // Check for pinch gesture (2 fingers)
    if ('touches' in e && e.touches.length === 2) {
      setIsPinching(true);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = pipScale;
      return;
    }

    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { ...pipPosition };
  }, [pipPosition, pipScale]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Handle pinch zoom
    if ('touches' in e && e.touches.length === 2 && isPinching) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scaleChange = distance / pinchStartDistanceRef.current;
      const newScale = Math.max(0.5, Math.min(2, pinchStartScaleRef.current * scaleChange));
      setPipScale(newScale);
      return;
    }

    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const pipWidth = 100 * pipScale;
    const pipHeight = 150 * pipScale;
    const newX = Math.max(8, Math.min(window.innerWidth - pipWidth - 8, positionStartRef.current.x + deltaX));
    const newY = Math.max(8, Math.min(window.innerHeight - pipHeight - 8, positionStartRef.current.y + deltaY));
    
    setPipPosition({ x: newX, y: newY });
  }, [isDragging, isPinching, pipScale]);

  // Save PiP position and size when drag/pinch ends
  const handleDragEnd = useCallback(() => {
    if (isPinching) {
      setIsPinching(false);
      savePipSize(pipScale);
    }
    if (isDragging) {
      setIsDragging(false);
      savePipPosition(pipPosition);
    }
  }, [pipPosition, pipScale, isDragging, isPinching]);

  // Check if device has multiple cameras
  const hasMultipleCameras = cameras.length > 1;

  // PiP dimensions based on scale
  const pipWidth = Math.round(100 * pipScale);
  const pipHeight = Math.round(150 * pipScale);

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

      {/* PiP camera - floating window with pinch-to-zoom */}
      {pipEnabled && pipStream && (
        <div
          ref={pipContainerRef}
          className={cn(
            "absolute rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl",
            "bg-black cursor-move select-none touch-none",
            isDragging && "ring-2 ring-primary",
            isPinching && "ring-2 ring-yellow-500"
          )}
          style={{
            width: `${pipWidth}px`,
            height: `${pipHeight}px`,
            left: pipPosition.x,
            top: pipPosition.y,
            zIndex: 30,
            transition: isPinching || isDragging ? 'none' : 'width 0.2s, height 0.2s',
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
            title="Trocar câmeras"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>

          {/* Pinch hint indicator */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/50 rounded-full">
            <span className="text-white/70 text-[10px]">Pinça p/ zoom</span>
          </div>
        </div>
      )}

      {/* Toggle PiP button - only show if device has multiple cameras */}
      {hasMultipleCameras && (
        <div className="absolute top-20 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={togglePip}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              "backdrop-blur-sm transition-all active:scale-90",
              pipEnabled 
                ? "bg-primary text-white" 
                : "bg-white/20 text-white"
            )}
            title={pipEnabled ? "Desativar PiP" : "Ativar câmera traseira"}
          >
            <Camera className="h-5 w-5" />
          </button>
          <span className="text-white text-[10px] font-medium drop-shadow-lg">
            {pipEnabled ? "PiP" : "Traseira"}
          </span>
        </div>
      )}

      {/* Switch cameras button - only show when PiP is enabled */}
      {pipEnabled && hasMultipleCameras && (
        <div className="absolute top-20 right-20 z-20 flex flex-col items-center gap-1">
          <button
            onClick={handleSwitchCameras}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
            title="Trocar câmeras"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
          <span className="text-white text-[10px] font-medium drop-shadow-lg">Trocar</span>
        </div>
      )}

      {/* Flash/Torch button - only show when PiP is enabled and flash is supported */}
      {pipEnabled && flashSupported && (
        <div className="absolute top-36 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={toggleFlash}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90",
              flashEnabled
                ? "bg-yellow-500 text-black"
                : "bg-white/20 backdrop-blur-sm text-white"
            )}
            title={flashEnabled ? "Desligar flash" : "Ligar flash"}
          >
            {flashEnabled ? (
              <Flashlight className="h-5 w-5" />
            ) : (
              <FlashlightOff className="h-5 w-5" />
            )}
          </button>
          <span className="text-white text-[10px] font-medium drop-shadow-lg">
            {flashEnabled ? "Flash" : "Flash"}
          </span>
        </div>
      )}
    </div>
  );
};

export default DualCameraPreview;
