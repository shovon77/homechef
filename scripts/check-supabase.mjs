import { createClient } from '@supabase/supabase-js';

// ⬇️ Paste your real values:
const SUPABASE_URL = 'https://hjdbfodukvkqkvmwhafc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZGJmb2R1a3ZrcWt2bXdoYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDI0NDIsImV4cCI6MjA3NzUxODQ0Mn0.fcYXBcmjF9NBYWrv_yTUgtgkm-NiM1Ax3yeY9AL_zME';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const run = async () => {
  try {
    const { data, error, count } = await supabase
      .from('dishes')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log('✅ Supabase reachable. dishes row count (approx):', count ?? 'unknown');
  } catch (e) {
    console.error('❌ Supabase test failed:', e.message);
  }
};

run();
