import { useEffect, useRef, useState, useCallback } from "react";
import { CameraOff, SwitchCamera, Camera, Flashlight, FlashlightOff, RotateCcw, User, Video, Circle, Square, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

// Format recording duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  
  const [mainStream, setMainStream] = useState<MediaStream | null>(null);
  const [pipStream, setPipStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [mainCameraId, setMainCameraId] = useState<string | null>(null);
  const [pipCameraId, setPipCameraId] = useState<string | null>(null);
  const [pipEnabled, setPipEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  
  // PiP drag state - load from localStorage
  const [pipPosition, setPipPosition] = useState(getStoredPipPosition);
  const [pipScale, setPipScale] = useState(getStoredPipSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);

  // Request camera permission and enumerate cameras
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // First check permission state
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        if (permissionStatus.state === 'denied') {
          setError("Permissão de câmera negada. Ative nas configurações do navegador.");
          return;
        }

        // Request permission explicitly with both cameras if possible
        try {
          // Request front camera first
          const frontStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
          });
          frontStream.getTracks().forEach(t => t.stop());
          
          // Then request back camera
          const backStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          backStream.getTracks().forEach(t => t.stop());
        } catch {
          // Fallback to generic request
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
        }
        
        // Now enumerate all cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(d => d.kind === "videoinput")
          .map(d => {
            const label = d.label.toLowerCase();
            let facingMode: "user" | "environment" | undefined;
            
            if (label.includes("front") || label.includes("frontal") || label.includes("user") || label.includes("selfie")) {
              facingMode = "user";
            } else if (label.includes("back") || label.includes("traseira") || label.includes("rear") || label.includes("environment") || label.includes("principal")) {
              facingMode = "environment";
            }
            
            return {
              deviceId: d.deviceId,
              label: d.label || `Câmera ${d.deviceId.slice(0, 4)}`,
              facingMode,
            };
          });
        
        setCameras(videoDevices);
        
        // Set initial cameras - prefer front for main, back for secondary
        const frontCamera = videoDevices.find(c => c.facingMode === "user") || videoDevices[0];
        const backCamera = videoDevices.find(c => c.facingMode === "environment") || videoDevices[1];
        
        if (frontCamera) setMainCameraId(frontCamera.deviceId);
        if (backCamera && backCamera.deviceId !== frontCamera?.deviceId) {
          setPipCameraId(backCamera.deviceId);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error requesting camera permission:", err);
        setError("Permita o acesso à câmera para continuar");
      }
    };
    
    requestCameraPermission();
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

  // Reset PiP position and size
  const resetPipLayout = useCallback(() => {
    const defaultPosition = { x: 16, y: 16 };
    const defaultScale = 1;
    setPipPosition(defaultPosition);
    setPipScale(defaultScale);
    savePipPosition(defaultPosition);
    savePipSize(defaultScale);
  }, []);

  // Get camera type label
  const getCameraLabel = useCallback((cameraId: string | null): string => {
    if (!cameraId) return "Desconhecida";
    const camera = cameras.find(c => c.deviceId === cameraId);
    if (!camera) return "Desconhecida";
    if (camera.facingMode === "user") return "Frontal";
    if (camera.facingMode === "environment") return "Traseira";
    // Try to detect from label
    const label = camera.label.toLowerCase();
    if (label.includes("front") || label.includes("frontal") || label.includes("selfie")) return "Frontal";
    if (label.includes("back") || label.includes("traseira") || label.includes("rear")) return "Traseira";
    return "Câmera";
  }, [cameras]);

  // Draw composited frame to canvas
  const drawCompositeFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const mainVideo = mainVideoRef.current;
    const pipVideo = pipVideoRef.current;
    
    if (!canvas || !mainVideo) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size based on orientation
    const canvasWidth = orientation === "vertical" ? 720 : 1280;
    const canvasHeight = orientation === "vertical" ? 1280 : 720;
    
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    
    // Draw main video (fullscreen, possibly mirrored)
    ctx.save();
    if (isMirrored) {
      ctx.translate(canvasWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(mainVideo, 0, 0, canvasWidth, canvasHeight);
    ctx.restore();
    
    // Draw PiP video if enabled
    if (pipEnabled && pipVideo && pipStream) {
      const pipW = Math.round(canvasWidth * 0.2 * pipScale);
      const pipH = Math.round(canvasHeight * 0.15 * pipScale);
      const pipX = Math.round((pipPosition.x / window.innerWidth) * canvasWidth);
      const pipY = Math.round((pipPosition.y / window.innerHeight) * canvasHeight);
      
      // Draw rounded rectangle border
      ctx.save();
      ctx.beginPath();
      const radius = 12;
      ctx.roundRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4, radius);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      
      // Clip and draw PiP video
      ctx.beginPath();
      ctx.roundRect(pipX, pipY, pipW, pipH, radius - 2);
      ctx.clip();
      ctx.drawImage(pipVideo, pipX, pipY, pipW, pipH);
      ctx.restore();
    }
    
    // Continue animation loop if recording
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawCompositeFrame);
    }
  }, [isMirrored, orientation, pipEnabled, pipStream, pipPosition, pipScale, isRecording]);

  // Start recording
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mainStream) {
      toast.error("Câmera não disponível para gravação");
      return;
    }
    
    // Clear previous recording
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = [];
    
    // Set canvas dimensions
    canvas.width = orientation === "vertical" ? 720 : 1280;
    canvas.height = orientation === "vertical" ? 1280 : 720;
    
    // Get canvas stream
    const canvasStream = canvas.captureStream(30); // 30 FPS
    
    // Add audio track from main stream
    const audioTracks = mainStream.getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }
    
    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    
    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 5000000 });
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      toast.success("Gravação salva! Clique em Baixar para salvar.");
    };
    
    mediaRecorderRef.current = recorder;
    recorder.start(1000); // Collect data every second
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Start drawing composite frames
    animationFrameRef.current = requestAnimationFrame(drawCompositeFrame);
    
    toast.success("Gravação iniciada!");
  }, [mainStream, orientation, recordedVideoUrl, drawCompositeFrame]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

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

      {/* Main camera indicator - positioned to avoid overlap with viewer count */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full animate-fade-in">
        {getCameraLabel(mainCameraId) === "Frontal" ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Video className="h-4 w-4 text-green-400" />
        )}
        <span className="text-white text-xs font-semibold">
          {getCameraLabel(mainCameraId)}
        </span>
        <span className="text-white/60 text-xs">• Principal</span>
      </div>

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

          {/* Camera type indicator on PiP */}
          <div className="absolute top-1 left-1 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-full flex items-center gap-1">
            {getCameraLabel(pipCameraId) === "Frontal" ? (
              <User className="h-3 w-3 text-primary" />
            ) : (
              <Video className="h-3 w-3 text-green-400" />
            )}
            <span className="text-white text-[9px] font-semibold">{getCameraLabel(pipCameraId)}</span>
          </div>

          {/* Resize hint indicator */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 rounded-full">
            <span className="text-white/80 text-[8px] font-medium">Arraste • Pinça</span>
          </div>
        </div>
      )}

      {/* Toggle secondary camera button - only show if device has multiple cameras */}
      {hasMultipleCameras && (
        <div className="absolute top-20 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={togglePip}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              "backdrop-blur-sm transition-all active:scale-90 shadow-lg",
              pipEnabled 
                ? "bg-primary text-primary-foreground ring-2 ring-white/50" 
                : "bg-white/20 text-white hover:bg-white/30"
            )}
            title={pipEnabled ? "Desativar segunda câmera" : "Ativar segunda câmera"}
          >
            <Camera className="h-6 w-6" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-lg text-center leading-tight">
            {pipEnabled ? "2ª Câmera\nLigada" : "Adicionar\nCâmera"}
          </span>
        </div>
      )}

      {/* Switch cameras button - only show when secondary camera is enabled */}
      {pipEnabled && hasMultipleCameras && (
        <div className="absolute top-40 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={handleSwitchCameras}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90 hover:bg-white/30 shadow-lg"
            title="Inverter posição das câmeras"
          >
            <SwitchCamera className="h-6 w-6" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-lg text-center leading-tight">Inverter\nPosição</span>
        </div>
      )}

      {/* Flash/Torch button - only show when secondary camera is enabled and flash is supported */}
      {pipEnabled && flashSupported && (
        <div className="absolute top-64 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={toggleFlash}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg",
              flashEnabled
                ? "bg-yellow-500 text-black ring-2 ring-white/50"
                : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            )}
            title={flashEnabled ? "Desligar lanterna" : "Ligar lanterna"}
          >
            {flashEnabled ? (
              <Flashlight className="h-6 w-6" />
            ) : (
              <FlashlightOff className="h-6 w-6" />
            )}
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-lg text-center">
            Lanterna
          </span>
        </div>
      )}

      {/* Reset PiP layout button - only show when secondary camera is enabled */}
      {pipEnabled && hasMultipleCameras && (
        <div className="absolute bottom-20 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={resetPipLayout}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90 hover:bg-white/30 shadow-lg"
            title="Resetar posição e tamanho"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <span className="text-white text-[10px] font-semibold drop-shadow-lg text-center">Resetar</span>
        </div>
      )}

      {/* Left side controls - Recording and Download buttons positioned vertically in middle */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4">
        {/* Recording button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg",
              isRecording
                ? "bg-destructive text-destructive-foreground animate-pulse ring-4 ring-destructive/50"
                : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            )}
            title={isRecording ? "Parar gravação" : "Iniciar gravação"}
          >
            {isRecording ? (
              <Square className="h-6 w-6 fill-current" />
            ) : (
              <Circle className="h-6 w-6 fill-current text-red-500" />
            )}
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-lg text-center">
            {isRecording ? formatDuration(recordingDuration) : "Gravar"}
          </span>
        </div>

        {/* Download button - show when recording is available */}
        {recordedVideoUrl && !isRecording && (
          <div className="flex flex-col items-center gap-1 animate-fade-in">
            <a
              href={recordedVideoUrl}
              download={`gravacao_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white transition-all active:scale-90 hover:bg-green-600 shadow-lg"
              title="Baixar gravação"
            >
              <Download className="h-6 w-6" />
            </a>
            <span className="text-white text-xs font-semibold drop-shadow-lg text-center">Baixar</span>
          </div>
        )}
      </div>

      {/* Hidden canvas for compositing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DualCameraPreview;
