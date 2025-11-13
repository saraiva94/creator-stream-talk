import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Mic } from "lucide-react";

interface DeviceSelectorProps {
  onDevicesSelected?: (audioId: string, videoId: string) => void;
}

const DeviceSelector = ({ onDevicesSelected }: DeviceSelectorProps) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");

  useEffect(() => {
    getDevices();
  }, []);

  useEffect(() => {
    if (selectedAudio && selectedVideo && onDevicesSelected) {
      onDevicesSelected(selectedAudio, selectedVideo);
    }
  }, [selectedAudio, selectedVideo, onDevicesSelected]);

  const getDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter(device => device.kind === 'audioinput');
      const video = devices.filter(device => device.kind === 'videoinput');
      
      setAudioDevices(audio);
      setVideoDevices(video);
      
      // Set defaults
      if (audio.length > 0 && !selectedAudio) {
        setSelectedAudio(audio[0].deviceId);
      }
      if (video.length > 0 && !selectedVideo) {
        setSelectedVideo(video[0].deviceId);
      }
    } catch (error) {
      console.error("Error getting devices:", error);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Configurações de Dispositivos
        </CardTitle>
        <CardDescription>
          Selecione a câmera e o microfone para sua transmissão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="audio-select" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Microfone
          </Label>
          <Select value={selectedAudio} onValueChange={setSelectedAudio}>
            <SelectTrigger id="audio-select">
              <SelectValue placeholder="Selecione um microfone" />
            </SelectTrigger>
            <SelectContent>
              {audioDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-select" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Câmera
          </Label>
          <Select value={selectedVideo} onValueChange={setSelectedVideo}>
            <SelectTrigger id="video-select">
              <SelectValue placeholder="Selecione uma câmera" />
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Câmera ${device.deviceId.slice(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceSelector;
