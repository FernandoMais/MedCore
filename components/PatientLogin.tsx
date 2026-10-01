import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { Patient } from '../types';
import {
  isValidCpf,
  loginPatient,
  normalizeCpf,
  requestPatientRecovery
} from '../services/patientAuth';

interface PatientLoginProps {
  onLogin: (patient: Patient) => Promise<void>;
  onBack: () => void;
}

type Screen = 'login' | 'recover' | 'recover-done';

const formatCpf = (value: string) => {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const PatientLogin: React.FC<PatientLoginProps> = ({ onLogin, onBack }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidCpf(normalizeCpf(cpf))) {
      setError('Informe um CPF brasileiro válido.');
      return;
    }

    setLoading(true);
    try {
      const patient = await loginPatient(normalizeCpf(cpf), password);
      await onLogin(patient);
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'Não foi possível entrar. Confira seu CPF e senha e tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidCpf(normalizeCpf(cpf))) {
      setError('Informe um CPF brasileiro válido.');
      return;
    }

    setLoading(true);
    try {
      await requestPatientRecovery(normalizeCpf(cpf));
      setScreen('recover-done');
    } catch {
      setError('Não foi possível enviar a solicitação agora. Tente novamente em alguns instantes.');
    } finally {
      setLoading(false);
    }
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

        <div className="bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl border border-slate-100">
          {screen === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center mb-2">
                <h2 className="font-black text-slate-800 text-xl">Entrar</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Acesse com seu CPF e senha cadastrados</p>
              </div>
              {error && <ErrorMessage message={error} />}
              <div className="space-y-2">
                <label htmlFor="patient-login-cpf" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">CPF</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="patient-login-cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    value={cpf}
                    onChange={event => setCpf(formatCpf(event.target.value))}
                    className={inputCls}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    aria-describedby={error ? 'patient-login-error' : undefined}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-2">
                  <label htmlFor="patient-login-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
                  <button
                    type="button"
                    onClick={() => { setScreen('recover'); setError(''); }}
                    className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="patient-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className={inputCls}
                    placeholder="Sua senha"
                    aria-describedby={error ? 'patient-login-error' : undefined}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait">
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>{loading ? 'Verificando...' : 'Acessar Minha Área'}</span>
              </button>
            </form>
          )}

          {screen === 'recover' && (
            <form onSubmit={handleRecovery} className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center space-x-3 mb-2">
                <button
                  type="button"
                  onClick={() => { setScreen('login'); setError(''); }}
                  aria-label="Voltar ao login"
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="font-black text-slate-800 text-base">Recuperar senha</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informe seu CPF cadastrado</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Se houver uma conta associada ao CPF informado, enviaremos um link de recuperação para o e-mail cadastrado.
              </p>
              {error && <ErrorMessage message={error} />}
              <div className="space-y-2">
                <label htmlFor="patient-recovery-cpf" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">CPF</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="patient-recovery-cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    value={cpf}
                    onChange={event => setCpf(formatCpf(event.target.value))}
                    className={inputCls}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait">
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</span>
              </button>
            </form>
          )}

          {screen === 'recover-done' && (
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h2 className="font-black text-slate-800 text-lg">Solicitação enviada</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Se houver uma conta associada ao CPF informado, você receberá um e-mail com as instruções para redefinir sua senha.
              </p>
              <button
                type="button"
                onClick={() => { setScreen('login'); setError(''); }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest mt-6 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Voltar à página inicial</span>
        </button>
      </div>
    </div>
  );
};

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div id="patient-login-error" role="alert" className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
    <AlertCircle size={18} className="shrink-0" />
    <p className="text-xs font-bold">{message}</p>
  </div>
);

export default PatientLogin;