
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
  // Added missing Plus import
  Plus
} from 'lucide-react';
import { Appointment, Patient, Prescription } from '../types';
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

  const [activeTab, setActiveTab] = useState<'anamnesis' | 'pep' | 'prescriptions' | 'exams'>('pep');
  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

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

  if (!patient || !appointment) return <div>Dados não encontrados.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in zoom-in-95 duration-500 pb-20">
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
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center font-bold text-blue-600">
              {patient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-slate-500">{appointment.type}</span>
                <span>Início: {appointment.time}</span>
                <span className="text-blue-600 font-semibold flex items-center"><Clock size={12} className="mr-1" /> em atendimento há 12m</span>
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
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 flex items-center space-x-2"
          >
            <CheckCircle size={18} />
            <span>Finalizar Consulta</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-4">
          <nav className="bg-white p-3 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <NavButton active={activeTab === 'anamnesis'} onClick={() => setActiveTab('anamnesis')} icon={<ClipboardList size={20} />} label="Anamnese Digital" />
            <NavButton active={activeTab === 'pep'} onClick={() => setActiveTab('pep')} icon={<FileEdit size={20} />} label="Evolução (PEP)" />
            <NavButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')} icon={<Pill size={20} />} label="Prescrições" />
            <NavButton active={activeTab === 'exams'} onClick={() => setActiveTab('exams')} icon={<FlaskConical size={20} />} label="Pedidos de Exames" />
          </nav>

          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
            <div className="flex items-center space-x-2 text-amber-600 mb-2">
              <Stethoscope size={18} />
              <h4 className="font-bold text-sm">Alergias Detectadas</h4>
            </div>
            {patient.allergies.length > 0 ? (
               <div className="flex flex-wrap gap-1">
                 {patient.allergies.map(a => <span key={a} className="bg-white text-red-600 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100 uppercase">{a}</span>)}
               </div>
            ) : <p className="text-xs text-slate-500">Sem alertas registrados.</p>}
          </div>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
            <h4 className="font-bold text-blue-800 text-sm mb-3">Últimas Interações</h4>
            <div className="space-y-4">
              <div className="text-xs">
                <p className="font-bold text-blue-700">12/03/2024 - Dr. Paulo</p>
                <p className="text-slate-600 italic">"Paciente relatou cansaço extremo..."</p>
              </div>
              <div className="text-xs">
                <p className="font-bold text-blue-700">10/01/2024 - Dr. Ricardo</p>
                <p className="text-slate-600 italic">"Início de tratamento para TAG."</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'pep' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Evolução Médica</h3>
                <button 
                  onClick={handleAiAssist}
                  disabled={isAiLoading}
                  className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={18} />
                  <span>{isAiLoading ? 'Analisando...' : 'Assistência IA'}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Queixa Principal e Histórico Atual</label>
                  <textarea 
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    rows={6} 
                    placeholder="Descreva o motivo da consulta e relato do paciente..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Diagnóstico / Hipótese</label>
                    <input 
                      type="text" 
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Ex: Hipertensão Essencial"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {aiSuggestions && (
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in fade-in">
                        <div className="flex items-center text-blue-600 mb-2 text-xs font-bold uppercase tracking-wider">
                          <Sparkles size={14} className="mr-1" /> Sugestões IA
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{aiSuggestions}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Conduta Médica</label>
                    <textarea 
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                      rows={4}
                      placeholder="Orientações e próximos passos..."
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
                  <h3 className="text-xl font-bold text-slate-800">Prescrição Eletrônica</h3>
                  <p className="text-sm text-slate-500">Adicione medicamentos e defina a posologia.</p>
                </div>
                <div className="flex space-x-2">
                   <button 
                    onClick={handlePrescriptionDraft}
                    disabled={isAiLoading}
                    className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={18} />
                    <span>Sugerir Prescrição</span>
                  </button>
                  <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2">
                    <Plus size={18} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {prescriptions.length > 0 ? (
                  prescriptions.map((p, idx) => (
                    <div key={idx} className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-between group">
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Medicamento</p>
                          <p className="text-sm font-bold text-slate-800">{p.medication}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Dose</p>
                          <p className="text-sm text-slate-600">{p.dosage}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Frequência</p>
                          <p className="text-sm text-slate-600">{p.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Duração</p>
                          <p className="text-sm text-slate-600">{p.duration}</p>
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        Remover
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                    <Pill size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-400 text-sm">Nenhum medicamento prescrito ainda.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <ExternalLink size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-800 text-sm">Assinatura Digital ICP-Brasil</h4>
                    <p className="text-xs text-blue-600">Sua receita será validada com QR Code de segurança.</p>
                  </div>
                </div>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200">Emitir Receita</button>
              </div>
            </div>
          )}

          {activeTab === 'anamnesis' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Anamnese do Paciente</h3>
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-4">
                     <p className="text-xs font-bold text-slate-500 uppercase">Hábitos de Vida</p>
                     <div className="space-y-3">
                        <Checkbox label="Tabagismo" />
                        <Checkbox label="Etilismo" />
                        <Checkbox label="Sedentarismo" />
                        <Checkbox label="Dieta Equilibrada" checked />
                     </div>
                   </div>
                   <div className="space-y-4">
                     <p className="text-xs font-bold text-slate-500 uppercase">Antecedentes Familiares</p>
                     <div className="space-y-3">
                        <Checkbox label="Diabetes Mellitus" />
                        <Checkbox label="Hipertensão" checked />
                        <Checkbox label="Neoplasias" />
                        <Checkbox label="Cardiopatias" checked />
                     </div>
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Comentários Adicionais de Anamnese</label>
                   <textarea 
                    rows={4}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Notas específicas sobre estilo de vida e antecedentes..."
                   />
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Persistent floating action for quick AI check or chat */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform group">
          <MessageSquare size={24} />
          <span className="absolute right-16 bg-white px-3 py-1 rounded-lg text-xs font-bold text-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-slate-200">Chat de Apoio Clínico</span>
        </button>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    {icon}
    <span className="text-sm font-bold">{label}</span>
  </button>
);

const Checkbox: React.FC<{ label: string; checked?: boolean }> = ({ label, checked }) => (
  <label className="flex items-center space-x-3 cursor-pointer group">
    <div className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
      {checked && <div className="w-2 h-2 bg-white rounded-full"></div>}
    </div>
    <span className={`text-sm ${checked ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>{label}</span>
  </label>
);

export default ConsultationRoom;
