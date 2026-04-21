import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos Secrets para habilitar a sincronização em nuvem.'
  );
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : (createStub() as unknown as SupabaseClient);

function createStub() {
  const error = { message: 'Supabase não configurado', code: 'SUPABASE_NOT_CONFIGURED' };
  const result = { data: null, error };
  const builder: any = {
    select: () => Promise.resolve(result),
    insert: () => Promise.resolve(result),
    upsert: () => Promise.resolve(result),
    update: () => Promise.resolve(result),
    delete: () => Promise.resolve(result),
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve: any) => resolve(result),
  };
  return {
    from: () => builder,
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error }),
    },
  };
}
