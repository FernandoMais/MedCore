import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { Patient } from '../types';

interface PatientLoginProps {
  patients: Patient[];
  onLogin: (patient: Patient) => void;
  onSetPassword: (patientId: string, password: string) => void;
  onBack: () => void;
}

type Screen = 'login' | 'first-access' | 'forgot' | 'forgot-done';

const PatientLogin: React.FC<PatientLoginProps> = ({ patients, onLogin, onSetPassword, onBack }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);

  const findPatientByEmail = (e: string) =>
    patients.find(p => p.email?.toLowerCase().trim() === e.toLowerCase().trim()) || null;

  const handleLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));

    const patient = findPatientByEmail(email);
    if (!patient) {
      setError('Nenhum paciente encontrado com este e-mail. Entre em contato com a clínica.');
      setLoading(false);
      return;
    }

    if (!patient.patientPasswordSet) {
      setFoundPatient(patient);
      setScreen('first-access');
      setLoading(false);
      return;
    }

    if (patient.patientPassword !== password) {
      setError('Senha incorreta. Tente novamente ou clique em "Esqueci minha senha".');
      setLoading(false);
      return;
    }

    setLoading(false);
    onLogin(patient);
  };

  const handleFirstAccess = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onSetPassword(foundPatient!.id, newPassword);
    setLoading(false);
    onLogin({ ...foundPatient!, patientPassword: newPassword, patientPasswordSet: true });
  };

  const handleForgot = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    const patient = findPatientByEmail(email);
    if (!patient) {
      setError('Nenhum paciente encontrado com este e-mail.');
      return;
    }
    setScreen('forgot-done');
  };

  const inputCls = 'w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-blue-200 mx-auto mb-6">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Área do Paciente</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">MedCore Pro — Acesso Seguro</p>
        </div>

        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100">

          {screen === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center mb-2">
                <h2 className="font-black text-slate-800 text-xl">Entrar</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Use o e-mail cadastrado na clínica</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="seu@email.com" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
                  <button type="button" onClick={() => { setScreen('forgot'); setError(''); }} className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest">
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60">
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>{loading ? 'Verificando...' : 'Acessar Minha Área'}</span>
              </button>
              <button type="button" onClick={onBack} className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest mt-2 transition-colors">
                <ArrowLeft size={14} />
                <span>Voltar</span>
              </button>
            </form>
          )}

          {screen === 'first-access' && foundPatient && (
            <form onSubmit={handleFirstAccess} className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
                  <KeyRound size={24} className="text-emerald-500" />
                </div>
                <h2 className="font-black text-slate-800 text-lg">Primeiro Acesso</h2>
                <p className="text-xs text-slate-500 font-medium">Olá, <span className="font-black text-slate-700">{foundPatient.name.split(' ')[0]}</span>! Crie sua senha de acesso ao portal.</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder="Mínimo 6 caracteres" required />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} placeholder="Repita a senha" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60">
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>{loading ? 'Salvando...' : 'Criar Senha e Entrar'}</span>
              </button>
            </form>
          )}

          {screen === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center space-x-3 mb-2">
                <button type="button" onClick={() => { setScreen('login'); setError(''); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="font-black text-slate-800 text-base">Redefinir Senha</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informe seu e-mail cadastrado</p>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="seu@email.com" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                Solicitar Redefinição
              </button>
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Sua senha será redefinida pelo administrador da clínica. Você pode entrar em contato diretamente.
              </p>
            </form>
          )}

          {screen === 'forgot-done' && (
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h2 className="font-black text-slate-800 text-lg">Solicitação Enviada</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Entre em contato com a clínica informando seu e-mail. O administrador irá redefinir sua senha e você receberá a nova para acessar o portal.
              </p>
              <button onClick={() => { setScreen('login'); setError(''); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95">
                Voltar ao Login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PatientLogin;
