-- Tabela para rastrear intenções de pagamento e permitir realtime updates
CREATE TABLE public.payment_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  external_ref TEXT NOT NULL UNIQUE,
  velana_transaction_id TEXT,
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('credits', 'registration', 'superchat', 'live_access')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'expired', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Índices para buscas frequentes
CREATE INDEX idx_payment_intents_user_id ON public.payment_intents(user_id);
CREATE INDEX idx_payment_intents_status ON public.payment_intents(status);
CREATE INDEX idx_payment_intents_external_ref ON public.payment_intents(external_ref);
CREATE INDEX idx_payment_intents_velana_transaction_id ON public.payment_intents(velana_transaction_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar RLS
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

-- Policies
-- Usuários podem ver suas próprias intenções de pagamento
CREATE POLICY "Users can view own payment intents"
  ON public.payment_intents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sistema pode gerenciar (insert/update) payment_intents
CREATE POLICY "System can manage payment intents"
  ON public.payment_intents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Bloquear acesso público direto
CREATE POLICY "Block public access to payment intents"
  ON public.payment_intents
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_intents;