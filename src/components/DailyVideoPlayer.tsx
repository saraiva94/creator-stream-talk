import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff } from "lucide-react";

interface DailyVideoPlayerProps {
  roomUrl: string;
  isCreator?: boolean;
}

const DailyVideoPlayer = ({ roomUrl, isCreator = false }: DailyVideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !roomUrl) return;

    const call = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        position: "absolute",
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "8px",
      },
      showLeaveButton: false,
      showFullscreenButton: true,
    });

    call
      .join({ url: roomUrl })
      .then(() => {
        console.log("Joined Daily.co room:", roomUrl);
        setCallObject(call);
      })
      .catch((error) => {
        console.error("Error joining room:", error);
      });

    return () => {
      if (call) {
        call.leave().then(() => call.destroy());
      }
    };
  }, [roomUrl]);

  const toggleAudio = () => {
    if (callObject) {
      callObject.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (callObject) {
      callObject.setLocalVideo(!isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleScreenShare = async () => {
    if (!callObject) return;

    try {
      if (isScreenSharing) {
        await callObject.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await callObject.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-secondary" />

      {isCreator && callObject && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/80 p-2 rounded-lg">
          <Button
            size="icon"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={toggleAudio}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant={isCameraOff ? "destructive" : "secondary"}
            onClick={toggleVideo}
          >
            {isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant={isScreenSharing ? "default" : "secondary"}
            onClick={toggleScreenShare}
          >
            {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DailyVideoPlayer;
