import { supabase } from "@/integrations/supabase/client";

export type PixWithdrawalStatus = "pending" | "approved" | "rejected" | "completed";

export type PixWithdrawalRecord = {
  id: string;
  user_id: string;
  amount: number;
  status: PixWithdrawalStatus;
  type: string;
  created_at: string;
  metadata?: {
    pix_key?: string;
    pix_key_type?: string;
    admin_notes?: string;
    processed_at?: string;
    processed_by?: string;
  };
  user_profile?: {
    username?: string;
    email?: string;
  };
};

type FetchParams = {
  status?: PixWithdrawalStatus | "all";
  page?: number;
  pageSize?: number;
};

type FetchResult = {
  withdrawals: PixWithdrawalRecord[];
  total: number;
};

export const fetchPixWithdrawals = async ({
  status = "pending",
  page = 1,
  pageSize = 10,
}: FetchParams): Promise<FetchResult> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("transactions")
    .select(
      `
        id,
        user_id,
        amount,
        status,
        type,
        created_at,
        metadata
      `,
      { count: "exact" }
    )
    .eq("type", "pix_withdrawal")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Fetch user profiles for each withdrawal
  const userIds = [...new Set((data ?? []).map((w) => w.user_id).filter(Boolean))];
  
  let profilesMap: Record<string, { username: string; email?: string }> = {};
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    
    if (profiles) {
      profilesMap = profiles.reduce((acc, p) => {
        acc[p.id] = { username: p.username };
        return acc;
      }, {} as Record<string, { username: string; email?: string }>);
    }
  }

  const withdrawals: PixWithdrawalRecord[] = (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id ?? "",
    amount: Math.abs(row.amount),
    status: row.status as PixWithdrawalStatus,
    type: row.type,
    created_at: row.created_at,
    metadata: row.metadata as PixWithdrawalRecord["metadata"],
    user_profile: row.user_id ? profilesMap[row.user_id] : undefined,
  }));

  return {
    withdrawals,
    total: count ?? 0,
  };
};

export type ProcessAction = "approve" | "reject" | "complete";

export const processPixWithdrawal = async (
  requestId: string,
  action: ProcessAction,
  adminNotes?: string
): Promise<{ success: boolean; message: string }> => {
  const { data, error } = await supabase.functions.invoke("process-pix-payout", {
    body: {
      request_id: requestId,
      action,
      admin_notes: adminNotes,
    },
  });

  if (error) {
    throw new Error(error.message || "Erro ao processar saque");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido ao processar saque");
  }

  return {
    success: true,
    message: data.message || "Saque processado com sucesso",
  };
};
