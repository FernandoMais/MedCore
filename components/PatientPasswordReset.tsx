import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import {
  getPatientRecoverySession,
  isValidPatientPassword,
  updatePatientPassword
} from '../services/patientAuth';

interface PatientPasswordResetProps {
  onBack: () => void;
}

type Status = 'checking' | 'ready' | 'invalid' | 'done';

const PatientPasswordReset: React.FC<PatientPasswordResetProps> = ({ onBack }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getPatientRecoverySession()
      .then(hasSession => {
        if (active) setStatus(hasSession ? 'ready' : 'invalid');
      })
      .catch(() => {
        if (active) setStatus('invalid');
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidPatientPassword(password)) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await updatePatientPassword(password);
      setStatus('done');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : '';
      if (/session|token|link|expired|expirad|inv[aá]lid/i.test(message)) {
        setStatus('invalid');
      } else {
        setError(message || 'Não foi possível redefinir a senha. O link pode ter expirado; solicite um novo link de recuperação.');
      }
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
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Redefinir senha</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">MedCore Pro — Área do Paciente</p>
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl border border-slate-100">
          {status === 'checking' && (
            <div role="status" className="py-6 text-center text-slate-500">
              <Loader2 size={28} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-sm font-bold">Verificando o link de recuperação...</p>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center mb-2">
                <h2 className="font-black text-slate-800 text-xl">Crie uma nova senha</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Use pelo menos 8 caracteres</p>
              </div>
              {error && <ErrorMessage message={error} />}
              <div className="space-y-2">
                <label htmlFor="patient-reset-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="patient-reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className={inputCls}
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                    minLength={8}
                    aria-describedby={error ? 'patient-reset-error' : undefined}
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
              <div className="space-y-2">
                <label htmlFor="patient-reset-confirm" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Confirmar nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="patient-reset-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    className={inputCls}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    minLength={8}
                    aria-describedby={error ? 'patient-reset-error' : undefined}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait">
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>{loading ? 'Salvando...' : 'Salvar nova senha'}</span>
              </button>
            </form>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h2 className="font-black text-slate-800 text-lg">Link inválido ou expirado</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Este link de recuperação não é válido ou já expirou. Solicite um novo link pela tela de acesso do paciente.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95"
              >
                Voltar à página inicial
              </button>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h2 className="font-black text-slate-800 text-lg">Senha redefinida</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Sua senha foi atualizada. Volte à página inicial para acessar a área do paciente com seu CPF e a nova senha.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95"
              >
                Voltar à página inicial
              </button>
            </div>
          )}
        </div>

        {(status === 'checking' || status === 'ready') && (
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest mt-6 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Voltar à página inicial</span>
          </button>
        )}
      </div>
    </div>
  );
};

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div id="patient-reset-error" role="alert" className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
    <AlertCircle size={18} className="shrink-0" />
    <p className="text-xs font-bold">{message}</p>
  </div>
);

export default PatientPasswordReset;