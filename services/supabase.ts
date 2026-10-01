/// <reference types="vite/client" />
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
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        // Patient recovery tokens belong to the isolated patient Auth client.
        detectSessionInUrl: !new URLSearchParams(window.location.search).has('patient-auth'),
      },
    })
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
    rpc: () => Promise.resolve(result),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error }),
      signInWithPassword: () => Promise.resolve({ data: null, error }),
      signUp: () => Promise.resolve({ data: null, error }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ data: null, error }),
      resetPasswordForEmail: () => Promise.resolve({ data: null, error }),
    },
  };
}
