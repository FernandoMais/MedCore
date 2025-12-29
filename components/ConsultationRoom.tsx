
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
import { MOCK_DOCTORS } from '../constants';
import { getICDRecommendation, generatePrescriptionDraft } from '../services/gemini';

interface ConsultationRoomProps {
  appointmentId: string;
  appointments: Appointment[];
  patients: Patient[];
  onFinish: () => void;
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ appointmentId, appointments, patients, onFinish }) => {
  const appointment = appointments.find(a => a.id === appointmentId);
  const patient = patients.find(p => p.id === appointment?.patientId);
  const doctor = MOCK_DOCTORS.find(d => d.id === appointment?.doctorId);

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
        <div className="bg-red-600 text-white p-5 rounded-3xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 border-b-4 border-red-800">
          <div className="flex items-center space-x-5">
            <div className="bg-white text-red-600 p-3 rounded-2xl shadow-lg animate-pulse">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Alerta de Segurança Clínica</h3>
              <div className="flex flex-col mt-1">
                {criticalAllergies.length > 0 && (
                   <p className="text-red-50 text-sm font-bold">
                     <span className="underline">Alergias Detectadas:</span> {criticalAllergies.join(', ')}
                   </p>
                )}
                {criticalConditions.length > 0 && (
                   <p className="text-red-100 text-xs font-medium mt-1">
                     <span className="opacity-75">Condições Pré-Existentes:</span> {criticalConditions.join(', ')}
                   </p>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowWarning(false)}
            className="px-6 py-2 bg-red-800/50 hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase transition-all border border-red-400/30"
          >
            Confirmar Ciência
          </button>
        </div>
      )}

      {/* Consultation Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-6">
          <button 
            onClick={onFinish}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center space-x-4 border-l border-slate-200 pl-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${hasSafetyAlerts ? 'bg-red-500' : 'bg-blue-600'}`}>
              {patient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-slate-500">{appointment.type}</span>
                <span>Início: {appointment.time}</span>
                <span className="text-blue-600 font-semibold flex items-center border-l border-slate-200 pl-3 ml-3"><Clock size={12} className="mr-1" /> Dr(a). {doctor?.name}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 flex items-center space-x-2">
            <Save size={18} />
            <span>Salvar Rascunho</span>
          </button>
          <button 
            onClick={onFinish}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 flex items-center space-x-2 transition-all active:scale-95"
          >
            <CheckCircle size={18} />
            <span>Finalizar Atendimento</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-4">
          <nav className="bg-white p-3 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <NavButton active={activeTab === 'anamnesis'} onClick={() => setActiveTab('anamnesis')} icon={<ClipboardList size={20} />} label="Anamnese Digital" />
            <NavButton active={activeTab === 'pep'} onClick={() => setActiveTab('pep'} icon={<FileEdit size={20} />} label="Evolução (PEP)" />
            <NavButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')} icon={<Pill size={20} />} label="Prescrições" />
            <NavButton active={activeTab === 'exams'} onClick={() => setActiveTab('exams')} icon={<FlaskConical size={20} />} label="Pedidos de Exames" />
          </nav>

          <div className={`p-6 rounded-3xl border transition-colors ${hasSafetyAlerts ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className={`flex items-center space-x-2 mb-4 ${hasSafetyAlerts ? 'text-red-600' : 'text-amber-600'}`}>
              <ShieldAlert size={20} />
              <h4 className="font-bold text-sm">Resumo de Riscos</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Alergias Ativas</p>
                {criticalAllergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {criticalAllergies.map(a => <span key={a} className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-red-500 uppercase">{a}</span>)}
                  </div>
                ) : <p className="text-xs text-slate-500 italic">Sem registros.</p>}
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Condições Crônicas</p>
                {criticalConditions.length > 0 ? (
                  <div className="space-y-1">
                    {criticalConditions.map(c => <p key={c} className="text-xs font-semibold text-slate-700 flex items-center"><AlertTriangle size={12} className="mr-2 text-amber-500" /> {c}</p>)}
                  </div>
                ) : <p className="text-xs text-slate-500 italic">Sem registros.</p>}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Tipo Sanguíneo</p>
                <span className="bg-white px-3 py-1 rounded-full text-sm font-black text-red-600 border border-red-100">{patient.bloodType || 'N/I'}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
            <h4 className="font-bold text-blue-800 text-sm mb-3">Notas de Histórico</h4>
            <p className="text-xs text-slate-600 leading-relaxed italic">
              "{patient.history}"
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'pep' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Registro de Evolução Médica</h3>
                <button 
                  onClick={handleAiAssist}
                  disabled={isAiLoading}
                  className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={18} />
                  <span>{isAiLoading ? 'Processando Sintomas...' : 'Assistência Clínica IA'}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 tracking-tight">Anamnese / Queixa Principal / Evolução do Quadro</label>
                  <textarea 
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    rows={8} 
                    placeholder="Descreva o relato do paciente, exame físico e evolução clínica..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Diagnóstico / Hipótese Diagnóstica (CID-10)</label>
                    <input 
                      type="text" 
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Ex: I10 - Hipertensão Essencial"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {aiSuggestions && (
                      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 animate-in fade-in ring-2 ring-blue-200/20">
                        <div className="flex items-center text-blue-600 mb-3 text-xs font-black uppercase tracking-widest">
                          <Sparkles size={14} className="mr-1" /> Recomendações de Apoio IA
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{aiSuggestions}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Conduta Clínica e Orientações</label>
                    <textarea 
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                      rows={5}
                      placeholder="Orientações ao paciente, encaminhamentos e plano de cuidados..."
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Prescrição Farmacológica Digital</h3>
                  <p className="text-sm text-slate-500">Banco de medicamentos com verificação de segurança.</p>
                </div>
                <div className="flex space-x-2">
                   <button 
                    onClick={handlePrescriptionDraft}
                    disabled={isAiLoading}
                    className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={18} />
                    <span>Sugerir Terapia</span>
                  </button>
                  <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-black transition-colors">
                    <Plus size={18} />
                    <span>Adicionar Medicamento</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {prescriptions.length > 0 ? (
                  prescriptions.map((p, idx) => (
                    <div key={idx} className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medicamento</p>
                          <p className="text-sm font-bold text-slate-800">{p.medication}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dosagem</p>
                          <p className="text-sm text-slate-600">{p.dosage}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Posologia</p>
                          <p className="text-sm text-slate-600">{p.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duração</p>
                          <p className="text-sm text-slate-600">{p.duration}</p>
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2">
                        Remover
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[40px]">
                    <Pill size={48} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 text-sm font-medium">Nenhum medicamento prescrito para este atendimento.</p>
                    <p className="text-[10px] text-slate-300 mt-1">Utilize a busca ou sugestões da IA para adicionar.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center justify-between shadow-inner">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <ExternalLink size={28} />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-800 text-sm uppercase tracking-tight">Documento com Assinatura Digital</h4>
                    <p className="text-xs text-emerald-600 font-medium leading-tight">Válido em território nacional (Padrão ICP-Brasil).<br/>O paciente receberá o link por WhatsApp e E-mail.</p>
                  </div>
                </div>
                <button className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-emerald-200/50 hover:bg-emerald-700 active:scale-95 transition-all">EMITIR E ASSINAR RECEITA</button>
              </div>
            </div>
          )}

          {activeTab === 'anamnesis' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
              <h3 className="text-xl font-bold text-slate-800 mb-8 border-b pb-4">Anamnese Estruturada por Especialidade</h3>
              <div className="space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-5">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-3">Hábitos de Vida e Riscos</p>
                     <div className="grid grid-cols-1 gap-4">
                        <Checkbox label="Tabagismo Ativo" />
                        <Checkbox label="Etilismo Social/Pesado" />
                        <Checkbox label="Prática de Atividade Física" checked />
                        <Checkbox label="Uso de Medicações Contínuas" checked />
                        <Checkbox label="Distúrbios do Sono" />
                     </div>
                   </div>
                   <div className="space-y-5">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-l-4 border-amber-500 pl-3">Antecedentes Familiares de Risco</p>
                     <div className="grid grid-cols-1 gap-4">
                        <Checkbox label="Diabetes Mellitus" />
                        <Checkbox label="Hipertensão Arterial Sistêmica" checked />
                        <Checkbox label="Neoplasias em parentes de 1º grau" />
                        <Checkbox label="Infarto/AVC precoce na família" checked />
                     </div>
                   </div>
                 </div>
                 <div className="pt-6 border-t border-slate-50">
                   <label className="block text-sm font-black text-slate-700 mb-3 uppercase tracking-tight">Exame Físico Geral e Sinais Vitais</label>
                   <textarea 
                    rows={5}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[32px] focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder:text-slate-300"
                    placeholder="PA, FC, FR, Temp, Peso, IMC. Notas sobre inspeção, palpação, percussão e ausculta..."
                   />
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group">
          <MessageSquare size={28} />
          <span className="absolute right-20 bg-white px-4 py-2 rounded-2xl text-xs font-black text-slate-800 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-slate-200 transition-all -translate-x-2 group-hover:translate-x-0">CONSULTORIA CLÍNICA IA</span>
        </button>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-5 py-4 rounded-2xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 translate-x-1' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <span className={active ? 'text-white' : 'text-blue-500/50'}>{icon}</span>
    <span className="text-sm font-black uppercase tracking-tight">{label}</span>
  </button>
);

const Checkbox: React.FC<{ label: string; checked?: boolean }> = ({ label, checked }) => (
  <label className="flex items-center space-x-4 cursor-pointer group">
    <div className={`w-6 h-6 rounded-xl border-2 transition-all flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-100' : 'border-slate-200 group-hover:border-blue-400'}`}>
      {checked && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
    </div>
    <span className={`text-sm tracking-tight ${checked ? 'text-slate-900 font-black' : 'text-slate-400 font-medium'}`}>{label}</span>
  </label>
);

export default ConsultationRoom;
