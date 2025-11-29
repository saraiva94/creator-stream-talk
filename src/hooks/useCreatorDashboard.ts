import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { creatorDashboardService } from "@/lib/creatorDashboardService";
import { supabase } from "@/integrations/supabase/client";

type Range = "7d" | "30d" | "90d";

export const useCreatorDashboard = () => {
  const [range, setRange] = useState<Range>("7d");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setProfileId(data.user.id);
      }
    });
  }, []);

  const query = useQuery({
    queryKey: ["creator-dashboard", profileId, range],
    queryFn: () => creatorDashboardService(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });

  return {
    range,
    setRange,
    summary: query.data?.summary ?? null,
    chart: query.data?.chart ?? [],
    topLives: query.data?.topLives ?? [],
    isLoading: query.isLoading,
  };
};
