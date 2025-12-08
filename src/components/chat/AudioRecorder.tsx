import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  disabled?: boolean;
  maxDuration?: number; // in seconds, default 60
}

export const AudioRecorder = ({ 
  onRecordingComplete, 
  disabled = false,
  maxDuration = 60 
}: AudioRecorderProps) => {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel([]);
      
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

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample 20 bars for the waveform
    const samples = 20;
    const step = Math.floor(dataArray.length / samples);
    const levels: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const index = i * step;
      levels.push(dataArray[index] / 255);
    }

    setAudioLevel(levels);
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context and analyser for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
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

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        onRecordingComplete(blob, Math.min(finalDuration, maxDuration));
        setDuration(0);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1">
        {/* Waveform visualization */}
        <div className="flex items-center gap-0.5 h-8 flex-1 px-2 bg-destructive/10 rounded-md overflow-hidden">
          {audioLevel.length > 0 ? (
            audioLevel.map((level, i) => (
              <div
                key={i}
                className="w-1 bg-destructive rounded-full transition-all duration-75"
                style={{ 
                  height: `${Math.max(4, level * 24)}px`,
                  opacity: 0.6 + level * 0.4
                }}
              />
            ))
          ) : (
            // Placeholder bars while initializing
            Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 bg-destructive/50 rounded-full animate-pulse"
              />
            ))
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/20 rounded-full shrink-0">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-xs font-mono text-destructive">
            {formatTime(duration)}
          </span>
        </div>

        {/* Stop button */}
        <Button 
          type="button"
          size="icon" 
          variant="destructive"
          onClick={stopRecording}
          title={t.chat?.stopRecording || "Parar gravação"}
          className="shrink-0"
        >
          <Square className="h-4 w-4" />
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
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
};

export default AudioRecorder;
