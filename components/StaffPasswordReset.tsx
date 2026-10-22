import React, { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { freshClinicId } from '../services/freshStart';

export default function StaffPasswordReset({ onBack }: { onBack: () => void }) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('Validando o acesso para redefinir a senha...');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const verification = useRef<Promise<{valid:boolean;message?:string}> | null>(null);
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        if (!isSupabaseConfigured) throw new Error('A conexão segura não está configurada neste endereço. Abra o aplicativo publicado.');
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.slice(1));
        if(params.has('error')||hash.has('error'))throw new Error('O link expirou ou já foi utilizado. Solicite outro e abra somente o e-mail mais recente.');
        const token = params.get('token_hash');
        if (token) {
          const result = await supabase.auth.verifyOtp({
            token_hash: token, type: params.get('type') === 'invite' ? 'invite' : 'recovery',
          });
          if (result.error) throw new Error(result.error.status===429
            ?'Muitas tentativas de validação. Aguarde antes de solicitar outro link.'
            :['otp_expired','otp_disabled'].includes((result.error as {code?:string}).code||'')
              ?'O link expirou ou já foi utilizado. Solicite outro e abra somente o e-mail mais recente.'
              :'Não foi possível validar o link. Se acabou de recebê-lo, verifique sua conexão; caso contrário, solicite um novo link.');
        }
        // Native Supabase links initialize a session from the URL asynchronously.
        await supabase.auth.getSession();
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error('Não foi possível abrir a sessão de recuperação. Solicite um novo link e use o e-mail mais recente.');
        const profile = await supabase.from('users').select('role,clinicId,active')
          .eq('authUserId', auth.data.user.id).maybeSingle();
        if(profile.error)throw new Error('O link foi validado, mas não foi possível consultar a autorização da equipe. Verifique a conexão antes de tentar novamente.');
        if (profile.data?.clinicId !== freshClinicId || profile.data?.active!==true
          || !['admin', 'doctor', 'collaborator','secretaria','tesouraria'].includes(profile.data?.role)) throw new Error('Esta conta não possui acesso ativo à equipe desta clínica. Peça ao administrador para verificar o cadastro; pacientes devem usar a recuperação da área do paciente.');
        return {valid:true};
      } catch(error) {
        return {valid:false,message:error instanceof Error?error.message:'Não foi possível verificar este acesso. Tente novamente.'};
      } finally {
        // Do not leave one-time recovery credentials in the address bar.
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    // React StrictMode repeats effects; a one-time recovery token must be verified once.
    verification.current ??= verify();
    verification.current.then(result => {
      if (!active) return;
      setReady(result.valid);
      setMessage(result.valid
        ? 'Escolha uma nova senha exclusiva para o aplicativo.'
        : result.message||'Não foi possível verificar este acesso.');
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    if (password !== confirmation || password.length < 12 || password.length > 128) {
      setMessage('Use de 12 a 128 caracteres e confirme a mesma senha.'); return;
    }
    setBusy(true);
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw new Error();
      await supabase.auth.signOut();
      setPassword(''); setConfirmation(''); setReady(false); setDone(true);
      setMessage('Senha atualizada. Volte ao início e entre com seu e-mail e a nova senha.');
    } catch { setMessage('Não foi possível atualizar a senha. Tente novamente ou solicite outro link.'); }
    finally { setBusy(false); }
  }
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md space-y-5">
        <h1 className="text-2xl font-black text-slate-800">Nova senha da equipe</h1>
        <p role="status" className="text-sm text-slate-600">{message}</p>
        {ready && !done && <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold">Nova senha
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={password} onChange={event => setPassword(event.target.value)}
              className="mt-2 w-full border rounded-xl p-3" />
          </label>
          <label className="block text-sm font-bold">Confirmar senha
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={confirmation} onChange={event => setConfirmation(event.target.value)}
              className="mt-2 w-full border rounded-xl p-3" />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-600 text-white p-3 font-bold">
            {busy ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>}
        <button onClick={onBack} className="text-blue-700 font-bold">Voltar ao início</button>
      </section>
    </main>
  );
}