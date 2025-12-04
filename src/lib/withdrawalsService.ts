import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export type WithdrawalRecord = {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  created_at: string;
  processed_at?: string | null;
  creator_id: string;
  creator_profile?: {
    username?: string | null;
    email?: string | null;
  };
};

type FetchParams = {
  status?: WithdrawalStatus | "all";
  page?: number;
  pageSize?: number;
};

type FetchResult = {
  withdrawals: WithdrawalRecord[];
  total: number;
};

type WithdrawalRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at?: string | null;
  creator_id: string;
  creators?: {
    profiles?: { username?: string | null } | null;
    user_id?: string;
  } | null;
};

const mapWithdrawalRow = (row: WithdrawalRow): WithdrawalRecord => {
  const creatorProfiles = row.creators?.profiles;
  const profileDetails = creatorProfiles ?? null;

  return {
    id: row.id,
    amount: row.amount,
    status: row.status as WithdrawalStatus,
    created_at: row.created_at,
    processed_at: row.processed_at,
    creator_id: row.creator_id,
    creator_profile: profileDetails
      ? {
          username: profileDetails.username,
        }
      : undefined,
  };
};

export const fetchWithdrawals = async ({
  status = "pending",
  page = 1,
  pageSize = 10,
}: FetchParams): Promise<FetchResult> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("withdrawals")
    .select(
      `
        id,
        amount,
        status,
        created_at,
        processed_at,
        creator_id,
        creators:creator_id (
          user_id,
          profiles:user_id (
            username
          )
        )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    withdrawals: (data ?? []).map((row) => mapWithdrawalRow(row as unknown as WithdrawalRow)),
    total: count ?? 0,
  };
};

export const updateWithdrawalStatus = async (
  withdrawalId: string,
  status: Exclude<WithdrawalStatus, "paid">,
) => {
  const payload: Record<string, unknown> = {
    status,
  };

  if (status !== "pending") {
    payload.processed_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("withdrawals")
    .update(payload)
    .eq("id", withdrawalId)
    .select("id, status, processed_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
