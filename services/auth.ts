import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';

const synthEmail = (username: string) => `${username.trim().toLowerCase()}@medcore.local`;

/**
 * Faz login validando contra a lista local de usuários (fonte de verdade dos perfis/papéis)
 * e, em seguida, estabelece uma sessão real no Supabase Auth.
 *
 * Se o usuário ainda não existe no Supabase Auth, faz signUp transparente na primeira vez.
 * Em ambiente sem Supabase configurado, apenas valida localmente.
 */
export async function loginUser(
  username: string,
  password: string,
  users: User[]
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const localUser = users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  if (!localUser) {
    return { ok: false, error: 'Usuário ou senha inválidos.' };
  }

  if (!isSupabaseConfigured) {
    return { ok: true, user: localUser };
  }

  const email = synthEmail(localUser.username);

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Provavelmente o usuário ainda não existe no Auth — auto-cadastra e tenta novamente.
      const signUpRes = await supabase.auth.signUp({ email, password });
      if (signUpRes.error && !/already registered|already exists/i.test(signUpRes.error.message || '')) {
        console.warn('Supabase signUp falhou:', signUpRes.error.message);
      }
      const retry = await supabase.auth.signInWithPassword({ email, password });
      if (retry.error) {
        // Senha local não bate com a do Auth (provavelmente trocada offline). Mantemos sessão local válida.
        console.warn('Supabase signIn pós-signUp falhou:', retry.error.message);
      }
    }
  } catch (e) {
    console.warn('Erro ao tentar autenticar no Supabase Auth:', e);
  }

  return { ok: true, user: localUser };
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured) {
    try { await supabase.auth.signOut(); } catch {}
  }
}

/**
 * Cria conta no Supabase Auth para um novo usuário criado pelo admin.
 * Falha silenciosa: o usuário continua existindo localmente mesmo se o signUp não der certo
 * (ex.: e-mail synthEmail já cadastrado em outro projeto).
 */
export async function provisionAuthAccount(username: string, password: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const email = synthEmail(username);
    const res = await supabase.auth.signUp({ email, password });
    if (res.error && !/already registered|already exists/i.test(res.error.message || '')) {
      console.warn('Não foi possível criar conta no Supabase Auth:', res.error.message);
    }
  } catch (e) {
    console.warn('Erro ao provisionar conta no Supabase Auth:', e);
  }
}

/**
 * Permite ao próprio usuário logado trocar a sua senha no Supabase Auth.
 * Para reset de senha de OUTROS usuários, é necessário service_role (Edge Function),
 * portanto o admin altera apenas a senha local — o usuário deverá usar a função
 * "esqueci minha senha" do Supabase para sincronizar a senha do Auth.
 */
export async function updateOwnPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: true };
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro desconhecido' };
  }
}
