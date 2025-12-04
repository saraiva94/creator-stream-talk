import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchLiveMonitorData, type LiveMonitorData } from "@/lib/liveMonitorService";

const REFRESH_INTERVAL_MS = 15_000;

export const useLiveMonitor = () => {
  const { data, isLoading, isFetching, refetch } = useQuery<LiveMonitorData>({
    queryKey: ["live-monitor"],
    queryFn: fetchLiveMonitorData,
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });

  const summary = useMemo(() => {
    const active = data?.activeLives?.length ?? 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const endedToday =
      data?.recentLives?.filter((live) => {
        const key = live.ended_at ? live.ended_at.slice(0, 10) : null;
        return key === todayKey;
      }).length ?? 0;
    const alerts = data?.alerts?.length ?? 0;
    return { active, endedToday, alerts };
  }, [data]);

  return {
    data,
    summary,
    isLoading,
    isFetching,
    refetch,
  };
};
