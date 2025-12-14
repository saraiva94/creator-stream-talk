import { useEffect, useRef, useState, useCallback, useImperativeHandle } from "react";
import { RefreshCw, Video, Circle, Square, Download, Settings2 } from "lucide-react";
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
  hideControls?: boolean; // Hide built-in controls for external management
  onRecordingStateChange?: (isRecording: boolean, recordingUrl: string | null) => void;
  externalControlsRef?: React.RefObject<DualCameraControlsRef | null>;
}

export interface DualCameraControlsRef {
  startRecording: () => void;
  stopRecording: () => void;
  downloadRecording: () => void;
  switchCamera: () => void;
  isRecording: boolean;
  recordedVideoUrl: string | null;
  recordingDuration: number;
  recordingQuality: RecordingQuality;
  setRecordingQuality: (q: RecordingQuality) => void;
  hasTwoCameras: boolean;
}

interface CameraInfo {
  deviceId: string;
  label: string;
  facingMode?: "user" | "environment";
}

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
  hideControls = false,
  onRecordingStateChange,
  externalControlsRef,
}) => {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const [mainStream, setMainStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [mainCameraId, setMainCameraId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("medium");
  const [showQualitySelector, setShowQualitySelector] = useState(false);

  // Request camera permission and enumerate cameras
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // First check permission state
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permissionStatus.state === 'denied') {
            setError("Permissão de câmera negada. Ative nas configurações do navegador.");
            return;
          }
        } catch {
          // Permission API not supported
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
        
        // Set initial camera - prefer front
        const frontCamera = videoDevices.find(c => c.facingMode === "user") || videoDevices[0];
        
        if (frontCamera) {
          setMainCameraId(frontCamera.deviceId);
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

  // Switch camera (front <-> back)
  const handleSwitchCamera = useCallback(() => {
    if (cameras.length < 2) {
      toast.error("Apenas uma câmera disponível");
      return;
    }

    const currentCamera = cameras.find(c => c.deviceId === mainCameraId);
    let nextCamera: CameraInfo | null = null;

    if (currentCamera?.facingMode === "user") {
      // Current is front -> switch to back
      nextCamera =
        cameras.find(c => c.facingMode === "environment") ||
        cameras.find(c => c.deviceId !== mainCameraId) ||
        null;
    } else if (currentCamera?.facingMode === "environment") {
      // Current is back -> switch to front
      nextCamera =
        cameras.find(c => c.facingMode === "user") ||
        cameras.find(c => c.deviceId !== mainCameraId) ||
        null;
    } else {
      // No facingMode -> just pick another camera
      nextCamera = cameras.find(c => c.deviceId !== mainCameraId) || null;
    }

    if (nextCamera) {
      setMainCameraId(nextCamera.deviceId);
      toast.success("Câmera invertida!");
    }
  }, [cameras, mainCameraId]);

  // Recording functions
  const startRecording = useCallback(() => {
    if (!mainStream) {
      toast.error("Nenhum stream de vídeo disponível");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const quality = QUALITY_SETTINGS[recordingQuality];
      
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: quality.bitrate
      };

      // Fallback if vp9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(mainStream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Erro ao iniciar gravação");
    }
  }, [mainStream, recordingQuality]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordedVideoUrl) return;
    
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `gravacao_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl(null);
    toast.success("Vídeo baixado!");
  }, [recordedVideoUrl]);

  // Update recording duration
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

  // Notify parent of recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording, recordedVideoUrl);
    }
  }, [isRecording, recordedVideoUrl, onRecordingStateChange]);

  // Expose controls via ref for external management
  useImperativeHandle(externalControlsRef, () => ({
    startRecording,
    stopRecording,
    downloadRecording,
    switchCamera: handleSwitchCamera,
    isRecording,
    recordedVideoUrl,
    recordingDuration,
    recordingQuality,
    setRecordingQuality,
    hasTwoCameras: cameras.length >= 2,
  }), [startRecording, stopRecording, downloadRecording, handleSwitchCamera, isRecording, recordedVideoUrl, recordingDuration, recordingQuality, cameras.length]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Hidden canvas for recording */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Video */}
      <video
        ref={mainVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 w-full h-full",
          orientation === "vertical" ? "object-cover" : "object-contain",
          isMirrored && "scale-x-[-1]"
        )}
      />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Recording indicator - always show when recording, regardless of hideControls */}
      {isRecording && (
        <div className="absolute top-4 right-4 z-20">
          <div className="px-3 py-1.5 rounded-full bg-red-500/80 text-white text-xs font-medium flex items-center gap-2 backdrop-blur-sm animate-pulse">
            <Circle className="w-2.5 h-2.5 fill-white" />
            REC {formatDuration(recordingDuration)}
          </div>
        </div>
      )}

      {/* Built-in controls - only show when hideControls is false */}
      {!hideControls && (
        <>
          {/* Status indicator */}
          <div className="absolute top-4 left-4 z-20">
            <div className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-sm",
              isStreaming 
                ? "bg-green-500/80 text-white" 
                : "bg-black/60 text-white/80"
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                isStreaming ? "bg-white animate-pulse" : "bg-white/60"
              )} />
              {isStreaming ? "Ao Vivo" : "Preview"}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4 z-20 px-4">
            {/* Quality selector (only when not recording) */}
            {!isRecording && showQualitySelector && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-lg p-2">
                <Select
                  value={recordingQuality}
                  onValueChange={(v) => {
                    setRecordingQuality(v as RecordingQuality);
                    setShowQualitySelector(false);
                  }}
                >
                  <SelectTrigger className="w-[140px] bg-transparent border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(QUALITY_SETTINGS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Settings button (quality) */}
            {!isRecording && (
              <button
                onClick={() => setShowQualitySelector(!showQualitySelector)}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90"
              >
                <Settings2 className="w-5 h-5 text-white" />
              </button>
            )}

            {/* Record button */}
            {!recordedVideoUrl && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
                  isRecording 
                    ? "bg-red-500/80 backdrop-blur-sm" 
                    : "bg-white/20 backdrop-blur-sm border-4 border-white"
                )}
              >
                {isRecording ? (
                  <Square className="w-6 h-6 text-white fill-white" />
                ) : (
                  <Circle className="w-8 h-8 text-red-500 fill-red-500" />
                )}
              </button>
            )}

            {/* Download button (after recording) */}
            {recordedVideoUrl && (
              <button
                onClick={downloadRecording}
                className="w-16 h-16 rounded-full bg-green-500/80 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90"
              >
                <Download className="w-7 h-7 text-white" />
              </button>
            )}

            {/* Switch camera button */}
            {cameras.length >= 2 && (
              <button
                onClick={handleSwitchCamera}
                className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 active:scale-90"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DualCameraPreview;
