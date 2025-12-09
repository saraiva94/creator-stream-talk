import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, Send } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface RecordingWaveformProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  disabled?: boolean;
  maxDuration?: number;
  compact?: boolean;
}

export const RecordingWaveform = ({ 
  onRecordingComplete, 
  disabled = false,
  maxDuration = 60,
  compact = false
}: RecordingWaveformProps) => {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false); // New state for "ready to send"
  const [duration, setDuration] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevels([]);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [isRecording]);

  // Auto-stop at max duration
  useEffect(() => {
    if (duration >= maxDuration && isRecording) {
      stopRecording();
    }
  }, [duration, maxDuration, isRecording, stopRecording]);

  // Draw real-time waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || audioLevels.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = audioLevels.length;
    const barWidth = (width / barCount) - 1;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      const level = audioLevels[i];
      const barHeight = Math.max(3, level * height * 0.9);
      
      const x = i * (barWidth + 1);
      const y = (height - barHeight) / 2;

      // Gradient from destructive to primary based on level
      const opacity = 0.5 + level * 0.5;
      ctx.fillStyle = `hsl(var(--destructive) / ${opacity})`;
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  }, [audioLevels]);

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample bars for the waveform
    const samples = compact ? 25 : 35;
    const step = Math.floor(dataArray.length / samples);
    const levels: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const index = i * step;
      // Average a few neighboring values for smoother visualization
      let sum = 0;
      const range = 3;
      for (let j = -range; j <= range; j++) {
        const idx = Math.max(0, Math.min(dataArray.length - 1, index + j));
        sum += dataArray[idx];
      }
      levels.push((sum / (range * 2 + 1)) / 255);
    }

    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [isRecording, compact]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context and analyser for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      setDuration(0);
      setAudioLevels(Array(compact ? 25 : 35).fill(0.1));

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordDuration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Store blob and show send/cancel options instead of sending directly
        setRecordedBlob(blob);
        setFinalDuration(Math.min(recordDuration, maxDuration));
        setHasRecorded(true);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Timer to show duration
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

      // Start waveform animation
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const handleSendAudio = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob, finalDuration);
    }
    resetState();
  };

  const handleCancelAudio = () => {
    resetState();
  };

  const resetState = () => {
    setRecordedBlob(null);
    setHasRecorded(false);
    setFinalDuration(0);
    setDuration(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show recorded state with send/cancel options
  if (hasRecorded && recordedBlob) {
    return (
      <div className="flex items-center gap-2 flex-1">
        {/* Audio ready indicator */}
        <div className="flex-1 flex items-center justify-center px-2 py-1 bg-primary/10 rounded-md">
          <span className="text-xs text-primary font-medium">
            🎤 {formatTime(finalDuration)}
          </span>
        </div>

        {/* Cancel button */}
        <Button 
          type="button"
          size="icon" 
          variant="ghost"
          onClick={handleCancelAudio}
          title="Cancelar"
          className="shrink-0 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Send button - user clicks the main send button or this one */}
        <Button 
          type="button"
          size="icon" 
          variant="default"
          onClick={handleSendAudio}
          title="Enviar áudio"
          className="shrink-0 h-8 w-8"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1">
        {/* Waveform canvas */}
        <div className="flex-1 flex items-center px-2 py-1 bg-destructive/10 rounded-md overflow-hidden">
          <canvas
            ref={canvasRef}
            width={compact ? 100 : 140}
            height={28}
            className="w-full"
          />
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/20 rounded-full shrink-0">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-xs font-mono text-destructive">
            {formatTime(duration)}
          </span>
        </div>

        {/* Stop button - now just stops, doesn't send */}
        <Button 
          type="button"
          size="icon" 
          variant="destructive"
          onClick={stopRecording}
          title={t.chat?.stopRecording || "Parar gravação"}
          className="shrink-0 h-8 w-8"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={startRecording}
      disabled={disabled}
      title={t.chat?.recordAudio || "Gravar áudio"}
      className="shrink-0 text-muted-foreground hover:text-foreground h-8 w-8"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};

export default RecordingWaveform;
