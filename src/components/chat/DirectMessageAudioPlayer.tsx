import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface DirectMessageAudioPlayerProps {
  src: string;
  duration?: number;
}

export const DirectMessageAudioPlayer = ({ src, duration }: DirectMessageAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate or analyze waveform data
  useEffect(() => {
    const generateWaveform = async () => {
      try {
        // Try to analyze actual audio data
        const audioContext = new AudioContext();
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = 40;
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const maxVal = Math.max(...filteredData);
        const normalized = filteredData.map(val => val / maxVal);
        setWaveformData(normalized);
        
        await audioContext.close();
      } catch (error) {
        // Fallback to pseudo-random waveform
        const samples = 40;
        const fallbackData: number[] = [];
        for (let i = 0; i < samples; i++) {
          const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
          fallbackData.push(Math.abs(seed % 1) * 0.6 + 0.4);
        }
        setWaveformData(fallbackData);
      }
    };
    
    generateWaveform();
  }, [src]);

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

  // Draw waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = waveformData.length;
    const barWidth = (width / barCount) - 1;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < barCount; i++) {
      const normalizedHeight = waveformData[i];
      const barHeight = normalizedHeight * height * 0.85;
      
      const x = i * (barWidth + 1);
      const y = (height - barHeight) / 2;

      const isPlayed = i / barCount <= progress;
      ctx.fillStyle = isPlayed 
        ? "hsl(var(--primary))" 
        : "hsl(var(--muted-foreground) / 0.4)";
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  }, [currentTime, audioDuration, waveformData]);

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
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[180px] max-w-[240px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <Button 
        type="button"
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>

      <canvas
        ref={canvasRef}
        width={100}
        height={28}
        className="cursor-pointer flex-1"
        onClick={handleCanvasClick}
      />

      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        {formatTime(currentTime)}/{formatTime(audioDuration)}
      </span>
    </div>
  );
};

export default DirectMessageAudioPlayer;
