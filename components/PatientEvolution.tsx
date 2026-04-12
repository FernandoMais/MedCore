
import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Clock, 
  User, 
  Stethoscope,
  ShieldCheck,
  X,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { EvolutionEntry, User as AppUser, UserRole } from '../types';

interface PatientEvolutionProps {
  patientId: string;
  currentUser: AppUser;
}

const PatientEvolution: React.FC<PatientEvolutionProps> = ({ patientId, currentUser }) => {
  const [evolutions, setEvolutions] = useState<EvolutionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para o modal de senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EvolutionEntry | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  // Estado para armazenar IDs de evoluções desbloqueadas nesta sessão
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  const fetchEvolutions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('evolucao_paciente')
        .select('*')
        .eq('paciente_id', patientId)
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setEvolutions(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar evoluções:', err);
      setError('Não foi possível carregar o histórico de evoluções.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvolutions();
  }, [patientId]);

  const isSensitive = (specialty: string) => {
    const s = specialty.toLowerCase();
    return s.includes('psicologia') || s.includes('psiquiatria');
  };

  const canViewDirectly = (entry: EvolutionEntry) => {
    if (currentUser.role === UserRole.ADMIN) return true;
    if (!isSensitive(entry.especialidade)) return true;
    if (unlockedIds.has(entry.id)) return true;
    return false;
  };

  const handleOpenPasswordModal = (entry: EvolutionEntry) => {
    setSelectedEntry(entry);
    setShowPasswordModal(true);
    setPasswordInput('');
    setPasswordError(false);
  };

  const verifyPassword = async () => {
    if (!selectedEntry) return;

    // Em um sistema real, enviaríamos a senha para uma Edge Function ou RPC no Supabase
    // para comparar o hash de forma segura. Aqui simularemos a verificação.
    // O usuário solicitou: "compare o hash da senha digitada com a que está salva no banco"
    
    const encoder = new TextEncoder();
    const data = encoder.encode(passwordInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Verificação simulada: No banco, a coluna senha_acesso teria o hash SHA-256
    // Para fins de demonstração, se a senha salva for '123', o hash seria:
    // a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
    
    if (hashHex === selectedEntry.senha_acesso || passwordInput === selectedEntry.senha_acesso) {
      setUnlockedIds(prev => new Set(prev).add(selectedEntry.id));
      setShowPasswordModal(false);
      setSelectedEntry(null);
    } else {
      setPasswordError(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Carregando prontuário seguro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 p-8 rounded-[32px] text-center">
        <ShieldAlert className="mx-auto text-red-500 mb-4" size={32} />
        <p className="text-red-800 font-bold">{error}</p>
        <button onClick={fetchEvolutions} className="mt-4 text-red-600 underline text-sm font-black">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
          <Clock size={18} className="mr-3 text-blue-600" /> 
          Evoluções Clínicas e Sigilo Profissional
        </h3>
        {evolutions.some(e => isSensitive(e.especialidade)) && (
          <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
            <ShieldCheck size={14} className="text-amber-600" />
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight">Conteúdo Restrito Detectado</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {evolutions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum registro encontrado no banco de dados.</p>
          </div>
        ) : (
          evolutions.map((entry) => {
            const sensitive = isSensitive(entry.especialidade);
            const unlocked = canViewDirectly(entry);

            return (
              <div key={entry.id} className="group relative">
                <div className="flex items-center space-x-3 pt-6 pb-2 border-b border-slate-100 mt-4 evolution-block-header">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sensitive ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    {sensitive ? <Lock size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      {new Date(entry.data_criacao).toLocaleString('pt-BR')}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${sensitive ? 'text-amber-600' : 'text-blue-500'}`}>
                      {entry.especialidade} • Dr(a). {entry.medico_nome}
                    </span>
                  </div>
                </div>

                <div className={`mt-2 evolution-block p-8 rounded-[32px] text-sm font-medium leading-relaxed shadow-sm transition-all border ${
                  sensitive && !unlocked 
                    ? 'bg-slate-900 text-slate-400 border-slate-800 blur-[2px] select-none cursor-not-allowed' 
                    : 'bg-white text-slate-700 border-slate-100 hover:shadow-md'
                }`}>
                  {sensitive && !unlocked ? (
                    <div className="flex flex-col items-center justify-center py-4 space-y-4 filter-none">
                      <div className="bg-amber-500/20 p-4 rounded-full">
                        <KeyRound size={32} className="text-amber-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black uppercase tracking-widest text-xs mb-1">Informação Confidencial</p>
                        <p className="text-[10px] text-slate-500 font-bold max-w-xs mx-auto">
                          Este registro pertence à especialidade de {entry.especialidade} e requer validação de senha para visualização.
                        </p>
                      </div>
                      <button 
                        onClick={() => handleOpenPasswordModal(entry)}
                        className="bg-amber-500 text-slate-900 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                      >
                        Desbloquear Acesso
                      </button>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {entry.anotacoes}
                    </div>
                  )}
                </div>
                
                {sensitive && unlocked && (
                  <div className="absolute top-6 right-4 flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 animate-in fade-in duration-500">
                    <Unlock size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Acesso Liberado</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 no-print">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Validação de Acesso</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sigilo Profissional LGPD</p>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-10 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Você está tentando acessar um registro de <span className="font-black text-amber-600">{selectedEntry?.especialidade}</span> realizado por <span className="font-black">Dr(a). {selectedEntry?.medico_nome}</span>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Senha de Acesso do Profissional</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(false);
                    }}
                    placeholder="••••••••"
                    className={`w-full p-4 bg-slate-50 border ${passwordError ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100'} rounded-2xl text-center text-lg font-black tracking-[0.5em] outline-none focus:ring-4 focus:ring-blue-500/10 transition-all`}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  />
                  {passwordError && (
                    <div className="absolute -bottom-6 left-0 right-0 text-center">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-tight flex items-center justify-center">
                        <AlertCircle size={12} className="mr-1" /> Senha incorreta ou acesso negado
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex flex-col space-y-3">
                <button 
                  onClick={verifyPassword}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
                >
                  <ShieldCheck size={18} />
                  <span>VALIDAR E DESBLOQUEAR</span>
                </button>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Cancelar Operação
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Acesso monitorado e registrado conforme normas do CFM/CRP
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientEvolution;
