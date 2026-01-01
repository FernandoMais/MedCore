
import React, { useState, useEffect } from 'react';
import { 
  Save, 
  ChevronLeft, 
  Stethoscope, 
  FileEdit, 
  ClipboardList, 
  Pill, 
  FlaskConical, 
  Sparkles,
  CheckCircle,
  Clock,
  ExternalLink,
  MessageSquare,
  Plus,
  AlertTriangle,
  ShieldAlert,
  FolderOpen,
  FileIcon,
  Download,
  Eye,
  X,
  FileText,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Appointment, Patient, Prescription, Doctor, MedicalFile } from '../types';
import { getICDRecommendation, generatePrescriptionDraft } from '../services/gemini';

interface ConsultationRoomProps {
  appointmentId: string;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  onFinish: () => void;
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ 
  appointmentId, 
  appointments, 
  patients, 
  doctors,
  onFinish 
}) => {
  const appointment = appointments.find(a => a.id === appointmentId);
  const patient = patients.find(p => p.id === appointment?.patientId);
  const doctor = doctors.find(d => d.id === appointment?.doctorId);

  const [activeTab, setActiveTab] = useState<'anamnesis' | 'pep' | 'prescriptions' | 'exams' | 'files'>('pep');
  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [viewingFile, setViewingFile] = useState<MedicalFile | null>(null);
  const [lastSaved, setLastSaved] = useState<string>('');

  // Auto-save rascunho da consulta
  useEffect(() => {
    const draft = { complaint, conduct, diagnosis, prescriptions, appointmentId };
    const timer = setTimeout(() => {
      localStorage.setItem(`medcore_consult_draft_${appointmentId}`, JSON.stringify(draft));
      setLastSaved(new Date().toLocaleTimeString());
    }, 2000);
    return () => clearTimeout(timer);
  }, [complaint, conduct, diagnosis, prescriptions, appointmentId]);

  // Carregar rascunho se existir
  useEffect(() => {
    const draft = localStorage.getItem(`medcore_consult_draft_${appointmentId}`);
    if (draft) {
      const data = JSON.parse(draft);
      setComplaint(data.complaint || '');
      setConduct(data.conduct || '');
      setDiagnosis(data.diagnosis || '');
      setPrescriptions(data.prescriptions || []);
    }
  }, [appointmentId]);

  const handleAiAssist = async () => {
    if (!complaint) return;
    setIsAiLoading(true);
    const result = await getICDRecommendation(complaint);
    setAiSuggestions(result || '');
    setIsAiLoading(false);
  };

  const handlePrescriptionDraft = async () => {
    if (!diagnosis) return;
    setIsAiLoading(true);
    const draft = await generatePrescriptionDraft(diagnosis);
    setPrescriptions(draft);
    setIsAiLoading(false);
  };

  const handleCFMRedirect = () => {
    window.open('https://prescricao.cfm.org.br/login', '_blank');
  };

  const finalizeConsultation = () => {
    // Aqui deveríamos persistir os dados no banco principal (db.patients)
    // Para simplificar, assumimos que o fluxo termina e limpa o draft
    localStorage.removeItem(`medcore_consult_draft_${appointmentId}`);
    alert('Atendimento finalizado e dados salvos no histórico do paciente.');
    onFinish();
  };

  if (!patient || !appointment) return <div className="p-8 text-center text-slate-500">Dados do atendimento não encontrados.</div>;

  const criticalAllergies = patient.allergies || [];
  const criticalConditions = patient.preExistingConditions || [];
  const hasSafetyAlerts = criticalAllergies.length > 0 || criticalConditions.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in zoom-in-95 duration-500 pb-20">
      
      {hasSafetyAlerts && showWarning && (
        <div className="bg-red-600 text-white p-5 rounded-[32px] shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 border-b-4 border-red-800/50">
          <div className="flex items-center space-x-5">
            <div className="bg-white text-red-600 p-3 rounded-2xl shadow-lg animate-pulse">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">ALERTA DE SEGURANÇA CRÍTICO</h3>
              <div className="flex flex-col mt-1">
                {criticalAllergies.length > 0 && (
                   <p className="text-red-50 text-sm font-bold">
                     <span className="underline decoration-white/30 decoration-2">ALERGIAS:</span> {criticalAllergies.join(', ')}
                   </p>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setShowWarning(false)} className="px-6 py-2 bg-red-800/50 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase transition-all border border-red-400/30">CIENTE</button>
        </div>
      )}

      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20 no-print">
        <div className="flex items-center space-x-6">
          <button onClick={onFinish} className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"><ChevronLeft size={20} /></button>
          <div className="flex flex-col">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-black text-slate-800 leading-tight">{patient.name}</h2>
              <div className="flex items-center text-emerald-600 space-x-1">
                <RefreshCw size={10} className="animate-spin" />
                <span className="text-[8px] font-black uppercase tracking-widest">Auto-save {lastSaved}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">{appointment.type}</span>
              <span className="text-blue-600 border-l border-slate-200 pl-3">Dr(a). {doctor?.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleCFMRedirect} className="flex px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 items-center space-x-2 shadow-lg shadow-emerald-100 transition-all"><ShieldCheck size={18} /><span>PRESCRIÇÃO CFM</span></button>
          <button onClick={finalizeConsultation} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center space-x-2 transition-all active:scale-95"><CheckCircle size={18} /><span>FINALIZAR E SALVAR</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="space-y-4 no-print">
          <nav className="bg-white p-3 rounded-[32px] border border-slate-200 shadow-sm space-y-1">
            <NavButton active={activeTab === 'pep'} onClick={() => setActiveTab('pep')} icon={<FileEdit size={20} />} label="Evolução (PEP)" />
            <NavButton active={activeTab === 'anamnesis'} onClick={() => setActiveTab('anamnesis')} icon={<ClipboardList size={20} />} label="Anamnese Digital" />
            <NavButton active={activeTab === 'files'} onClick={() => setActiveTab('files')} icon={<FolderOpen size={20} />} label={`Exames (${patient.files?.length || 0})`} />
            <NavButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')} icon={<Pill size={20} />} label="Prescrições" />
          </nav>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'pep' && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between no-print">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Evolução Clínica</h3>
                <button onClick={handleAiAssist} disabled={isAiLoading} className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-blue-100 transition-all disabled:opacity-50"><Sparkles size={18} className="animate-pulse" /><span>IA ASSISTANT</span></button>
              </div>
              <div className="space-y-4">
                <textarea 
                  value={complaint} 
                  onChange={(e) => setComplaint(e.target.value)} 
                  rows={12} 
                  placeholder="Inicie o atendimento descrevendo a queixa principal e evolução..." 
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[28px] focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium leading-relaxed" 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Hipótese Diagnóstica (CID)</label>
                    <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold" />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Conduta & Plano</label>
                    <textarea value={conduct} onChange={(e) => setConduct(e.target.value)} rows={4} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-medium" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2 no-print">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Arquivos Digitais do Paciente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(patient.files || []).map(file => (
                  <div key={file.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><FileIcon size={24} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-800 truncate max-w-[150px]">{file.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{file.category}</p>
                      </div>
                    </div>
                    <button onClick={() => setViewingFile(file)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Eye size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingFile && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6 no-print">
          <div className="bg-white w-full max-w-5xl h-full max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800">{viewingFile.name}</h2>
              <button onClick={() => setViewingFile(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={24} /></button>
            </div>
            <div className="flex-1 bg-slate-50 overflow-hidden flex items-center justify-center">
              {viewingFile.type.includes('image') ? <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-full object-contain" /> : viewingFile.type.includes('pdf') ? <iframe src={viewingFile.url} className="w-full h-full" /> : <div className="text-center p-12 bg-white rounded-3xl"><FileIcon size={48} className="mx-auto text-slate-200 mb-4" /><p className="font-bold text-slate-500">Formato incompatível para visualização direta.</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}>
    <span className={active ? 'text-white' : 'text-blue-500/50'}>{icon}</span>
    <span className="text-xs font-black uppercase tracking-tight">{label}</span>
  </button>
);

export default ConsultationRoom;
