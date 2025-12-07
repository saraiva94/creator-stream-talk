import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  duration?: number;
}

export const AudioPlayer = ({ src, duration }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Draw simple waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 30;
    const barWidth = width / barCount - 2;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      // Generate a pseudo-random height based on position
      const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const normalizedHeight = (Math.abs(seed % 1) * 0.6 + 0.4);
      const barHeight = normalizedHeight * height * 0.8;
      
      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      const isPlayed = i / barCount <= progress;
      ctx.fillStyle = isPlayed 
        ? "hsl(var(--primary))" 
        : "hsl(var(--muted-foreground) / 0.3)";
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [currentTime, audioDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !audioDuration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    audio.currentTime = progress * audioDuration;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[200px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <Button 
        type="button"
        size="icon" 
        variant="ghost" 
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <canvas
        ref={canvasRef}
        width={120}
        height={32}
        className="cursor-pointer flex-1"
        onClick={handleCanvasClick}
      />

      <span className="text-xs text-muted-foreground font-mono shrink-0">
        {formatTime(currentTime)} / {formatTime(audioDuration)}
      </span>
    </div>
  );
};

export default AudioPlayer;
