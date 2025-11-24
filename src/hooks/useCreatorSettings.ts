import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { creatorSettingsService, saveCreatorSettings, type CreatorProfileSettings } from "@/lib/creatorSettingsService";
import { supabase } from "@/integrations/supabase/client";

export const useCreatorSettings = () => {
  const [profileId, setProfileId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setProfileId(data.user.id);
      }
    });
  }, []);

  const query = useQuery({
    queryKey: ["creator-settings", profileId],
    queryFn: () => creatorSettingsService(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (profile: CreatorProfileSettings) => saveCreatorSettings(profileId as string, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-settings", profileId] });
    },
  });

  const updateField = <K extends keyof CreatorProfileSettings>(key: K, value: CreatorProfileSettings[K]) => {
    if (!query.data?.profile) return;
    queryClient.setQueryData(["creator-settings", profileId], {
      profile: { ...query.data.profile, [key]: value },
    });
  };

  const profile = query.data?.profile ?? null;

  return {
    profile,
    isSaving: mutation.isPending,
    isLoading: query.isLoading,
    updateField,
    save: () => {
      if (profile) mutation.mutate(profile);
    },
  };
};
