import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { creatorHistoryService } from "@/lib/creatorHistoryService";
import { supabase } from "@/integrations/supabase/client";

type Range = "7d" | "30d" | "90d" | "all";

export const useCreatorHistory = () => {
  const [range, setRange] = useState<Range>("30d");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setProfileId(data.user.id);
      }
    });
  }, []);

  const query = useQuery({
    queryKey: ["creator-history", profileId],
    queryFn: () => creatorHistoryService(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });

  const entries = query.data?.entries ?? [];

  const filtered = useMemo(() => {
    if (range === "all") return entries;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return entries.filter((entry) => new Date(entry.date) >= cutoff);
  }, [entries, range]);

  return {
    range,
    setRange,
    entries: filtered,
    isLoading: query.isLoading,
  };
};
