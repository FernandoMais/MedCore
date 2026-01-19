
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dtpvxcrahydnxmgrkyqr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dE-KMoGhxoALcMzsIOVtBA_JCqWuowB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
