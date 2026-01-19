
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
  Upload,
  ExternalLink,
  Save,
  User as UserIcon,
  Activity,
  History,
  AlertCircle
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

  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [viewingFile, setViewingFile] = useState<MedicalFile | null>(null);

  // Recuperar rascunho automático ao montar
  useEffect(() => {
    const draft = localStorage.getItem(`medcore_consult_draft_${appointmentId}`);
    if (draft) {
      const data = JSON.parse(draft);
      setComplaint(data.complaint || '');
      setConduct(data.conduct || '');
      setDiagnosis(data.diagnosis || '');
    }
  }, [appointmentId]);

  // Salvar rascunho automático a cada alteração
  useEffect(() => {
    const draft = { complaint, conduct, diagnosis, appointmentId };
    localStorage.setItem(`medcore_consult_draft_${appointmentId}`, JSON.stringify(draft));
  }, [complaint, conduct, diagnosis, appointmentId]);

  const handleAiAssist = async () => {
    if (!complaint) {
       alert("Preencha a queixa principal para obter sugestões da IA.");
       return;
    }
    setIsAiLoading(true);
    const result = await getICDRecommendation(complaint);
    alert(result || 'Sugestões de CID obtidas.');
    setIsAiLoading(false);
  };

  const openFileInNewTab = (file: MedicalFile) => {
    try {
      if (file.url.startsWith('data:application/pdf')) {
        const base64Content = file.url.split(',')[1];
        const binary = atob(base64Content);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } else {
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<img src="${file.url}" style="max-width:100%; height:auto; border-radius: 12px; margin: 20px auto; display: block; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">`);
        }
      }
    } catch (e) {
      console.error("Erro ao abrir arquivo:", e);
      alert("Não foi possível abrir o documento nativamente.");
    }
  };

  const handleFinalize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!complaint.trim()) {
      alert("A 'Queixa Principal / Evolução' é obrigatória para finalizar o registro.");
      return;
    }

    if (confirm("Confirmar encerramento da consulta? Os dados serão gravados permanentemente no prontuário do paciente.")) {
      setIsFinishing(true);
      // Remove o rascunho antes de encerrar
      localStorage.removeItem(`medcore_consult_draft_${appointmentId}`);
      // Dispara o callback para o App.tsx que fará o fechamento da tela e o setDb
      onFinish({ diagnosis, conduct, complaint });
    }
  };

  const renderFormattedHistory = (historyText: string) => {
    if (!historyText) return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <History size={48} className="mb-4 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest italic text-center">Primeiro Atendimento<br/>Nenhum registro prévio.</p>
      </div>
    );

    const parts = historyText.split(/(\[DATA: .*?\])/);
    return (
      <div className="space-y-4">
        {parts.map((part, index) => {
          if (part.startsWith('[DATA:')) {
            return (
              <div key={index} className="flex items-center space-x-3 pt-6 pb-2 border-b border-slate-100 mt-4 first:mt-0">
                <Clock size={14} className="text-blue-500" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{part.replace(/[\[\]]/g, '')}</span>
              </div>
            );
          }
          if (!part.trim()) return null;
          return (
            <div key={index} className="bg-white border border-slate-100 p-5 rounded-2xl text-[11px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
              {part.trim()}
            </div>
          );
        })}
      </div>
    );
  };

  if (!patient || !appointment) return null;

  return (
    <div className="max-w-[100%] mx-auto space-y-6 pb-20 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Barra de Ações Superior */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20 no-print">
        <div className="flex items-center space-x-6">
          <button 
            type="button"
            onClick={() => onFinish()} 
            className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl ring-4 ring-blue-50">
               {patient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{patient.name}</h2>
              <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded shadow-inner">{appointment.type}</span>
                <span className="text-blue-600">CPF: {patient.cpf}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
           <button 
            type="button"
            onClick={handleFinalize} 
            disabled={isFinishing}
            className={`px-10 py-4 rounded-[20px] font-black text-xs shadow-2xl flex items-center space-x-3 transition-all active:scale-95 ${isFinishing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
          >
            {isFinishing ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            <span className="uppercase tracking-[0.1em]">{isFinishing ? 'Gravando...' : 'Finalizar e Gravar no Prontuário'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
        
        {/* Coluna Esquerda: Ficha Completa do Paciente (Permanente e Obrigatória) */}
        <div className="lg:col-span-4 flex flex-col space-y-6 overflow-hidden no-print">
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
             <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center">
                  <History size={18} className="mr-3 text-blue-600" />
                  Ficha do Paciente (Histórico)
                </h3>
                <div className="flex space-x-1">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
             </div>
             
             {/* Info rápida */}
             <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Alergias</p>
                   <p className="text-[10px] font-bold text-red-600 truncate">{patient.allergies.join(', ') || 'Nenhuma'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sanguíneo</p>
                   <p className="text-[10px] font-bold text-blue-600">{patient.bloodType || 'N/I'}</p>
                </div>
             </div>

             {/* Histórico Rolável */}
             <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
               {renderFormattedHistory(patient.history)}
             </div>

             {/* Anexos Rápidos */}
             <div className="mt-6 pt-6 border-t border-slate-100 shrink-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                   <FolderOpen size={14} className="mr-2" /> Documentos Anexados
                </h4>
                <div className="grid grid-cols-1 gap-2">
                   {patient.files && patient.files.length > 0 ? (
                      patient.files.map(f => (
                        <button key={f.id} onClick={() => setViewingFile(f)} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left group">
                           <div className="flex items-center space-x-3 overflow-hidden">
                              <FileIcon size={14} className="text-slate-400 group-hover:text-blue-500" />
                              <span className="text-[10px] font-bold text-slate-600 truncate">{f.name}</span>
                           </div>
                           <Eye size={12} className="text-slate-300" />
                        </button>
                      ))
                   ) : (
                      <p className="text-[10px] italic text-slate-400 text-center py-4">Sem anexos.</p>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Coluna Direita: Evolução Médica (Área de Digitação) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center">
                <FileEdit size={24} className="mr-4 text-blue-600" />
                Evolução do Atendimento
              </h3>
              <button 
                type="button"
                onClick={handleAiAssist} 
                disabled={isAiLoading} 
                className="text-blue-600 bg-blue-50 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-3 hover:bg-blue-100 transition-all active:scale-95 shadow-sm"
              >
                <Sparkles size={18} className={isAiLoading ? "animate-spin" : "animate-pulse"} />
                <span>ASSISTENTE IA (CID)</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col space-y-8">
              <div className="space-y-3 flex-1 flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center">
                   <Activity size={14} className="mr-2" /> Queixa Principal / Evolução Clínica (Obrigatório)
                </label>
                <textarea 
                  value={complaint} 
                  onChange={(e) => setComplaint(e.target.value)} 
                  className="w-full flex-1 p-8 bg-slate-50 border border-slate-100 rounded-[36px] outline-none text-base font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all shadow-inner" 
                  placeholder="Descreva aqui o atendimento atual, anamnese, exame físico e evolução do paciente..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center">
                     <AlertCircle size={14} className="mr-2" /> Hipótese Diagnóstica (CID)
                  </label>
                  <input 
                    type="text" 
                    value={diagnosis} 
                    onChange={(e) => setDiagnosis(e.target.value)} 
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" 
                    placeholder="Ex: I10 - Hipertensão" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center">
                     <CheckCircle size={14} className="mr-2" /> Conduta & Plano Terapêutico
                  </label>
                  <textarea 
                    value={conduct} 
                    onChange={(e) => setConduct(e.target.value)} 
                    rows={2} 
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" 
                    placeholder="Medicação sugerida, exames solicitados e retorno..." 
                  />
                </div>
              </div>
            </div>
            
            {/* Aviso de salvamento automático */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-50 shrink-0">
               <div className="flex items-center space-x-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                  <Save size={12} />
                  <span>Rascunho automático ativo para o agendamento {appointment.id}</span>
               </div>
               <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest italic">Dr(a). {doctor?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador de Arquivos (Exames) */}
      {viewingFile && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-6 no-print">
          <div className="bg-white w-full max-w-5xl h-full max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-lg flex items-center">
                 <FileIcon size={20} className="mr-3 text-blue-600" />
                 {viewingFile.name}
              </h2>
              <div className="flex items-center space-x-3">
                <button 
                  type="button"
                  onClick={() => openFileInNewTab(viewingFile)} 
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
                >
                  <ExternalLink size={16} />
                  <span>Visualizar Nativo</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewingFile(null)} 
                  className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-8">
              {viewingFile.type.includes('image') ? (
                <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-4 border-white" />
              ) : (
                <div className="text-center p-16 bg-white rounded-[48px] shadow-xl border border-slate-100 max-w-md mx-auto">
                   <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-8">
                      <FileText size={40} />
                   </div>
                   <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">Documento PDF</h3>
                   <p className="text-sm text-slate-500 mb-10 leading-relaxed">Para segurança dos dados, este PDF será aberto em seu visualizador nativo.</p>
                   <button onClick={() => openFileInNewTab(viewingFile)} className="w-full bg-blue-600 text-white px-8 py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-100 transition-all hover:bg-blue-700">ABRIR AGORA</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationRoom;
