import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface UseAutoThumbnailOptions {
  liveId: string | null;
  creatorId: string;
  intervalMs?: number;
}

export const useAutoThumbnail = ({ liveId, creatorId, intervalMs = 30000 }: UseAutoThumbnailOptions) => {
  const lastCaptureRef = useRef<number>(0);
  const isCapturingRef = useRef(false);

  const captureFrame = useCallback(async (videoElement: HTMLVideoElement): Promise<string | null> => {
    if (!videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const canvas = document.createElement("canvas");
      // Use 16:9 aspect ratio for thumbnail
      const aspectRatio = 16 / 9;
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      // Calculate crop dimensions to get 16:9 from video
      let cropWidth = videoWidth;
      let cropHeight = videoWidth / aspectRatio;
      let cropX = 0;
      let cropY = (videoHeight - cropHeight) / 2;

      if (cropHeight > videoHeight) {
        cropHeight = videoHeight;
        cropWidth = videoHeight * aspectRatio;
        cropX = (videoWidth - cropWidth) / 2;
        cropY = 0;
      }

      // Set canvas size (thumbnail resolution)
      canvas.width = 640;
      canvas.height = 360;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(
        videoElement,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height
      );

      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (error) {
      logger.live.error("Failed to capture frame", { error: String(error) });
      return null;
    }
  }, []);

  const uploadThumbnail = useCallback(async (dataUrl: string): Promise<string | null> => {
    if (!creatorId) return null;

    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const fileName = `auto-thumbnail-${creatorId}-${Date.now()}.jpg`;
      const filePath = `${creatorId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("live-thumbnails")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        logger.live.error("Failed to upload thumbnail", { error: error.message });
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("live-thumbnails")
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error) {
      logger.live.error("Thumbnail upload error", { error: String(error) });
      return null;
    }
  }, [creatorId]);

  const updateLiveThumbnail = useCallback(async (thumbnailUrl: string) => {
    if (!liveId) return;

    try {
      await supabase
        .from("lives")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("id", liveId);
      
      logger.live.info("Live thumbnail updated", { liveId, thumbnailUrl });
    } catch (error) {
      logger.live.error("Failed to update live thumbnail", { error: String(error) });
    }
  }, [liveId]);

  const captureAndUpload = useCallback(async (videoElement: HTMLVideoElement) => {
    // Prevent concurrent captures
    if (isCapturingRef.current) return;
    
    // Throttle captures
    const now = Date.now();
    if (now - lastCaptureRef.current < intervalMs) return;

    isCapturingRef.current = true;
    lastCaptureRef.current = now;

    try {
      const frameDataUrl = await captureFrame(videoElement);
      if (!frameDataUrl) {
        isCapturingRef.current = false;
        return;
      }

      const thumbnailUrl = await uploadThumbnail(frameDataUrl);
      if (thumbnailUrl) {
        await updateLiveThumbnail(thumbnailUrl);
      }
    } finally {
      isCapturingRef.current = false;
    }
  }, [captureFrame, uploadThumbnail, updateLiveThumbnail, intervalMs]);

  return { captureAndUpload, captureFrame };
};
