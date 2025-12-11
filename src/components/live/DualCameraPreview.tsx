import { useEffect, useRef, useState, useCallback } from "react";
import { CameraOff, SwitchCamera, Camera, Flashlight, FlashlightOff, RotateCcw, User, Video, Circle, Square, Download, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type RecordingQuality = "high" | "medium" | "low";

const QUALITY_SETTINGS: Record<RecordingQuality, { bitrate: number; width: number; height: number; label: string }> = {
  high: { bitrate: 8000000, width: 1080, height: 1920, label: "Alta (1080p)" },
  medium: { bitrate: 5000000, width: 720, height: 1280, label: "Média (720p)" },
  low: { bitrate: 2000000, width: 480, height: 854, label: "Baixa (480p)" },
};

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
  // Default position: bottom-left corner with safe margins
  return { x: 16, y: window.innerHeight ? window.innerHeight - 250 : 400 };
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
  const [pipError, setPipError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("medium");
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  
  // PiP drag state - load from localStorage
  const [pipPosition, setPipPosition] = useState(getStoredPipPosition);
  const [pipScale, setPipScale] = useState(getStoredPipSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [showSwitchHint, setShowSwitchHint] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const hasDraggedRef = useRef(false); // Track if user dragged (to distinguish tap from drag)
  const switchHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera permission and enumerate cameras
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // First check permission state - some browsers don't support this
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permissionStatus.state === 'denied') {
            setError("Permissão de câmera negada. Ative nas configurações do navegador.");
            return;
          }
        } catch {
          // Permission API not supported, proceeding with getUserMedia
        }

        // Request permission explicitly with both cameras if possible
        try {
          const frontStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
          });
          frontStream.getTracks().forEach(t => t.stop());
          
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
            
            if (label.includes("front") || label.includes("frontal") || label.includes("user") || label.includes("selfie") || label.includes("0")) {
              facingMode = "user";
            } else if (label.includes("back") || label.includes("traseira") || label.includes("rear") || label.includes("environment") || label.includes("principal") || label.includes("1")) {
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
        
        if (frontCamera) {
          setMainCameraId(frontCamera.deviceId);
        }
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

  // Main camera stream - always active for preview (not dependent on isStreaming)
  useEffect(() => {
    const startMainStream = async () => {
      try {
        if (mainStream) {
          mainStream.getTracks().forEach(track => track.stop());
        }

        if (!mainCameraId) {
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
  }, [mainCameraId, audioDeviceId]);

  // Auto-enable PiP when streaming starts if device has multiple cameras
  useEffect(() => {
    if (isStreaming && cameras.length > 1 && pipCameraId && !pipEnabled) {
      setPipEnabled(true);
      toast.success("Segunda câmera ativada automaticamente");
    }
  }, [isStreaming, cameras.length, pipCameraId]);

  // PiP camera stream - usando facingMode ao invés de deviceId exato
  useEffect(() => {
    let isMounted = true;
    let currentStream: MediaStream | null = null;
    
    const startPipStream = async () => {
      console.log("[PIP] useEffect triggered", { pipEnabled, mainCameraId, camerasCount: cameras.length });
      
      // Se PiP desabilitado, limpar stream
      if (!pipEnabled) {
        console.log("[PIP] Disabled, cleaning up");
        if (pipStream) {
          pipStream.getTracks().forEach(track => track.stop());
          setPipStream(null);
        }
        setFlashSupported(false);
        setFlashEnabled(false);
        setPipError(null);
        return;
      }
      
      // Verificar se temos câmeras suficientes
      if (cameras.length < 2) {
        console.log("[PIP] Not enough cameras:", cameras.length);
        setPipError("Apenas 1 câmera");
        return;
      }

      // Parar stream anterior
      if (pipStream) {
        console.log("[PIP] Stopping previous stream");
        pipStream.getTracks().forEach(track => track.stop());
        setPipStream(null);
      }
      
      // Determinar qual facingMode usar para PiP (oposto da câmera principal)
      const mainCamera = cameras.find(c => c.deviceId === mainCameraId);
      const mainFacing = mainCamera?.facingMode || 'user';
      const pipFacing = mainFacing === 'user' ? 'environment' : 'user';
      
      console.log("[PIP] Main facing:", mainFacing, "-> PiP facing:", pipFacing);
      
      // Tentar várias abordagens em ordem
      const attempts = [
        // 1. Usar facingMode oposto
        { video: { facingMode: pipFacing } },
        // 2. Usar facingMode ideal
        { video: { facingMode: { ideal: pipFacing } } },
        // 3. Usar deviceId da segunda câmera (não exact)
        { video: { deviceId: cameras.find(c => c.deviceId !== mainCameraId)?.deviceId } },
        // 4. Qualquer câmera disponível
        { video: true },
      ];
      
      for (let i = 0; i < attempts.length; i++) {
        try {
          console.log(`[PIP] Attempt ${i + 1}:`, JSON.stringify(attempts[i]));
          
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            ...attempts[i]
          });
          
          if (!isMounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // Verificar se obtivemos uma câmera diferente
          const newTrack = stream.getVideoTracks()[0];
          const settings = newTrack?.getSettings?.();
          console.log("[PIP] Got stream, settings:", settings?.facingMode, settings?.deviceId?.slice(0, 8));
          
          currentStream = stream;
          setPipStream(stream);
          setPipError(null);

          // Check flash support
          if (newTrack) {
            try {
              const capabilities = newTrack.getCapabilities?.() as Record<string, unknown> | undefined;
              setFlashSupported(!!capabilities?.['torch']);
            } catch {
              setFlashSupported(false);
            }
          }
          
          console.log("[PIP] Success on attempt", i + 1);
          return; // Sucesso, sair do loop
          
        } catch (err) {
          console.log(`[PIP] Attempt ${i + 1} failed:`, (err as Error).message);
          if (i === attempts.length - 1) {
            setPipError((err as Error).message);
          }
        }
      }
    };

    startPipStream();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [pipEnabled, mainCameraId, cameras]);

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

  // Switch cameras - funciona com ou sem PiP
  const handleSwitchCameras = useCallback(() => {
    if (cameras.length < 2) {
      toast.error("Apenas uma câmera disponível");
      return;
    }
    
    // Encontrar as duas câmeras
    const cam1 = cameras[0];
    const cam2 = cameras[1];
    
    if (!cam1 || !cam2) {
      toast.error("Câmeras não encontradas");
      return;
    }
    
    // Se main é cam1, trocar para cam2 e vice-versa
    if (mainCameraId === cam1.deviceId) {
      setMainCameraId(cam2.deviceId);
      if (pipEnabled) setPipCameraId(cam1.deviceId);
    } else {
      setMainCameraId(cam1.deviceId);
      if (pipEnabled) setPipCameraId(cam2.deviceId);
    }
    
    toast.success("Câmera invertida!");
  }, [cameras, mainCameraId, pipEnabled]);

  // Toggle PiP - SIMPLIFICADO
  const togglePip = useCallback(() => {
    console.log("[TOGGLE PIP] Called", { pipEnabled, camerasCount: cameras.length });
    
    if (pipEnabled) {
      // Desativando PiP
      if (pipStream) {
        pipStream.getTracks().forEach(track => track.stop());
      }
      setPipStream(null);
      setPipEnabled(false);
      console.log("[TOGGLE PIP] Disabled");
    } else {
      // Ativando PiP
      if (cameras.length < 2) {
        toast.error("Seu dispositivo tem apenas uma câmera");
        return;
      }
      setPipEnabled(true);
      console.log("[TOGGLE PIP] Enabled");
    }
  }, [cameras.length, pipEnabled, pipStream]);

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

  // Start recording with quality settings
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
    
    // Get quality settings
    const quality = QUALITY_SETTINGS[recordingQuality];
    
    // Set canvas dimensions based on quality and orientation
    if (orientation === "vertical") {
      canvas.width = quality.width;
      canvas.height = quality.height;
    } else {
      canvas.width = quality.height;
      canvas.height = quality.width;
    }
    
    // Get canvas stream
    const canvasStream = canvas.captureStream(30); // 30 FPS
    
    // Add audio track from main stream
    const audioTracks = mainStream.getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }
    
    // Create MediaRecorder with quality-based bitrate
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    
    const recorder = new MediaRecorder(canvasStream, { 
      mimeType, 
      videoBitsPerSecond: quality.bitrate 
    });
    
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
    setShowQualitySelector(false);
    
    // Start drawing composite frames
    animationFrameRef.current = requestAnimationFrame(drawCompositeFrame);
    
    toast.success(`Gravação iniciada em ${quality.label}!`);
  }, [mainStream, orientation, recordedVideoUrl, drawCompositeFrame, recordingQuality]);

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
    // Reset drag tracking
    hasDraggedRef.current = false;
    
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
      hasDraggedRef.current = true; // Mark as dragged
      return;
    }

    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    // Check if user moved enough to consider it a drag (threshold: 10px)
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      hasDraggedRef.current = true;
    }
    
    const pipWidth = 100 * pipScale;
    const pipHeight = 150 * pipScale;
    const newX = Math.max(8, Math.min(window.innerWidth - pipWidth - 8, positionStartRef.current.x + deltaX));
    const newY = Math.max(8, Math.min(window.innerHeight - pipHeight - 8, positionStartRef.current.y + deltaY));
    
    setPipPosition({ x: newX, y: newY });
  }, [isDragging, isPinching, pipScale]);

  // Save PiP position and size when drag/pinch ends, show switch hint on tap
  const handleDragEnd = useCallback(() => {
    if (isPinching) {
      setIsPinching(false);
      savePipSize(pipScale);
    }
    if (isDragging) {
      setIsDragging(false);
      
      // If user didn't drag (just tapped), show the switch hint
      if (!hasDraggedRef.current) {
        // Clear any existing timeout
        if (switchHintTimeoutRef.current) {
          clearTimeout(switchHintTimeoutRef.current);
        }
        setShowSwitchHint(true);
        switchHintTimeoutRef.current = setTimeout(() => {
          setShowSwitchHint(false);
        }, 2000);
      } else {
        savePipPosition(pipPosition);
      }
    }
  }, [pipPosition, pipScale, isDragging, isPinching]);

  // Check if device has multiple cameras
  const hasMultipleCameras = cameras.length > 1;

  // PiP dimensions based on scale - larger base size for visibility
  const pipWidth = Math.round(140 * pipScale);
  const pipHeight = Math.round(200 * pipScale);

  // Show camera preview even when not streaming (for creator to see what will be broadcast)

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

      {/* Main camera indicator - GREEN for principal camera when streaming, GRAY when offline */}
      <div className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full animate-fade-in border",
        isStreaming ? "border-green-500/50" : "border-gray-500/50"
      )}>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isStreaming ? "bg-green-500 animate-pulse" : "bg-gray-500"
        )} />
        <span className={cn(
          "text-xs font-semibold",
          isStreaming ? "text-green-400" : "text-gray-400"
        )}>
          {getCameraLabel(mainCameraId)}
        </span>
        <span className="text-white/60 text-xs">• {isStreaming ? "Ao Vivo" : "Preview"}</span>
      </div>

      {/* Hidden video element for PiP - always rendered to keep ref available */}
      <video
        ref={pipVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      
      {/* PiP secondary camera - visible container - LIMPO sem labels */}
      {pipEnabled && pipStream && (
        <div
          ref={pipContainerRef}
          className={cn(
            "absolute rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl",
            "bg-black cursor-move select-none touch-none",
            isDragging && "border-primary ring-2 ring-primary/50"
          )}
          style={{
            width: `${pipWidth}px`,
            height: `${pipHeight}px`,
            left: pipPosition.x,
            top: pipPosition.y,
            zIndex: 50,
            transition: isDragging ? 'none' : 'width 0.2s, height 0.2s',
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {/* Video da segunda câmera */}
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            ref={(el) => {
              if (el && pipStream) {
                el.srcObject = pipStream;
              }
            }}
          />
        </div>
      )}

      {/* Toggle secondary camera button */}
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
            Segunda<br/>Câmera
          </span>
        </div>
      )}

      {/* Switch cameras button - SEMPRE visível se tem 2 câmeras */}
      {hasMultipleCameras && (
        <div className="absolute top-40 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={handleSwitchCameras}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90 hover:bg-white/30 shadow-lg"
            title="Inverter câmera principal"
          >
            <SwitchCamera className="h-6 w-6" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-lg text-center">Inverter</span>
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

      {/* Left side controls - Recording, Quality selector, and Download buttons */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3">
        {/* Quality selector button - only show when not recording */}
        {!isRecording && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowQualitySelector(!showQualitySelector)}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg",
                showQualitySelector
                  ? "bg-primary text-primary-foreground ring-2 ring-white/50"
                  : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
              )}
              title="Qualidade da gravação"
            >
              <Settings2 className="h-5 w-5" />
            </button>
            <span className="text-white text-[10px] font-semibold drop-shadow-lg text-center">
              {QUALITY_SETTINGS[recordingQuality].label.split(' ')[0]}
            </span>
          </div>
        )}

        {/* Quality dropdown - positioned to the right */}
        {showQualitySelector && !isRecording && (
          <div className="absolute left-16 top-0 bg-background/95 backdrop-blur-sm rounded-lg shadow-xl border border-border p-2 min-w-[140px] z-50">
            <p className="text-xs text-muted-foreground mb-2 px-2">Qualidade</p>
            {(["high", "medium", "low"] as RecordingQuality[]).map((quality) => (
              <button
                key={quality}
                onClick={() => {
                  setRecordingQuality(quality);
                  setShowQualitySelector(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  recordingQuality === quality
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {QUALITY_SETTINGS[quality].label}
              </button>
            ))}
          </div>
        )}

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
