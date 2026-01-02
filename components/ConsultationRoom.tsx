
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  FileEdit, 
  Sparkles,
  CheckCircle,
  Clock,
  ShieldAlert,
  FolderOpen,
  FileIcon,
  Eye,
  X,
  FileText,
  ShieldCheck,
  RefreshCw,
  Upload
} from 'lucide-react';
import { Appointment, Patient, Prescription, Doctor, MedicalFile } from '../types';
import { getICDRecommendation } from '../services/gemini';

interface ConsultationRoomProps {
  appointmentId: string;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  onFinish: (evolutionData?: { diagnosis: string; conduct: string; complaint: string }) => void;
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

  const [activeTab, setActiveTab] = useState<'pep' | 'files'>('pep');
  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<MedicalFile | null>(null);

  useEffect(() => {
    const draft = localStorage.getItem(`medcore_consult_draft_${appointmentId}`);
    if (draft) {
      const data = JSON.parse(draft);
      setComplaint(data.complaint || '');
      setConduct(data.conduct || '');
      setDiagnosis(data.diagnosis || '');
    }
  }, [appointmentId]);

  useEffect(() => {
    const draft = { complaint, conduct, diagnosis, appointmentId };
    localStorage.setItem(`medcore_consult_draft_${appointmentId}`, JSON.stringify(draft));
  }, [complaint, conduct, diagnosis, appointmentId]);

  const handleAiAssist = async () => {
    if (!complaint) return;
    setIsAiLoading(true);
    const result = await getICDRecommendation(complaint);
    alert(result || 'Sugestões de CID obtidas.');
    setIsAiLoading(false);
  };

  const finalizeConsultation = () => {
    if (!diagnosis || !complaint) {
      if (!confirm('Alguns campos estão vazios. Deseja finalizar mesmo assim?')) return;
    }
    
    if (confirm('Deseja salvar esta evolução no histórico permanente do paciente e finalizar o atendimento?')) {
      localStorage.removeItem(`medcore_consult_draft_${appointmentId}`);
      onFinish({ diagnosis, conduct, complaint });
    }
  };

  if (!patient || !appointment) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20 no-print">
        <div className="flex items-center space-x-6">
          <button onClick={() => onFinish()} className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"><ChevronLeft size={20} /></button>
          <div>
            <h2 className="text-xl font-black text-slate-800">{patient.name}</h2>
            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              <span className="bg-slate-100 px-2 py-0.5 rounded shadow-inner">{appointment.type}</span>
              <span className="text-blue-600 border-l border-slate-200 pl-3">Dr(a). {doctor?.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => window.open('https://prescricao.cfm.org.br/login', '_blank')} className="flex px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 items-center space-x-2 shadow-lg shadow-emerald-100 transition-all"><ShieldCheck size={18} /><span>PRESCRIÇÃO CFM</span></button>
          <button onClick={finalizeConsultation} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-blue-700 flex items-center space-x-2 transition-all active:scale-95"><CheckCircle size={18} /><span>FINALIZAR ATENDIMENTO</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="space-y-4 no-print">
          <nav className="bg-white p-3 rounded-[32px] border border-slate-200 shadow-sm space-y-1">
            <button onClick={() => setActiveTab('pep')} className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${activeTab === 'pep' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><FileEdit size={20} /><span className="text-xs font-black uppercase tracking-tight">Evolução (PEP)</span></button>
            <button onClick={() => setActiveTab('files')} className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${activeTab === 'files' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><FolderOpen size={20} /><span className="text-xs font-black uppercase tracking-tight">Exames/Documentos</span></button>
          </nav>
          
          <div className="p-6 bg-red-50 rounded-[32px] border border-red-100 shadow-sm">
             <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3 flex items-center"><ShieldAlert size={14} className="mr-2" /> Alertas de Risco</h4>
             <div className="flex flex-wrap gap-1">
                {patient.allergies.map(a => <span key={a} className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">{a}</span>)}
                {patient.allergies.length === 0 && <span className="text-xs text-red-400 font-bold italic">Nenhum alerta ativo.</span>}
             </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {activeTab === 'pep' ? (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Evolução Médica Atual</h3>
                <button onClick={handleAiAssist} disabled={isAiLoading} className="text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl text-xs font-black flex items-center space-x-2 hover:bg-blue-100 transition-colors"><Sparkles size={18} className="animate-pulse" /><span>ASSISTENTE IA</span></button>
              </div>
              <textarea 
                value={complaint} 
                onChange={(e) => setComplaint(e.target.value)} 
                rows={12} 
                placeholder="Descreva o atendimento, queixas principais e história da doença atual..." 
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[28px] outline-none text-sm font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 transition-all" 
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hipótese Diagnóstica (CID-10)</label>
                  <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" placeholder="Ex: I10 - Hipertensão essencial" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Conduta & Plano Terapêutico</label>
                  <textarea value={conduct} onChange={(e) => setConduct(e.target.value)} rows={3} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Medicações sugeridas, exames solicitados..." />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 min-h-[500px]">
               <h3 className="text-xl font-black text-slate-800 tracking-tight">Exames e Documentos Digitais</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(patient.files || []).map(file => (
                  <div key={file.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><FileIcon size={24} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-800 truncate max-w-[150px]">{file.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{file.category}</p>
                      </div>
                    </div>
                    <button onClick={() => setViewingFile(file)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Eye size={18} /></button>
                  </div>
                ))}
                {(patient.files || []).length === 0 && (
                  <div className="col-span-2 py-20 text-center bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100">
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum documento disponível para este paciente.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingFile && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6 no-print">
          <div className="bg-white w-full max-w-5xl h-full max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800">{viewingFile.name}</h2>
              <button onClick={() => setViewingFile(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 bg-slate-50 overflow-hidden flex items-center justify-center">
              {viewingFile.type.includes('image') ? <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-full object-contain" /> : <iframe src={viewingFile.url} className="w-full h-full" title="PDF Viewer" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationRoom;
