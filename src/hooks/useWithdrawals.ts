import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWithdrawals,
  updateWithdrawalStatus,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawalsService";

type DecisionAction = "approve" | "reject";

const PAGE_SIZE = 10;

export const useWithdrawals = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [modalAction, setModalAction] = useState<DecisionAction>("approve");
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["withdrawals", { statusFilter, page }],
    queryFn: () => fetchWithdrawals({ status: statusFilter, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: DecisionAction }) =>
      updateWithdrawalStatus(id, action === "approve" ? "approved" : "rejected"),
    onSuccess: () => {
      toast({
        title: "Atualizado",
        description: "Status do saque atualizado.",
      });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      setSelectedWithdrawalId(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const withdrawals = data?.withdrawals ?? [];
  const total = data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const selectedWithdrawal = useMemo(
    () => withdrawals.find((item) => item.id === selectedWithdrawalId) ?? null,
    [withdrawals, selectedWithdrawalId],
  );

  const openDecisionModal = (id: string, action: DecisionAction) => {
    setSelectedWithdrawalId(id);
    setModalAction(action);
  };

  const closeDecisionModal = () => {
    setSelectedWithdrawalId(null);
  };

  const confirmDecision = () => {
    if (!selectedWithdrawalId) return;
    mutation.mutate({ id: selectedWithdrawalId, action: modalAction });
  };

  return {
    withdrawals,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    totalPages,
    isLoading,
    isFetching,
    modalAction,
    selectedWithdrawal,
    openDecisionModal,
    closeDecisionModal,
    confirmDecision,
    isUpdating: mutation.isPending,
  };
};
