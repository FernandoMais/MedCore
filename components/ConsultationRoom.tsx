
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
  ShieldAlert
} from 'lucide-react';
import { Appointment, Patient, Prescription, Doctor } from '../types';
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

  const [activeTab, setActiveTab] = useState<'anamnesis' | 'pep' | 'prescriptions' | 'exams'>('pep');
  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

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

  if (!patient || !appointment) return <div className="p-8 text-center text-slate-500">Dados do atendimento não encontrados.</div>;

  const criticalAllergies = patient.allergies || [];
  const criticalConditions = patient.preExistingConditions || [];
  const hasSafetyAlerts = criticalAllergies.length > 0 || criticalConditions.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in zoom-in-95 duration-500 pb-20">
      
      {/* High-Visibility Clinical Alert Banner */}
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
                {criticalConditions.length > 0 && (
                   <p className="text-red-100 text-xs font-medium mt-1">
                     <span className="opacity-75">CONDIÇÕES:</span> {criticalConditions.join(', ')}
                   </p>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowWarning(false)}
            className="px-6 py-2 bg-red-800/50 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase transition-all border border-red-400/30 whitespace-nowrap"
          >
            CONFIRMAR CIÊNCIA
          </button>
        </div>
      )}

      {/* Consultation Header */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-6">
          <button 
            onClick={onFinish}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center space-x-4 border-l border-slate-200 pl-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${hasSafetyAlerts ? 'bg-red-500' : 'bg-blue-600'}`}>
              {patient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight">{patient.name}</h2>
              <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">{appointment.type}</span>
                <span className="flex items-center"><Clock size={12} className="mr-1" /> {appointment.time}</span>
                <span className="text-blue-600 flex items-center border-l border-slate-200 pl-3"><Stethoscope size={12} className="mr-1" /> Dr(a). {doctor?.name}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="hidden sm:flex px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 items-center space-x-2">
            <Save size={18} />
            <span>SALVAR RASCUNHO</span>
          </button>
          <button 
            onClick={onFinish}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center space-x-2 transition-all active:scale-95"
          >
            <CheckCircle size={18} />
            <span>FINALIZAR CONSULTA</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="space-y-4">
          <nav className="bg-white p-3 rounded-[32px] border border-slate-200 shadow-sm space-y-1">
            <NavButton active={activeTab === 'pep'} onClick={() => setActiveTab('pep')} icon={<FileEdit size={20} />} label="Evolução (PEP)" />
            <NavButton active={activeTab === 'anamnesis'} onClick={() => setActiveTab('anamnesis')} icon={<ClipboardList size={20} />} label="Anamnese Digital" />
            <NavButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')} icon={<Pill size={20} />} label="Prescrições" />
            <NavButton active={activeTab === 'exams'} onClick={() => setActiveTab('exams')} icon={<FlaskConical size={20} />} label="Pedidos de Exames" />
          </nav>

          <div className={`p-6 rounded-[32px] border transition-all ${hasSafetyAlerts ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-amber-50 border-amber-100'}`}>
            <div className={`flex items-center space-x-2 mb-4 ${hasSafetyAlerts ? 'text-red-600' : 'text-amber-600'}`}>
              <ShieldAlert size={20} />
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em]">Riscos Clínicos</h4>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Alergias</p>
                {criticalAllergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {criticalAllergies.map(a => <span key={a} className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-red-500 uppercase">{a}</span>)}
                  </div>
                ) : <p className="text-xs text-slate-500 italic">Sem registros.</p>}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Doenças Prévias</p>
                {criticalConditions.length > 0 ? (
                  <div className="space-y-1">
                    {criticalConditions.map(c => <p key={c} className="text-xs font-bold text-slate-700 flex items-center leading-tight"><AlertTriangle size={12} className="mr-2 text-amber-500 shrink-0" /> {c}</p>)}
                  </div>
                ) : <p className="text-xs text-slate-500 italic">Sem registros.</p>}
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Sangue</p>
                <span className="bg-white px-3 py-1 rounded-full text-sm font-black text-red-600 border border-red-100 shadow-sm">{patient.bloodType || 'N/I'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'pep' && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Evolução Médica</h3>
                <button 
                  onClick={handleAiAssist}
                  disabled={isAiLoading}
                  className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-blue-100 transition-all disabled:opacity-50 shadow-sm"
                >
                  <Sparkles size={18} className="animate-pulse" />
                  <span>{isAiLoading ? 'ASSISTENTE IA ANALISANDO...' : 'ASSISTÊNCIA CLÍNICA IA'}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Relato & Evolução Clínica</label>
                  <textarea 
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    rows={10} 
                    placeholder="Inicie a descrição do quadro clínico, exame físico e progresso do paciente..."
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm font-medium leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Hipótese Diagnóstica (CID)</label>
                    <input 
                      type="text" 
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Ex: I10 - Hipertensão Essencial"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-800"
                    />
                    {aiSuggestions && (
                      <div className="bg-blue-600 text-white p-6 rounded-[24px] shadow-2xl animate-in fade-in slide-in-from-right-2">
                        <div className="flex items-center mb-3 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                          <Sparkles size={14} className="mr-2" /> Inteligência Médica MedCore
                        </div>
                        <p className="text-xs font-bold leading-relaxed whitespace-pre-line">{aiSuggestions}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Conduta & Plano Terapêutico</label>
                    <textarea 
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                      rows={6}
                      placeholder="Orientações e decisões clínicas..."
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Receituário Digital</h3>
                  <p className="text-sm text-slate-500 font-medium">Gestão inteligente de medicamentos e posologias.</p>
                </div>
                <div className="flex space-x-2">
                   <button 
                    onClick={handlePrescriptionDraft}
                    disabled={isAiLoading}
                    className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-blue-100 disabled:opacity-50 transition-all border border-blue-100 shadow-sm"
                  >
                    <Sparkles size={18} />
                    <span>SUGERIR TERAPIA IA</span>
                  </button>
                  <button className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black flex items-center space-x-2 hover:bg-black shadow-lg transition-transform active:scale-95">
                    <Plus size={18} />
                    <span>ADICIONAR ITEM</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {prescriptions.length > 0 ? (
                  prescriptions.map((p, idx) => (
                    <div key={idx} className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 flex items-center justify-between group hover:border-blue-200 hover:bg-blue-50/10 transition-all shadow-sm">
                      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fármaco</p>
                          <p className="text-sm font-black text-slate-800 truncate">{p.medication}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dosagem</p>
                          <p className="text-sm font-bold text-slate-600 truncate">{p.dosage}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Freq/Uso</p>
                          <p className="text-sm font-bold text-slate-600 truncate">{p.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duração</p>
                          <p className="text-sm font-bold text-slate-600 truncate">{p.duration}</p>
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 ml-4">
                        Remover
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center bg-slate-50 border-4 border-dashed border-slate-100 rounded-[48px]">
                    <Pill size={56} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold tracking-tight">Nenhuma medicação prescrita até o momento.</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-100 flex flex-col md:flex-row items-center justify-between shadow-inner gap-6">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-xl border border-emerald-50">
                    <ExternalLink size={32} />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-800 text-lg uppercase tracking-tighter">Assinatura Digital Avançada</h4>
                    <p className="text-xs text-emerald-600 font-bold max-w-sm leading-relaxed">Conforme ICP-Brasil. Validação QR Code instantânea para farmácias e hospitais.</p>
                  </div>
                </div>
                <button className="w-full md:w-auto bg-emerald-600 text-white px-10 py-4 rounded-3xl font-black text-sm shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all">
                  EMITIR E ASSINAR AGORA
                </button>
              </div>
            </div>
          )}

          {activeTab === 'anamnesis' && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
              <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center">
                <ClipboardList size={24} className="mr-3 text-blue-600" />
                Triagem & Anamnese Estruturada
              </h3>
              <div className="space-y-12">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-6">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-4">HÁBITOS & ESTILO DE VIDA</p>
                     <div className="space-y-4">
                        <Checkbox label="Consumo de Tabaco" />
                        <Checkbox label="Consumo Alcoólico" />
                        <Checkbox label="Atividade Física Regular" checked />
                        <Checkbox label="Uso de Drogas Recreativas" />
                        <Checkbox label="Qualidade do Sono Regular" />
                     </div>
                   </div>
                   <div className="space-y-6">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-l-4 border-amber-500 pl-4">HISTÓRICO FAMILIAR CRÍTICO</p>
                     <div className="space-y-4">
                        <Checkbox label="Diabetes Mellitus" />
                        <Checkbox label="Hipertensão Arterial" checked />
                        <Checkbox label="Neoplasias Familiares" />
                        <Checkbox label="Cardiopatias Precoces" checked />
                        <Checkbox label="Doenças Neurodegenerativas" />
                     </div>
                   </div>
                 </div>
                 <div className="pt-10 border-t border-slate-50">
                   <label className="block text-xs font-black text-slate-700 mb-4 uppercase tracking-widest">OBSERVAÇÕES DO EXAME FÍSICO GERAL</label>
                   <textarea 
                    rows={6}
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-medium leading-relaxed"
                    placeholder="Sinais vitais, peso, IMC e notas de inspeção física..."
                   />
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group ring-8 ring-slate-900/10">
          <MessageSquare size={28} />
          <span className="absolute right-20 bg-white px-5 py-3 rounded-2xl text-[10px] font-black text-slate-800 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-slate-200 transition-all -translate-x-4 group-hover:translate-x-0 tracking-widest">
            CONSULTORIA CLÍNICA IA
          </span>
        </button>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 -translate-y-0.5' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <span className={active ? 'text-white' : 'text-blue-500/50 transition-colors'}>{icon}</span>
    <span className="text-xs font-black uppercase tracking-tight">{label}</span>
  </button>
);

const Checkbox: React.FC<{ label: string; checked?: boolean }> = ({ label, checked }) => (
  <label className="flex items-center space-x-4 cursor-pointer group">
    <div className={`w-6 h-6 rounded-xl border-2 transition-all flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100' : 'border-slate-200 group-hover:border-blue-400'}`}>
      {checked && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
    </div>
    <span className={`text-sm tracking-tight transition-colors ${checked ? 'text-slate-900 font-black' : 'text-slate-400 font-bold group-hover:text-slate-600'}`}>{label}</span>
  </label>
);

export default ConsultationRoom;
