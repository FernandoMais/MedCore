
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronLeft, 
  FileEdit, 
  Sparkles,
  CheckCircle,
  Clock,
  ShieldAlert,
  Eye,
  X,
  ShieldCheck,
  RefreshCw,
  History,
  AlertCircle,
  Printer,
  PlusCircle,
  Pill,
  Search,
  Lock,
  KeyRound,
  EyeOff,
  FileLock2,
  Plus,
  Send,
  ChevronDown
} from 'lucide-react';
import { Appointment, Patient, Doctor, Medication, SigilousNote, User, UserRole } from '../types';
import { getICDRecommendation } from '../services/gemini';
import { supabase } from '../services/supabase';
import PatientEvolution from './PatientEvolution';
import { draftVault } from '../services/draftVault';

interface ConsultationRoomProps {
  appointmentId: string;
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  medications: Medication[];
  currentUser: User;
  users: User[];
  sigilousNotes: SigilousNote[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  onAddSigilousNote: (note: SigilousNote) => Promise<void>;
  onFinish: (evolutionData?: { 
    diagnosis: string; 
    conduct: string; 
    complaint: string; 
    prescription: string;
    especialidade?: string;
    senha_acesso?: string;
  }) => Promise<void>;
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ 
  appointmentId, 
  appointments, 
  patients, 
  doctors,
  medications,
  currentUser,
  users,
  sigilousNotes,
  setMedications,
  onAddSigilousNote,
  onFinish 
}) => {
  const appointment = appointments.find(a => a.id === appointmentId);
  const patient = patients.find(p => p.id === appointment?.patientId);
  const doctor = doctors.find(d => d.id === appointment?.doctorId);

  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [specialty, setSpecialty] = useState(doctor?.specialty || 'Clínica Geral');
  const [accessPassword, setAccessPassword] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftKey = `medcore_consult_draft_${currentUser.clinicId}_${currentUser.id}_${appointmentId}`;
  const legacyDraftKey = `medcore_consult_draft_${appointmentId}`;
  const finishingRef = useRef(false);
  const noteRetryId=useRef<string|null>(null);
  
  const [showMedRegistration, setShowMedRegistration] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedPosology, setNewMedPosology] = useState('');
  
  const [medSearch, setMedSearch] = useState('');
  const [showMedResults, setShowMedResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sigilous notes states
  const [sigilousUnlocked, setSigilousUnlocked] = useState(false);
  const [sigilousPasswordInput, setSigilousPasswordInput] = useState('');
  const [sigilousPasswordVisible, setSigilousPasswordVisible] = useState(false);
  const [sigilousError, setSigilousError] = useState('');
  const [newSigilousNote, setNewSigilousNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showSigilousMenu, setShowSigilousMenu] = useState(false);

  const filteredMeds = medications.filter(m => 
    m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
    m.purpose?.toLowerCase().includes(medSearch.toLowerCase())
  ).slice(0, 5);

  const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

  const isSensitiveSpecialty = (value: string) => {
    const normalized = value.toLowerCase();
    return normalized.includes('psicologia') || normalized.includes('psiquiatria');
  };

  const hashAccessPassword = async (value: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    let alive=true;
    void (async()=>{
      try {
        let data=await draftVault.read(draftKey);
        const legacy=localStorage.getItem(draftKey)||(
          currentUser.role===UserRole.ADMIN||currentUser.doctorId===appointment?.doctorId?localStorage.getItem(legacyDraftKey):null);
        if(!data&&legacy){
          data=JSON.parse(legacy);await draftVault.write(draftKey,data);
          localStorage.removeItem(draftKey);localStorage.removeItem(legacyDraftKey);
        }
        if(!alive)return;
        if(data){
        setComplaint(data.complaint || '');
        setConduct(data.conduct || '');
        setDiagnosis(data.diagnosis || '');
        setPrescription(data.prescription || '');
        setNewSigilousNote(data.privateNote || '');
        }
      } catch {
        if(alive)setFinishError('Não foi possível abrir o rascunho protegido. Entre novamente com sua conta; não descarte as pendências.');
        return;
      }
      if(alive)setDraftLoaded(true);
    })();
    return()=>{alive=false;};
  }, [draftKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowMedResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const draft = { complaint, conduct, diagnosis, prescription, appointmentId, privateNote:newSigilousNote };
    void draftVault.write(draftKey,draft).catch(()=>{
      setFinishError('Não foi possível guardar o rascunho neste computador. Não feche a tela antes da confirmação de gravação.');
    });
  }, [complaint, conduct, diagnosis, prescription, appointmentId, newSigilousNote, draftLoaded, draftKey]);

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

  const handleAddCustomMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    const entry = `${newMedName} ${newMedDosage}\nUso: ${newMedPosology || 'A definir'}\n\n`;
    setPrescription(prev => prev + entry);
    const newMed: Medication = {
      id: createId('med'),
      name: newMedName,
      dosage: newMedDosage,
      posology: newMedPosology,
      purpose: 'Cadastrado durante consulta'
    };
    setMedications(prev => [newMed, ...prev]);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedPosology('');
    setShowMedRegistration(false);
  };

  const handlePrint = (type: 'prescription' | 'exam') => {
    const content = type === 'prescription' ? prescription : conduct;
    if (!content.trim()) {
      alert(`Preencha o conteúdo de ${type === 'prescription' ? 'receita' : 'exame'} antes de imprimir.`);
      return;
    }
    const className = type === 'prescription' ? 'printing-prescription' : 'printing-exam';
    const cleanup = () => {
      document.body.classList.remove(className);
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.add(className);
    window.addEventListener('afterprint', cleanup);
    requestAnimationFrame(() => {
      window.print();
      setTimeout(cleanup, 1000);
    });
  };

  const openOfficialPrescription = () => {
    window.open('https://prescricao.cfm.org.br/login', '_blank');
  };

  const handleFinalize = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!draftLoaded) {
      setFinishError('O rascunho protegido precisa ser recuperado antes de finalizar. Entre novamente; não descarte as pendências.');
      return;
    }
    if (finishingRef.current) return;
    if (!complaint.trim()) {
      alert("A 'Queixa Principal / Evolução' é obrigatória para finalizar o atendimento.");
      return;
    }
    if (window.confirm("Confirmar encerramento da consulta?\n\nOs dados serão arquivados no prontuário do paciente permanentemente.")) {
      finishingRef.current = true;
      setIsFinishing(true);
      setFinishError('');
      try {
        const protectedPassword = accessPassword.trim() ? await hashAccessPassword(accessPassword.trim()) : '';
        await onFinish({ 
          diagnosis, 
          conduct, 
          complaint, 
          prescription,
          especialidade: specialty,
          senha_acesso: protectedPassword
        });
        await draftVault.remove(draftKey);
        localStorage.removeItem(legacyDraftKey);
      } catch (error) {
        setFinishError(error instanceof Error ? error.message : 'O banco não confirmou a gravação. Seu rascunho foi mantido.');
      } finally {
        finishingRef.current = false;
        setIsFinishing(false);
      }
    }
  };

  // ---- Sigilous notes unlock ----
  const handleUnlockSigilous = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigilousError('');
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== currentUser.authUserId
      || ![UserRole.ADMIN, UserRole.DOCTOR].includes(currentUser.role)) {
      setSigilousError('É necessário um acesso autenticado de médico ou administrador. O servidor restringe as notas ao autor e ao administrador.');
      return;
    }
    setSigilousUnlocked(true);
    setSigilousPasswordInput('');
    setSigilousError('');
  };

  const handleSaveSigilousNote = async () => {
    if (!newSigilousNote.trim() || !patient) return;
    setIsSavingNote(true);
    const note: SigilousNote = {
      id: noteRetryId.current||(noteRetryId.current=createId('sig')),
      patientId: patient.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorSpecialty: doctor?.specialty,
      note: newSigilousNote.trim(),
      createdAt: new Date().toISOString()
    };
    try {
      await onAddSigilousNote(note);
      noteRetryId.current=null;
      setNewSigilousNote('');
      setSigilousError('');
    } catch (error) {
      setSigilousError(error instanceof Error ? error.message : 'A nota não foi gravada; seu texto foi mantido.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Patient sigilous notes sorted by date desc
  const patientSigilousNotes = (sigilousNotes || [])
    .filter(n => n.patientId === patient?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const patientHistoryEntries = (patient?.history || '')
    .split(/(?=\[DATA:)/g)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const dateLine = entry.match(/^\[DATA:\s*(.*?)\]/);
      const authorLine = entry.match(/MÉDICO:\s*(.*)/);
      const dateLabel = dateLine?.[1] || '';
      const timestamp = dateLine?.[1]
        ? new Date(dateLine[1].replace(' às ', ' '))
        : new Date(0);
      const cleaned = entry
        .replace(/^\[DATA:.*?\]\n?/, '')
        .replace(/\n-+\n?$/, '')
        .trim();
      return { dateLabel, author: authorLine?.[1] || '', timestamp, entry: cleaned };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const renderFormattedHistory = (historyText: string) => {
    if (!historyText) return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <History size={48} className="mb-4 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest italic text-center">Primeiro Atendimento<br/>Nenhum registro prévio.</p>
      </div>
    );

    if (patientHistoryEntries.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <History size={48} className="mb-4 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest italic text-center">Nenhum registro prévio.</p>
      </div>
    );

    return (
      <div className="space-y-4">
        {patientHistoryEntries.map((block, index) => (
          <div key={index} className="border border-slate-100 rounded-2xl overflow-hidden">
            <div className="flex items-center space-x-3 px-5 py-3 bg-blue-50 border-b border-blue-100">
              <Clock size={13} className="text-blue-500 shrink-0" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-[0.15em]">{block.dateLabel}</span>
              <span className="text-[10px] font-bold text-slate-500 truncate">• {block.author}</span>
            </div>
            <div className="p-5 text-[11px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed bg-white">
              {block.entry}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!patient || !appointment) return null;

  return (
    <div id="print-area" className="max-w-[100%] mx-auto space-y-6 pb-20 animate-in fade-in duration-500 flex flex-col">
      
      {/* DOCUMENTO PARA IMPRESSÃO DE RECEITA */}
      {createPortal(
        <div className="print-only prescription-print-content">
          <div className="prescription-header text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Ambulatório Restaura Integral</h1>
            <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-[0.3em]">Cuidado e Saúde com Excelência</p>
          </div>
          <div className="flex justify-between items-start mb-10">
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/50 flex-1 mr-4">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Paciente</p>
              <p className="text-2xl font-black text-slate-900">{patient.name}</p>
              <div className="flex space-x-8 text-sm font-bold text-slate-600 mt-2">
                <span>CPF: {patient.cpf}</span>
                <span>Nasc: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Data da Receita</p>
              <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="prescription-body min-h-[400px]">
            <h2 className="text-sm font-black uppercase tracking-[0.4em] text-slate-900 border-b border-slate-200 pb-3 mb-8">Receituário Médico</h2>
            <div className="whitespace-pre-wrap text-lg leading-relaxed font-medium text-slate-800">
              {prescription || "Nenhum medicamento prescrito nesta consulta."}
            </div>
          </div>
          <div className="prescription-footer mt-20 flex flex-col items-end">
            <div className="w-64 text-center">
              <div className="signature-line border-t-2 border-slate-900 mb-2"></div>
              <p className="text-sm font-black text-slate-900">Dr. {doctor?.name}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">CRM {doctor?.crm} - {doctor?.specialty}</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DOCUMENTO PARA IMPRESSÃO DE EXAME */}
      {createPortal(
        <div className="print-only exam-print-content">
          <div className="prescription-header">
            <h1 className="text-3xl font-black text-blue-600 uppercase tracking-tighter">MedCore Pro Clinic</h1>
            <p className="text-lg font-bold text-slate-800">DR. {doctor?.name.toUpperCase()}</p>
            <p className="text-sm font-black text-blue-500 uppercase tracking-widest">CRM: {doctor?.crm}</p>
            <p className="text-xs text-slate-500 mt-2">{doctor?.specialty} • Fone: {doctor?.phone}</p>
          </div>
          <div className="mb-10 p-6 border border-slate-200 rounded-2xl bg-slate-50/50">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Paciente</p>
            <p className="text-2xl font-black text-slate-900">{patient.name}</p>
            <div className="flex space-x-8 text-sm font-bold text-slate-600 mt-2">
              <span>CPF: {patient.cpf}</span>
              <span>Nasc: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="prescription-body">
            <h2 className="text-sm font-black uppercase tracking-[0.4em] text-blue-600 border-b-2 border-blue-100 pb-3 mb-8">Solicitação de Exames / Procedimentos</h2>
            <div className="whitespace-pre-wrap">{conduct || "Nenhuma solicitação registrada."}</div>
          </div>
          <div className="prescription-footer">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Emissão do sistema em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <div className="signature-line"></div>
            <p className="text-sm font-black text-slate-900">Dr. {doctor?.name}</p>
            <p className="text-xs text-slate-500 font-bold">CRM {doctor?.crm} - {doctor?.specialty}</p>
          </div>
        </div>,
        document.body
      )}

      {/* Barra de Ações Superior */}
      <div className="bg-white p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-20 no-print">
        <div className="flex items-center space-x-4 lg:space-x-6">
          <button 
            type="button"
            onClick={() => onFinish()} 
            disabled={isFinishing}
            className="p-2.5 lg:p-3 bg-slate-100 text-slate-600 rounded-xl lg:rounded-2xl hover:bg-slate-200 transition-all active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center space-x-3 lg:space-x-4 overflow-hidden">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-600 rounded-xl lg:rounded-2xl flex items-center justify-center text-white font-black text-lg lg:text-xl shadow-xl ring-4 ring-blue-50 shrink-0">
               {patient.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight truncate">{patient.name}</h2>
              <div className="flex items-center space-x-2 lg:space-x-3 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded shadow-inner truncate">{appointment.type}</span>
                <span className="text-blue-600 truncate">CPF: {patient.cpf}</span>
                 {appointment.serviceValue !== undefined && (
                   <span className="text-emerald-600 truncate">
                     R$ {appointment.serviceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                     {appointment.repassRule
                       ? ` • Repasse ${appointment.repassRule.type === 'percentage' ? `${appointment.repassRule.value}%` : `R$ ${appointment.repassRule.value.toFixed(2)}`}`
                       : ''}
                   </span>
                 )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:space-x-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
           <button 
            type="button"
            onClick={() => handlePrint('exam')}
            className="shrink-0 px-4 lg:px-5 py-3 lg:py-4 bg-white border border-slate-200 text-emerald-600 rounded-xl lg:rounded-[20px] hover:bg-emerald-50 hover:border-emerald-300 transition-all active:scale-95 shadow-sm flex items-center space-x-2"
           >
              <Printer size={18} />
              <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">Exames</span>
           </button>
           <button 
            type="button"
            onClick={() => handlePrint('prescription')}
            className="shrink-0 px-4 lg:px-5 py-3 lg:py-4 bg-white border border-slate-200 text-blue-600 rounded-xl lg:rounded-[20px] hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95 shadow-sm flex items-center space-x-2"
           >
              <Printer size={18} />
              <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">Receita</span>
           </button>
           <button 
            type="button"
            onClick={openOfficialPrescription}
            className="shrink-0 px-5 lg:px-6 py-3 lg:py-4 bg-emerald-600 text-white rounded-xl lg:rounded-[20px] font-black text-[10px] lg:text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
           >
              <ShieldCheck size={18} />
              <span>Receitas Online</span>
           </button>
        </div>
      </div>

      {/* ========= Histórico Geral do Paciente ========= */}
      <div className="bg-white p-6 lg:p-10 rounded-[32px] border border-slate-200 shadow-sm no-print">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Histórico do Paciente</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Registros organizados por data</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registros</span>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg shadow-blue-100">
              {patient.history ? patient.history.split('[DATA:').length - 1 : 0}
            </span>
          </div>
        </div>
        <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {renderFormattedHistory(patient.history || '')}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <PatientEvolution patientId={patient.id} currentUser={currentUser} />
      </div>

      {/* ========= Informações Sigilosas ========= */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="px-6 lg:px-10 py-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-500">
              <FileLock2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Informações Sigilosas</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                Anotações confidenciais — não constam no histórico geral
              </p>
            </div>
          </div>
          {sigilousUnlocked && (
            <button
              type="button"
              onClick={() => { setSigilousUnlocked(false); setSigilousPasswordInput(''); }}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <EyeOff size={14} />
              <span>Ocultar</span>
            </button>
          )}
        </div>

        <div className="p-6 lg:p-10">
          <button
            type="button"
            onClick={() => setShowSigilousMenu(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors"
          >
            <span>Menu de informações sigilosas</span>
            <ChevronDown size={16} className={`transition-transform ${showSigilousMenu ? 'rotate-180' : ''}`} />
          </button>

          {showSigilousMenu && (
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 lg:p-6">
              {!sigilousUnlocked ? (
                <form onSubmit={handleUnlockSigilous} className="space-y-5">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-3xl flex items-center justify-center mx-auto">
                      <KeyRound size={28} className="text-amber-400" />
                    </div>
                    <p className="text-slate-600 text-sm font-bold leading-relaxed">
                      O Supabase autoriza este acesso: apenas o autor e o administrador da clínica podem ler as notas sigilosas. Não use uma senha compartilhada.
                    </p>
                  </div>

                  {sigilousError && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-2xl flex items-center space-x-2 text-red-400">
                      <AlertCircle size={16} />
                      <span className="text-xs font-bold">{sigilousError}</span>
                    </div>
                  )}

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type={sigilousPasswordVisible ? 'text' : 'password'}
                      value={sigilousPasswordInput}
                      onChange={e => setSigilousPasswordInput(e.target.value)}
                      placeholder="Acesso pela sua sessão autenticada"
                      disabled
                      className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 placeholder:text-slate-400"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setSigilousPasswordVisible(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {sigilousPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-amber-500 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2"
                  >
                    <KeyRound size={16} />
                    <span>Confirmar meu acesso autenticado</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                      <ShieldCheck size={14} />
                      <span>Anotações sigilosas anteriores ({patientSigilousNotes.length})</span>
                    </div>
                    {patientSigilousNotes.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl">
                        <FileLock2 size={32} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-500 text-xs font-bold">Nenhuma anotação sigilosa registrada para este paciente.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {patientSigilousNotes.map(note => (
                          <div key={note.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                              <div className="flex items-center space-x-2">
                                <Clock size={12} className="text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                  {new Date(note.createdAt).toLocaleDateString('pt-BR')} às {new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">
                                {note.authorName}{note.authorSpecialty ? ` • ${note.authorSpecialty}` : ''}
                              </span>
                            </div>
                            <div className="p-5 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                              {note.note}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {sigilousError && <p role="alert" className="text-sm text-red-600">{sigilousError}</p>}
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                      <Plus size={12} />
                      <span>Registrar nova anotação sigilosa</span>
                    </label>
                    <textarea
                      value={newSigilousNote}
                      onChange={e => setNewSigilousNote(e.target.value)}
                      rows={4}
                      className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm outline-none focus:ring-2 focus:ring-amber-500/30 resize-none placeholder:text-slate-400"
                      placeholder="Nota restrita ao autor e ao administrador da mesma clínica."
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 font-bold">Autor: {currentUser.name}</p>
                      <button
                        type="button"
                        onClick={handleSaveSigilousNote}
                        disabled={!newSigilousNote.trim() || isSavingNote}
                        className="px-6 py-3 bg-amber-500 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSavingNote ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>Salvar Anotação</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========= Formulário de Evolução + Receituário ========= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 no-print">
        
        {/* Coluna Central: Evolução e Conduta */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 lg:p-8 rounded-[30px] lg:rounded-[40px] border border-slate-200 shadow-sm space-y-6 lg:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <h3 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight flex items-center">
                <FileEdit size={22} className="mr-3 text-emerald-600" />
                Evolução & Conduta
              </h3>
              <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={() => handlePrint('exam')}
                  className="flex-1 sm:flex-none text-emerald-600 bg-emerald-50 px-3 lg:px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-colors hover:bg-emerald-100"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
                <button 
                  type="button"
                  onClick={handleAiAssist} 
                  className="flex-1 sm:flex-none text-blue-600 bg-blue-50 px-3 lg:px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-colors hover:bg-blue-100"
                >
                  <Sparkles size={14} className={isAiLoading ? "animate-spin" : ""} />
                  <span>IA CID</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Queixa / Evolução Clínica *</label>
                <textarea 
                  value={complaint} 
                  onChange={(e) => setComplaint(e.target.value)} 
                  className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-[28px] outline-none text-sm font-medium leading-relaxed focus:ring-4 focus:ring-blue-500/10 transition-all" 
                  placeholder="Relate atual do paciente..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Especialidade do Atendimento</label>
                <input 
                  type="text" 
                  value={specialty} 
                  onChange={(e) => setSpecialty(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                  placeholder="Ex: Psicologia, Cardiologia..." 
                />
              </div>

              {isSensitiveSpecialty(specialty) && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Senha adicional legada (opcional)</label>
                    <ShieldAlert size={14} className="text-amber-500" />
                  </div>
                  <input 
                    type="password" 
                    value={accessPassword} 
                    onChange={(e) => setAccessPassword(e.target.value)} 
                    className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl font-black text-slate-700 text-sm outline-none focus:ring-4 focus:ring-amber-500/10 transition-all" 
                    placeholder="Defina uma senha para este registro" 
                  />
                  <p className="text-[9px] text-amber-600 font-bold ml-2">Senha adicional legada e opcional. O servidor já restringe registros sensíveis ao autor e ao administrador.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hipótese Diagnóstica (CID)</label>
                <input 
                  type="text" 
                  value={diagnosis} 
                  onChange={(e) => setDiagnosis(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
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

              <div className="pt-6 border-t border-slate-100 flex flex-col space-y-4">
                <div className="bg-white border border-slate-200 rounded-[28px] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Informações Sigilosas</h4>
                      <p className="text-[10px] font-medium text-slate-500">Acesso restrito para notas confidenciais do paciente.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSigilousMenu(v => !v)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center space-x-2"
                    >
                      <FileLock2 size={14} />
                      <span>{showSigilousMenu ? 'Ocultar' : 'Abrir'}</span>
                    </button>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleFinalize}
                  disabled={isFinishing || !draftLoaded}
                  className={`w-full py-6 rounded-[32px] font-black text-sm shadow-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 ${isFinishing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                >
                  {isFinishing ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  <span className="uppercase tracking-[0.2em]">{isFinishing ? 'Gravando no Prontuário...' : 'Finalizar e Gravar Atendimento'}</span>
                </button>
                {finishError && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{finishError}</p>}
                <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">Só há confirmação após gravação no Supabase. Evoluções restritas são autorizadas pelo servidor.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Receituário Digital */}
        <div className="lg:col-span-5 space-y-6 overflow-hidden flex flex-col">
          <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl flex-1 flex flex-col overflow-hidden">
             <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center">
                  <Pill size={22} className="mr-3 text-blue-400" />
                  Receituário
                </h3>
             </div>

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
                {showMedResults && medSearch.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border border-slate-100">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resultados Encontrados</span>
                       <X size={14} className="text-slate-300 cursor-pointer hover:text-red-500" onClick={() => setShowMedResults(false)} />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredMeds.length > 0 ? (
                        filteredMeds.map((med) => (
                          <button 
                            key={med.id}
                            type="button"
                            onClick={() => addMedication(med)}
                            className="w-full text-left p-4 hover:bg-blue-50 flex items-center justify-between group border-b border-slate-50 last:border-none transition-colors"
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

             <div className="flex-1 flex flex-col min-h-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Conteúdo da Prescrição Atual</label>
                <textarea 
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  className="w-full flex-1 p-6 bg-white/5 border border-white/10 rounded-[28px] text-white font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
                  placeholder="Os medicamentos selecionados aparecerão aqui. Você também pode editar manualmente..."
                />
             </div>

             <div className="mt-6 flex flex-col space-y-4 pt-6 border-t border-white/10 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowMedRegistration(true)}
                  className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all"
                >
                  <PlusCircle size={16} />
                  <span>Incluir Novo Medicamento</span>
                </button>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[9px] font-black text-slate-500 uppercase">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <span>CRM {doctor?.crm} - MedCore PRO</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handlePrint('prescription')}
                    className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-90 flex items-center space-x-2"
                  >
                    <Printer size={16} />
                    <span>Emitir Receita</span>
                  </button>
                </div>
             </div>
          </div>
        </div>

      </div>

      {/* Modal de Cadastro de Medicamento */}
      {showMedRegistration && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
                <Pill className="mr-3 text-blue-600" size={24} />
                Cadastrar Medicamento
              </h3>
              <button onClick={() => setShowMedRegistration(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddCustomMedication} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome do Medicamento</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="Ex: Amoxicilina"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Dosagem / Apresentação</label>
                <input 
                  type="text" 
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="Ex: 500mg - Comprimidos"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Posologia Sugerida</label>
                <textarea 
                  value={newMedPosology}
                  onChange={(e) => setNewMedPosology(e.target.value)}
                  className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
                  placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas por 7 dias."
                />
              </div>
              <button 
                type="submit"
                className="w-full py-5 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
              >
                Adicionar à Receita
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ConsultationRoom;
