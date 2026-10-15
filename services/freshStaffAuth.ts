import { supabase, isSupabaseConfigured } from './supabase';
import { freshClinicId } from './freshStart';
import { User, UserRole } from '../types';

export async function loginFreshStaff(
  email: string, password: string,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'A conexão segura com o banco novo ainda não foi configurada.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, error: 'Entre com o e-mail cadastrado do administrador ou da equipe.' };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (error || !data.user || !data.session) {
      return { ok: false, error: 'E-mail ou senha inválidos, ou acesso ainda não ativado.' };
    }
    const profile = await supabase.from('users')
      .select('id,username,name,role,doctor_id,clinicId,authUserId')
      .eq('authUserId', data.user.id).maybeSingle();
    const binding = await supabase.rpc('bind_current_user');
    const user = profile.data;
    if (profile.error || binding.error || !user
      || user.authUserId !== data.user.id || user.clinicId !== freshClinicId
      || binding.data !== user.clinicId
      || ![UserRole.ADMIN, UserRole.DOCTOR, UserRole.COLLABORATOR, UserRole.SECRETARY, UserRole.TREASURY].includes(user.role)) {
      await supabase.auth.signOut();
      return { ok: false, error: 'Esta conta não tem acesso autorizado à nova clínica.' };
    }
    return {
      ok: true,
      user: {
        id: user.id, username: user.username, name: user.name,
        role: user.role, clinicId: user.clinicId, authUserId: user.authUserId,
        doctorId: user.doctor_id || undefined, password: '',
      },
    };
  } catch {
    await supabase.auth.signOut().catch(() => {});
    return { ok: false, error: 'Não foi possível autenticar no banco novo. Tente novamente.' };
  }
}