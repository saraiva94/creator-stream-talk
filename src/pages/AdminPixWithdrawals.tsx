import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PixWithdrawalsTable from "@/components/admin/PixWithdrawalsTable";
import PixWithdrawalFilters from "@/components/admin/PixWithdrawalFilters";
import PixWithdrawalActionModal from "@/components/admin/PixWithdrawalActionModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePixWithdrawals } from "@/hooks/usePixWithdrawals";
import { Badge } from "@/components/ui/badge";
import { Banknote, AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import GlobalChatButton from "@/components/GlobalChatButton";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const AdminPixWithdrawals = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  
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
      <Navbar user={user} isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Back button */}
        <Button 
          variant="ghost" 
          className="gap-2 mb-4" 
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t.pixWithdrawals.back}
        </Button>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin · {t.pixWithdrawals.title}</h1>
              <p className="text-muted-foreground">
                {t.pixWithdrawals.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{t.pixWithdrawals.flowBadge}</Badge>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t.pixWithdrawals.flowDescription}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>{t.pixWithdrawals.cardTitle}</CardTitle>
            <CardDescription>
              {t.pixWithdrawals.cardDescription}
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

      <GlobalChatButton user={user} />
    </div>
  );
};

export default AdminPixWithdrawals;
