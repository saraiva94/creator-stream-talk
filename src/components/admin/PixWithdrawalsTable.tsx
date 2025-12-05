import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { type PixWithdrawalRecord, type ProcessAction } from "@/lib/pixWithdrawalsService";
import { Check, X, Banknote, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  withdrawals: PixWithdrawalRecord[];
  isLoading?: boolean;
  isFetching?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAction: (id: string, action: ProcessAction) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  completed: { label: "Concluído", variant: "outline" },
};

const PixWithdrawalsTable = ({
  withdrawals,
  isLoading,
  isFetching,
  page,
  totalPages,
  onPageChange,
  onAction,
}: Props) => {
  const { toast } = useToast();
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Chave PIX copiada para a área de transferência" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Chave PIX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: 6 }).map((_, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : withdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum saque PIX encontrado
                </TableCell>
              </TableRow>
            ) : (
              withdrawals.map((withdrawal) => {
                const status = statusConfig[withdrawal.status] ?? statusConfig.pending;
                const pixKey = withdrawal.metadata?.pix_key;
                const pixKeyType = withdrawal.metadata?.pix_key_type;

                return (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      <div className="font-medium">{withdrawal.user_profile?.username ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {withdrawal.user_id}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(withdrawal.amount)}
                    </TableCell>
                    <TableCell>
                      {pixKey ? (
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground uppercase">{pixKeyType}</div>
                            <div className="font-mono text-sm truncate max-w-[180px]">{pixKey}</div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(pixKey)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(withdrawal.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {withdrawal.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              disabled={isFetching}
                              onClick={() => onAction(withdrawal.id, "approve")}
                            >
                              <Check className="h-3 w-3" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              disabled={isFetching}
                              onClick={() => onAction(withdrawal.id, "reject")}
                            >
                              <X className="h-3 w-3" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {withdrawal.status === "approved" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1"
                            disabled={isFetching}
                            onClick={() => onAction(withdrawal.id, "complete")}
                          >
                            <Banknote className="h-3 w-3" />
                            Marcar como Pago
                          </Button>
                        )}
                        {(withdrawal.status === "rejected" || withdrawal.status === "completed") && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={!canGoPrev}
              onClick={(e) => {
                e.preventDefault();
                if (canGoPrev) onPageChange(page - 1);
              }}
              className={!canGoPrev ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive href="#">
              Página {page} de {totalPages}
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!canGoNext}
              onClick={(e) => {
                e.preventDefault();
                if (canGoNext) onPageChange(page + 1);
              }}
              className={!canGoNext ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default PixWithdrawalsTable;
