require('dotenv').config();
const { supabaseAdmin } = require('./config/supabase');

async function enableRls() {
  try {
    console.log('Enabling Row Level Security on all tables...');
    
    // SQL to enable RLS on all tables
    const enableRlsSql = `
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
    `;
    
    // Execute SQL to enable RLS
    const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', { sql: enableRlsSql });
    if (rlsError) {
      console.error('Error enabling RLS:', rlsError);
      throw rlsError;
    }
    
    console.log('RLS enabled on all tables');
    
    // SQL to create policies
    const createPoliciesSql = `
      -- Users table policies
      CREATE POLICY "Users can view own data" ON public.users
        FOR SELECT USING (auth.uid() = id);
        
      CREATE POLICY "Users can update own data" ON public.users
        FOR UPDATE USING (auth.uid() = id);
      
      -- Calls table policies
      CREATE POLICY "Users can view own calls" ON public.calls
        FOR SELECT USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can insert own calls" ON public.calls
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      -- Credits table policies
      CREATE POLICY "Users can view own credits" ON public.credits
        FOR SELECT USING (auth.uid() = user_id);
      
      -- Audit logs policies
      CREATE POLICY "Users can view own audit logs" ON public.audit_logs
        FOR SELECT USING (auth.uid() = user_id);
      
      -- Payments table policies
      CREATE POLICY "Users can view own payments" ON public.payments
        FOR SELECT USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can insert own payments" ON public.payments
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      -- API usage policies
      CREATE POLICY "Users can view own API usage" ON public.api_usage
        FOR SELECT USING (auth.uid() = user_id);
      
      -- Voices table (assuming public read, admin write)
      CREATE POLICY "Public can view voices" ON public.voices
        FOR SELECT USING (true);
    `;
    
    // Execute SQL to create policies
    const { error: policiesError } = await supabaseAdmin.rpc('exec_sql', { sql: createPoliciesSql });
    if (policiesError) {
      console.error('Error creating policies:', policiesError);
      throw policiesError;
    }
    
    console.log('Security policies created successfully');
    console.log('Database security setup complete!');
    
  } catch (error) {
    console.error('Error setting up database security:', error);
  } finally {
    process.exit();
  }
}

enableRls(); 