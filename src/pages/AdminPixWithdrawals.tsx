import { useCallback } from "react";
import PixWithdrawalsTable from "@/components/admin/PixWithdrawalsTable";
import PixWithdrawalFilters from "@/components/admin/PixWithdrawalFilters";
import PixWithdrawalActionModal from "@/components/admin/PixWithdrawalActionModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePixWithdrawals } from "@/hooks/usePixWithdrawals";
import { Badge } from "@/components/ui/badge";
import { Banknote, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminPixWithdrawals = () => {
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
    adminNotes,
    setAdminNotes,
    openModal,
    closeModal,
    confirmAction,
    isProcessing,
  } = usePixWithdrawals();

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const safePage = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(safePage);
    },
    [setPage, totalPages]
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin · Saques PIX</h1>
              <p className="text-muted-foreground">
                Gerencie solicitações de saque via PIX dos usuários.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Fluxo: Pendente → Aprovado → Pago</Badge>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Fluxo de processamento:</strong> 1) Aprovar a solicitação após verificar os dados. 
            2) Realizar a transferência PIX manualmente. 
            3) Marcar como "Pago" para finalizar.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Solicitações de Saque</CardTitle>
            <CardDescription>
              Filtre por status, verifique as chaves PIX e processe os pagamentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PixWithdrawalFilters
              value={statusFilter}
              onChange={setStatusFilter}
              onReset={() => setStatusFilter("pending")}
            />

            <PixWithdrawalsTable
              withdrawals={withdrawals}
              isLoading={isLoading}
              isFetching={isFetching}
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onAction={openModal}
            />
          </CardContent>
        </Card>

        <PixWithdrawalActionModal
          open={Boolean(selectedWithdrawal)}
          action={modalAction}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
          onConfirm={confirmAction}
          isProcessing={isProcessing}
          adminNotes={adminNotes}
          onAdminNotesChange={setAdminNotes}
        />
      </main>
    </div>
  );
};

export default AdminPixWithdrawals;
