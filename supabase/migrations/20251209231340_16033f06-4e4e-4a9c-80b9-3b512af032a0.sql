-- =====================================================
-- WALLET TRANSACTIONS LEDGER TABLE
-- Registro completo de todas as movimentações de saldo
-- =====================================================

-- Criar tabela de transações de wallet (ledger)
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('creator', 'affiliate', 'credits')),
  wallet_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'hold', 'release', 'refund')),
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_wallet_txn_wallet ON public.wallet_transactions(wallet_type, wallet_id);
CREATE INDEX idx_wallet_txn_created ON public.wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_txn_reference ON public.wallet_transactions(reference_type, reference_id);

-- Habilitar RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Block public access to wallet transactions"
ON public.wallet_transactions FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "System can insert wallet transactions"
ON public.wallet_transactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own creator wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (
  wallet_type = 'creator' AND wallet_id = auth.uid()
);

CREATE POLICY "Users can view own affiliate wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (
  wallet_type = 'affiliate' AND wallet_id = auth.uid()
);

CREATE POLICY "Admins can view all wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- ADICIONAR COLUNAS FALTANTES EM payout_requests
-- =====================================================

-- Adicionar coluna para chave PIX
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Adicionar coluna para tipo de chave PIX
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS pix_key_type TEXT;

-- Adicionar coluna para ID da transação do PSP
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS psp_transaction_id TEXT;

-- Adicionar coluna para resposta do PSP
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS psp_response JSONB;

-- Adicionar coluna para razão de falha
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Adicionar coluna para origem do saque (creator/affiliate)
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'creator' CHECK (source_type IN ('creator', 'affiliate'));

-- Adicionar coluna para chave de idempotência
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_idempotency 
ON public.payout_requests(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Índice para busca por psp_transaction_id
CREATE INDEX IF NOT EXISTS idx_payout_psp_txn 
ON public.payout_requests(psp_transaction_id) 
WHERE psp_transaction_id IS NOT NULL;

-- Comentário na tabela
COMMENT ON TABLE public.wallet_transactions IS 'Ledger de todas as movimentações de saldo nas wallets (creator, affiliate, credits)';