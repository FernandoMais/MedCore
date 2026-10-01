
import React, { useState } from 'react';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { User } from '../types';
import { loginUser } from '../services/auth';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { freshStartEnabled } from '../services/freshStart';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Esqueci minha senha
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginUser(username, password, users);
      if (result.ok) {
        onLogin(result.user);
      } else {
        setError('error' in result ? result.error : 'Falha inesperada ao entrar.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha inesperada ao entrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (freshStartEnabled) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotUsername.trim())) {
        setForgotMessage('Informe seu e-mail cadastrado.');
        setForgotStatus('error');
        return;
      }
      setForgotStatus('loading');
      try {
        if (!isSupabaseConfigured) throw new Error();
        const { error } = await supabase.auth.resetPasswordForEmail(forgotUsername.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}${window.location.pathname}?staff-auth=recovery`,
        });
        if (error) throw new Error();
        setForgotStatus('sent');
        setForgotMessage('Se este e-mail estiver cadastrado e o envio estiver configurado, você receberá um link de redefinição.');
      } catch {
        setForgotStatus('error');
        setForgotMessage('Não foi possível solicitar a redefinição. Confira a conexão e a configuração de e-mail.');
      }
      return;
    }
    if (!forgotUsername.trim()) {
      setForgotMessage('Informe seu nome de usuário.');
      setForgotStatus('error');
      return;
    }
    // Encontra usuário local para pegar e-mail real, se disponível
    const localUser = users.find(u => u.username.toLowerCase() === forgotUsername.trim().toLowerCase());
    if (!localUser) {
      setForgotMessage('Usuário não encontrado no sistema.');
      setForgotStatus('error');
      return;
    }
    setForgotStatus('loading');
    try {
      const synthEmail = `${localUser.username.toLowerCase()}@medcore.local`;
      if (isSupabaseConfigured) {
        const { error } = await (supabase.auth as any).resetPasswordForEmail(synthEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
      }
      setForgotStatus('sent');
      setForgotMessage(
        isSupabaseConfigured
          ? 'Link de redefinição enviado! Verifique o e-mail cadastrado no Supabase ou peça ao administrador para redefinir sua senha no painel Corpo Clínico.'
          : 'Supabase não configurado. Peça ao administrador para redefinir sua senha no painel Corpo Clínico.'
      );
    } catch (err: any) {
      setForgotStatus('error');
      setForgotMessage(err?.message || 'Erro ao solicitar redefinição.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-blue-200 mx-auto mb-6 animate-pulse">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">MedCore Pro</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Plataforma de Gestão Clínica</p>
        </div>

        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100">
          {!showForgot ? (
            /* ---- FORMULÁRIO DE LOGIN ---- */
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600 animate-in slide-in-from-top-2">
                    <AlertCircle size={20} />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{freshStartEnabled ? 'E-mail de Acesso' : 'Usuário de Acesso'}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                      type={freshStartEnabled ? 'email' : 'text'}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all"
                      placeholder={freshStartEnabled ? 'Seu e-mail cadastrado' : 'Seu nome de usuário'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha Individual</label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotStatus('idle'); setForgotMessage(''); }}
                      className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{loading ? 'Autenticando...' : 'Acessar Plataforma'}</span>
                </button>
              </form>
              <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Sistema Restrito a Profissionais Credenciados.<br/>
                  Acesso monitorado conforme diretrizes LGPD.
                </p>
              </div>
            </>
          ) : (
            /* ---- FORMULÁRIO ESQUECI MINHA SENHA ---- */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center space-x-3 mb-2">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="font-black text-slate-800 text-base">Redefinir Senha</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{freshStartEnabled ? 'Informe seu e-mail cadastrado' : 'Informe seu nome de usuário'}</p>
                </div>
              </div>

              {forgotStatus === 'sent' ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">{forgotMessage}</p>
                  <button
                    onClick={() => setShowForgot(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  {forgotStatus === 'error' && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                      <AlertCircle size={18} />
                      <p className="text-xs font-bold">{forgotMessage}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome de Usuário</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input
                        type="text"
                        value={forgotUsername}
                        onChange={e => setForgotUsername(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all"
                        placeholder="Ex: dr.silva"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotStatus === 'loading'}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
                  >
                    {forgotStatus === 'loading' && <Loader2 size={16} className="animate-spin" />}
                    <span>{forgotStatus === 'loading' ? 'Enviando...' : 'Solicitar Redefinição'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Um link de redefinição será enviado ao e-mail vinculado à conta.<br/>
                    Caso não receba, solicite ao administrador do sistema.
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
