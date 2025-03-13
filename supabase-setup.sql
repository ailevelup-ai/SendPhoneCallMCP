-- Function to create user_settings table
CREATE OR REPLACE FUNCTION create_user_settings_table()
RETURNS void AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_settings'
  ) THEN
    -- Create the table
    CREATE TABLE public.user_settings (
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
    CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

    -- Set up RLS (Row Level Security)
    ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for users to access only their own settings
    CREATE POLICY user_settings_policy ON public.user_settings
      FOR ALL
      USING (auth.uid() = user_id);
      
    RAISE NOTICE 'Created user_settings table';
  ELSE
    RAISE NOTICE 'user_settings table already exists';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create call_history table
CREATE OR REPLACE FUNCTION create_call_history_table()
RETURNS void AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'call_history'
  ) THEN
    -- Create the table
    CREATE TABLE public.call_history (
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
    CREATE INDEX idx_call_history_user_id ON public.call_history(user_id);
    
    -- Set up RLS (Row Level Security)
    ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for users to access only their own call history
    CREATE POLICY call_history_policy ON public.call_history
      FOR ALL
      USING (auth.uid() = user_id);
      
    RAISE NOTICE 'Created call_history table';
  ELSE
    RAISE NOTICE 'call_history table already exists';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create credits table
CREATE OR REPLACE FUNCTION create_credits_table()
RETURNS void AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'credits'
  ) THEN
    -- Create the table
    CREATE TABLE public.credits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      balance NUMERIC NOT NULL DEFAULT 0,
      total_added NUMERIC NOT NULL DEFAULT 0,
      total_used NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- Create index on user_id
    CREATE INDEX idx_credits_user_id ON public.credits(user_id);
    
    -- Create unique constraint on user_id
    ALTER TABLE public.credits ADD CONSTRAINT credits_user_id_unique UNIQUE (user_id);
    
    -- Set up RLS (Row Level Security)
    ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for users to access only their own credits
    CREATE POLICY credits_policy ON public.credits
      FOR ALL
      USING (auth.uid() = user_id);
      
    RAISE NOTICE 'Created credits table';
  ELSE
    RAISE NOTICE 'credits table already exists';
  END IF;
END;
$$ LANGUAGE plpgsql; 