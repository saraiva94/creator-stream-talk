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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Auto-stop at max duration
  useEffect(() => {
    if (duration >= maxDuration && isRecording) {
      stopRecording();
    }
  }, [duration, maxDuration, isRecording, stopRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach(track => track.stop());
        
        onRecordingComplete(blob, Math.min(finalDuration, maxDuration));
        setDuration(0);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Timer to show duration
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-destructive/20 rounded-full">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-mono text-destructive">
            {formatTime(duration)} / {formatTime(maxDuration)}
          </span>
        </div>
        <Button 
          type="button"
          size="icon" 
          variant="destructive"
          onClick={stopRecording}
          title={t.chat?.stopRecording || "Parar gravação"}
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
      variant="outline"
      onClick={startRecording}
      disabled={disabled}
      title={t.chat?.recordAudio || "Gravar áudio"}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};

export default AudioRecorder;
