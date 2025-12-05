import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchPixWithdrawals,
  processPixWithdrawal,
  type PixWithdrawalRecord,
  type PixWithdrawalStatus,
  type ProcessAction,
} from "@/lib/pixWithdrawalsService";

const PAGE_SIZE = 10;

export const usePixWithdrawals = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<PixWithdrawalStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [modalAction, setModalAction] = useState<ProcessAction>("approve");
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pix-withdrawals", { statusFilter, page }],
    queryFn: () => fetchPixWithdrawals({ status: statusFilter, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: ProcessAction; notes?: string }) =>
      processPixWithdrawal(id, action, notes),
    onSuccess: (result) => {
      toast({
        title: "Sucesso",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ["pix-withdrawals"] });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: "Erro ao processar",
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
    [withdrawals, selectedWithdrawalId]
  );

  const openModal = (id: string, action: ProcessAction) => {
    setSelectedWithdrawalId(id);
    setModalAction(action);
    setAdminNotes("");
  };

  const closeModal = () => {
    setSelectedWithdrawalId(null);
    setAdminNotes("");
  };

  const confirmAction = () => {
    if (!selectedWithdrawalId) return;
    mutation.mutate({ 
      id: selectedWithdrawalId, 
      action: modalAction, 
      notes: adminNotes || undefined 
    });
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
    adminNotes,
    setAdminNotes,
    openModal,
    closeModal,
    confirmAction,
    isProcessing: mutation.isPending,
  };
};
