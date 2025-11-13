import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoPreviewProps {
  videoUrl: string;
  previewDuration?: number;
  onPreviewEnd: () => void;
  onLogin: () => void;
}

const VideoPreview = ({
  videoUrl,
  previewDuration = 30,
  onPreviewEnd,
  onLogin,
}: VideoPreviewProps) => {
  const [timeLeft, setTimeLeft] = useState(previewDuration);
  const [showDialog, setShowDialog] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsBlurred(true);
          setShowDialog(true);
          if (videoRef.current) {
            videoRef.current.muted = true;
          }
          onPreviewEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onPreviewEnd]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted
        className={`w-full h-full object-cover transition-all duration-500 ${
          isBlurred ? "blur-xl" : ""
        }`}
      />

      {timeLeft > 0 && (
        <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm font-medium">
          Preview: {timeLeft}s
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-primary">
              Continue Assistindo
            </DialogTitle>
            <DialogDescription>
              Faça login ou crie uma conta para continuar assistindo esta transmissão ao vivo e
              interagir no chat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button className="flex-1" onClick={onLogin}>
              Entrar / Cadastrar
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDialog(false)}
            >
              Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoPreview;
