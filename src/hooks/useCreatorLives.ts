import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { creatorLivesService, type CreatorLiveRow } from "@/lib/creatorLivesService";
import { supabase } from "@/integrations/supabase/client";

type StatusFilter = "all" | "draft" | "scheduled" | "live" | "ended";

export const useCreatorLives = () => {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setProfileId(data.user.id);
      }
    });
  }, []);

  const query = useQuery({
    queryKey: ["creator-lives", profileId],
    queryFn: () => creatorLivesService(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 15_000,
  });

  const lives = query.data?.lives ?? [];

  const filtered = useMemo(() => {
    return lives.filter((live) => {
      const matchesStatus = status === "all" ? true : live.status === status;
      const matchesSearch = live.title.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [lives, status, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const goToPage = (nextPage: number) => {
    const safe = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safe);
  };

  return {
    lives: paginated,
    isLoading: query.isLoading,
    status,
    setStatus,
    search,
    setSearch,
    page,
    totalPages,
    goToPage,
  };
};
