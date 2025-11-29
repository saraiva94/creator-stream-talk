import { useCallback } from "react";
import WithdrawalsTable from "@/components/admin/WithdrawalsTable";
import WithdrawalFilters from "@/components/admin/WithdrawalFilters";
import WithdrawalDecisionModal from "@/components/admin/WithdrawalDecisionModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

const AdminWithdrawals = () => {
  const {
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
    isUpdating,
  } = useWithdrawals();

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const safePage = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(safePage);
    },
    [setPage, totalPages],
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin · Saques</h1>
              <p className="text-muted-foreground">Acompanhe e aprove/rejeite solicitações de saque dos criadores.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Filtro padrão: Pendentes</Badge>
            <span>Alterar o filtro exibirá outros status.</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Controle de saques</CardTitle>
            <CardDescription>Filtre, revise e aprove/rejeite solicitações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <WithdrawalFilters
              value={statusFilter}
              onChange={setStatusFilter}
              onReset={() => setStatusFilter("pending")}
            />

            <WithdrawalsTable
              withdrawals={withdrawals}
              isLoading={isLoading}
              isFetching={isFetching}
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onApprove={(id) => openDecisionModal(id, "approve")}
              onReject={(id) => openDecisionModal(id, "reject")}
            />
          </CardContent>
        </Card>

        <WithdrawalDecisionModal
          open={Boolean(selectedWithdrawal)}
          action={modalAction}
          onOpenChange={(open) => {
            if (!open) {
              closeDecisionModal();
            }
          }}
          onConfirm={confirmDecision}
          isProcessing={isUpdating}
        />
      </main>
    </div>
  );
};

export default AdminWithdrawals;
