-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  default_voice TEXT,
  default_model TEXT,
  default_temperature NUMERIC CHECK (default_temperature >= 0 AND default_temperature <= 1),
  default_from_number TEXT,
  default_voicemail_action TEXT CHECK (default_voicemail_action IN ('leave_message', 'hang_up', 'retry_later')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own settings
DROP POLICY IF EXISTS user_settings_policy ON public.user_settings;
CREATE POLICY user_settings_policy ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id);

-- Create call_history table
CREATE TABLE IF NOT EXISTS public.call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  voice_id TEXT,
  model_id TEXT,
  temperature NUMERIC,
  status TEXT,
  duration INTEGER,
  cost NUMERIC,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON public.call_history(user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own call history
DROP POLICY IF EXISTS call_history_policy ON public.call_history;
CREATE POLICY call_history_policy ON public.call_history
  FOR ALL
  USING (auth.uid() = user_id);

-- Create credits table
CREATE TABLE IF NOT EXISTS public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_added NUMERIC NOT NULL DEFAULT 0,
  total_used NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON public.credits(user_id);

-- Create unique constraint on user_id
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_user_id_unique;
ALTER TABLE public.credits ADD CONSTRAINT credits_user_id_unique UNIQUE (user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own credits
DROP POLICY IF EXISTS credits_policy ON public.credits;
CREATE POLICY credits_policy ON public.credits
  FOR ALL
  USING (auth.uid() = user_id);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_id TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add', 'use', 'refund')),
  related_call_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own credit transactions
DROP POLICY IF EXISTS credit_transactions_policy ON public.credit_transactions;
CREATE POLICY credit_transactions_policy ON public.credit_transactions
  FOR ALL
  USING (auth.uid() = user_id);

-- Create function to add credits to a user's account
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Credit purchase',
  p_payment_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_existing_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Check if user has an existing credits record
  SELECT id INTO v_existing_id FROM public.credits WHERE user_id = p_user_id LIMIT 1;
  
  -- If user has no credits record, create one
  IF v_existing_id IS NULL THEN
    INSERT INTO public.credits (
      user_id,
      balance,
      total_added,
      total_used
    ) VALUES (
      p_user_id,
      p_amount,
      p_amount,
      0
    ) RETURNING id INTO v_existing_id;
  ELSE
    -- Update existing credits record
    UPDATE public.credits
    SET
      balance = balance + p_amount,
      total_added = total_added + p_amount,
      updated_at = now()
    WHERE id = v_existing_id;
  END IF;
  
  -- Record the transaction
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    description,
    payment_id,
    transaction_type
  ) VALUES (
    p_user_id,
    p_amount,
    p_description,
    p_payment_id,
    'add'
  ) RETURNING id INTO v_transaction_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to add credits: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create a dev user for testing
INSERT INTO public.users (id, email, role, api_key, created_at, updated_at)
VALUES 
  ('dev-user-id', 'dev@example.com', 'admin', 'dev-api-key', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Create initial settings for dev user
INSERT INTO public.user_settings (user_id, default_voice, default_model, default_temperature, default_from_number, default_voicemail_action)
VALUES 
  ('dev-user-id', 'alloy', 'gpt-4', 0.7, '+15551234567', 'leave_message')
ON CONFLICT (user_id) DO NOTHING;

-- Create initial credits for dev user
INSERT INTO public.credits (user_id, balance, total_added, total_used)
VALUES 
  ('dev-user-id', 100, 100, 0)
ON CONFLICT (user_id) DO NOTHING; 