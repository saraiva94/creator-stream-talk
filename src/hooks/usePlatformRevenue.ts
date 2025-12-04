import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchPlatformRevenue, type PlatformRevenueResponse, type RevenueRange } from "@/lib/platformRevenueService";

const DEFAULT_RANGE: RevenueRange = "30d";

export const usePlatformRevenue = () => {
  const [range, setRange] = useState<RevenueRange>(DEFAULT_RANGE);

  const { data, isLoading, isFetching, refetch } = useQuery<PlatformRevenueResponse>({
    queryKey: ["platform-revenue", range],
    queryFn: () => fetchPlatformRevenue(range),
    placeholderData: keepPreviousData,
  });

  return {
    range,
    setRange,
    data,
    isLoading,
    isFetching,
    refetch,
  };
};
