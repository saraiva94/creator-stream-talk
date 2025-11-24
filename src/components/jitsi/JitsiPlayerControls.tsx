import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJitsiPlayerControls } from "@/hooks/useJitsiPlayerControls";
import { Mic, MicOff, Video, VideoOff, RotateCw, Loader2 } from "lucide-react";

type Props = {
  call: any;
  roomUrl: string;
};

const JitsiPlayerControls = ({ call, roomUrl }: Props) => {
  const { state, handleToggleMute, handleToggleCamera, handleReconnect } = useJitsiPlayerControls({ call, roomUrl });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-white">
      <Button
        size="sm"
        variant={state.isMuted ? "destructive" : "secondary"}
        onClick={handleToggleMute}
        className="flex items-center gap-2"
      >
        {state.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        <span>{state.isMuted ? "Muted" : "Mute"}</span>
      </Button>

      <Button
        size="sm"
        variant={state.isCameraOff ? "destructive" : "secondary"}
        onClick={handleToggleCamera}
        className="flex items-center gap-2"
      >
        {state.isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        <span>{state.isCameraOff ? "Camera Off" : "Camera On"}</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleReconnect}
        disabled={state.isReconnecting}
        className="flex items-center gap-2"
      >
        {state.isReconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        <span>{state.isReconnecting ? "Reconectando..." : "Reconectar"}</span>
      </Button>

      <Badge variant="outline" className="ml-auto">
        {state.isMuted ? "Áudio: off" : "Áudio: on"} · {state.isCameraOff ? "Vídeo: off" : "Vídeo: on"}
      </Badge>
    </div>
  );
};

export default JitsiPlayerControls;
