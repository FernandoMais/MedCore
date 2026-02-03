
import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  ArrowRight,
  Printer,
  PlusCircle,
  Pill,
  Search,
  Check
} from 'lucide-react';
import { Appointment, Patient, Prescription, Doctor, MedicalFile, Medication } from '../types';
import { getICDRecommendation } from '../services/gemini';

interface ConsultationRoomProps {
  appointmentId: string;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  medications: Medication[];
  onFinish: (evolutionData?: { diagnosis: string; conduct: string; complaint: string; prescription: string }) => void;
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ 
  appointmentId, 
  appointments, 
  patients, 
  doctors,
  medications,
  onFinish 
}) => {
  const appointment = appointments.find(a => a.id === appointmentId);
  const patient = patients.find(p => p.id === appointment?.patientId);
  const doctor = doctors.find(d => d.id === appointment?.doctorId);

  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  
  // Estados para busca de medicamentos
  const [medSearch, setMedSearch] = useState('');
  const [showMedResults, setShowMedResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const filteredMeds = medications.filter(m => 
    m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
    m.purpose?.toLowerCase().includes(medSearch.toLowerCase())
  ).slice(0, 5); // Mostra apenas os primeiros 5 resultados para manter limpo

  // Recuperar rascunho automático ao montar
  useEffect(() => {
    const draft = localStorage.getItem(`medcore_consult_draft_${appointmentId}`);
    if (draft) {
      const data = JSON.parse(draft);
      setComplaint(data.complaint || '');
      setConduct(data.conduct || '');
      setDiagnosis(data.diagnosis || '');
      setPrescription(data.prescription || '');
    }
  }, [appointmentId]);

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowMedResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Salvar rascunho automático
  useEffect(() => {
    const draft = { complaint, conduct, diagnosis, prescription, appointmentId };
    localStorage.setItem(`medcore_consult_draft_${appointmentId}`, JSON.stringify(draft));
  }, [complaint, conduct, diagnosis, prescription, appointmentId]);

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

  const addMedication = (med: Medication) => {
    const entry = `${med.name} ${med.dosage}\nUso: ${med.posology || 'A definir'}${med.period ? ` por ${med.period}` : ''}\n\n`;
    setPrescription(prev => prev + entry);
    setMedSearch('');
    setShowMedResults(false);
  };

  const handlePrintPrescription = () => {
    if (!prescription.trim()) {
      alert("Escreva o receituário antes de imprimir.");
      return;
    }
    window.print();
  };

  const handleFinalize = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!complaint.trim()) {
      alert("A 'Queixa Principal / Evolução' é obrigatória.");
      return;
    }

    if (confirm("Confirmar encerramento da consulta?\n\nOs dados da Evolução e do Receituário serão arquivados no histórico do paciente.")) {
      setIsFinishing(true);
      localStorage.removeItem(`medcore_consult_draft_${appointmentId}`);
      onFinish({ diagnosis, conduct, complaint, prescription });
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
              <div key={index} className="flex items-center space-x-3 pt-6 pb-2 border-b border-slate-100 mt-4 first:mt-0 no-print-area">
                <Clock size={14} className="text-blue-500" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{part.replace(/[\[\]]/g, '')}</span>
              </div>
            );
          }
          if (!part.trim()) return null;
          return (
            <div key={index} className="bg-white border border-slate-100 p-5 rounded-2xl text-[11px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm no-print-area">
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
      
      {/* DOCUMENTO PARA IMPRESSÃO */}
      <div className="print-only prescription-print bg-white">
        <div className="prescription-header">
          <h1 className="text-2xl font-black text-blue-600 uppercase tracking-tighter">MedCore Pro Clinic</h1>
          <p className="text-sm font-bold text-slate-800">DR. {doctor?.name.toUpperCase()}</p>
          <p className="text-xs font-black text-blue-500 uppercase tracking-widest">CRM: {doctor?.crm}</p>
          <p className="text-[10px] text-slate-500 mt-2">{doctor?.specialty} • Fone: {doctor?.phone}</p>
        </div>

        <div className="mb-10 p-4 border border-slate-200 rounded-xl bg-slate-50/30">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Paciente</p>
          <p className="text-lg font-black text-slate-900">{patient.name}</p>
          <div className="flex space-x-6 text-xs font-bold text-slate-600 mt-1">
            <span>CPF: {patient.cpf}</span>
            <span>Nascimento: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <div className="prescription-body">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-blue-600 border-b border-blue-100 pb-2 mb-6">Receituário Médico</h2>
          <div className="whitespace-pre-wrap font-medium text-slate-800">
            {prescription || "Nenhum medicamento prescrito nesta consulta."}
          </div>
        </div>

        <div className="prescription-footer">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          <div className="signature-line"></div>
          <p className="text-xs font-black text-slate-900">Dr. {doctor?.name}</p>
          <p className="text-[10px] text-slate-500">CRM {doctor?.crm}</p>
        </div>
      </div>

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
            onClick={handlePrintPrescription}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-slate-50 transition-all"
           >
              <Printer size={18} />
              <span>Imprimir Receita</span>
           </button>
           <button 
            type="button"
            onClick={handleFinalize} 
            disabled={isFinishing}
            className={`px-10 py-4 rounded-[20px] font-black text-xs shadow-2xl flex items-center space-x-3 transition-all active:scale-95 ${isFinishing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
          >
            {isFinishing ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            <span className="uppercase tracking-[0.1em]">{isFinishing ? 'Gravando...' : 'Finalizar Atendimento'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden no-print">
        
        {/* Coluna Esquerda: Histórico */}
        <div className="lg:col-span-3 flex flex-col space-y-6 overflow-hidden">
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
             <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center">
                  <History size={18} className="mr-3 text-blue-600" />
                  Histórico Prévio
                </h3>
             </div>
             
             <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
               {renderFormattedHistory(patient.history)}
             </div>
          </div>
        </div>

        {/* Coluna Central: Evolução e Conduta */}
        <div className="lg:col-span-5 space-y-6 overflow-y-auto pr-2 scrollbar-hide">
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
                <FileEdit size={22} className="mr-3 text-emerald-600" />
                Evolução & Conduta
              </h3>
              <button 
                type="button"
                onClick={handleAiAssist} 
                className="text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center space-x-2"
              >
                <Sparkles size={14} className={isAiLoading ? "animate-spin" : ""} />
                <span>IA CID</span>
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Queixa / Evolução Clínica</label>
                <textarea 
                  value={complaint} 
                  onChange={(e) => setComplaint(e.target.value)} 
                  className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-[28px] outline-none text-sm font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 transition-all" 
                  placeholder="Relato atual do paciente..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hipótese Diagnóstica (CID)</label>
                <input 
                  type="text" 
                  value={diagnosis} 
                  onChange={(e) => setDiagnosis(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 text-sm outline-none" 
                  placeholder="Ex: I10 - Hipertensão" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Conduta & Procedimentos</label>
                <textarea 
                  value={conduct} 
                  onChange={(e) => setConduct(e.target.value)} 
                  className="w-full h-32 p-6 bg-slate-50 border border-slate-100 rounded-[28px] outline-none text-sm font-medium focus:ring-4 focus:ring-blue-500/10 transition-all" 
                  placeholder="Instruções de procedimentos, pedidos de exames..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Receituário Digital */}
        <div className="lg:col-span-4 space-y-6 overflow-hidden flex flex-col">
          <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl flex-1 flex flex-col overflow-hidden">
             <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center">
                  <Pill size={22} className="mr-3 text-blue-400" />
                  Receituário
                </h3>
             </div>

             {/* Busca Inteligente de Medicamentos */}
             <div className="mb-6 shrink-0 relative" ref={searchContainerRef}>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Buscar Medicamento Cadastrado</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Digite o nome do medicamento..."
                    value={medSearch}
                    onChange={(e) => {
                      setMedSearch(e.target.value);
                      setShowMedResults(true);
                    }}
                    onFocus={() => setShowMedResults(true)}
                  />
                </div>

                {/* Dropdown de Resultados Inteligente */}
                {showMedResults && medSearch.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border border-slate-100">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resultados Encontrados</span>
                       <X size={14} className="text-slate-300 cursor-pointer" onClick={() => setShowMedResults(false)} />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredMeds.length > 0 ? (
                        filteredMeds.map((med) => (
                          <button 
                            key={med.id}
                            onClick={() => addMedication(med)}
                            className="w-full text-left p-4 hover:bg-blue-50 flex items-center justify-between group border-b border-slate-50 last:border-none"
                          >
                            <div>
                               <p className="font-black text-slate-800 text-sm">{med.name} <span className="text-blue-600 text-xs">{med.dosage}</span></p>
                               <p className="text-[10px] text-slate-500 font-medium truncate">{med.purpose || 'Medicamento'}</p>
                            </div>
                            <PlusCircle size={18} className="text-slate-200 group-hover:text-blue-600 transition-colors" />
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                           <AlertCircle size={24} className="mx-auto text-slate-200 mb-2" />
                           <p className="text-[10px] font-black text-slate-300 uppercase">Nenhum medicamento encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>

             {/* Área de Edição da Receita */}
             <div className="flex-1 flex flex-col min-h-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Conteúdo da Prescrição Atual</label>
                <textarea 
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  className="w-full flex-1 p-6 bg-white/5 border border-white/10 rounded-[28px] text-white font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
                  placeholder="Os medicamentos selecionados aparecerão aqui. Você também pode editar manualmente..."
                />
             </div>

             <div className="mt-6 flex items-center justify-between pt-6 border-t border-white/10 shrink-0">
                <div className="flex items-center space-x-2 text-[9px] font-black text-slate-500 uppercase">
                   <ShieldCheck size={14} className="text-blue-500" />
                   <span>Assinatura Digital CRM Pronta</span>
                </div>
                <button 
                  onClick={handlePrintPrescription}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  <Printer size={18} />
                </button>
             </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ConsultationRoom;
