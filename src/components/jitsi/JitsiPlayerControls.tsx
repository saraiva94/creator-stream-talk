import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJitsiPlayerControls } from "@/hooks/useJitsiPlayerControls";
import { RotateCw, Loader2, Info } from "lucide-react";

type Props = {
  roomUrl: string;
};

const JitsiPlayerControls = ({ roomUrl }: Props) => {
  const { state, handleReconnect } = useJitsiPlayerControls({ roomUrl });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-white">
      <Badge variant="outline" className="flex items-center gap-1">
        <Info className="h-3 w-3" />
        Use os controles do Jitsi na janela de vídeo
      </Badge>

      <Button
        size="sm"
        variant="outline"
        onClick={handleReconnect}
        disabled={state.isReconnecting}
        className="ml-auto flex items-center gap-2"
      >
        {state.isReconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        <span>{state.isReconnecting ? "Reconectando..." : "Reconectar"}</span>
      </Button>
    </div>
  );
};

export default JitsiPlayerControls;
