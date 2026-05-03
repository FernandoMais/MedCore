import React, { useState } from 'react';
import { Lock, ShieldCheck, Eye, AlertCircle } from 'lucide-react';

interface RestrictedHistoryProps {
  patientId: string;
  currentUserName: string;
  entries: string[];
  adminGeneratedPassword?: string;
}

const RestrictedHistory: React.FC<RestrictedHistoryProps> = ({ entries, adminGeneratedPassword }) => {
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminGeneratedPassword) {
      setError('Nenhuma senha sigilosa foi configurada para este paciente.');
      return;
    }
    if (password !== adminGeneratedPassword) {
      setError('Senha sigilosa inválida.');
      return;
    }
    setError('');
    setRevealed(true);
  };

  if (revealed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
          <ShieldCheck size={14} />
          <span>Histórico restrito liberado</span>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {entries.map((entry, index) => (
            <div key={index} className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-slate-700 whitespace-pre-wrap">
              {entry}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
        >
          Ocultar histórico restrito
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleUnlock} className="space-y-4 p-4 bg-slate-50 border border-slate-100 rounded-3xl">
      <div className="flex items-center space-x-2 text-slate-700 text-[10px] font-black uppercase tracking-widest">
        <Lock size={14} />
        <span>Histórico restrito</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        Este conteúdo só pode ser visualizado com a senha sigilosa gerada pelo administrador para este profissional.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-100 p-3 rounded-2xl flex items-center space-x-2 text-red-600">
          <AlertCircle size={16} />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha sigilosa"
          className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700"
        >
          <Eye size={16} />
        </button>
      </div>
    </form>
  );
};

export default RestrictedHistory;
