
import React, { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail,
  ShieldAlert,
  ChevronRight,
  Filter,
  MapPin,
  Fingerprint,
  Activity,
  Droplets,
  FileText,
  History,
  AlertTriangle,
  User
} from 'lucide-react';
import { Patient } from '../types';

interface PatientManagerProps {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
}

const PatientManager: React.FC<PatientManagerProps> = ({ patients, setPatients }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cpf.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Pacientes</h1>
          <p className="text-slate-500 font-medium">Controle centralizado de prontuários e registros.</p>
        </div>
        <button className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center space-x-2">
          <UserPlus size={20} />
          <span>NOVO PACIENTE</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`space-y-4 transition-all duration-300 ${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar por Nome, CPF ou ID..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-bold outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">
              <Filter size={20} />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                    {!selectedPatient && (
                      <>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-12">Alertas Clínicos</th>
                      </>
                    )}
                    <th className="px-6 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      onClick={() => setSelectedPatient(patient)}
                      className={`group cursor-pointer hover:bg-blue-50/30 transition-all ${selectedPatient?.id === patient.id ? 'bg-blue-50/80 border-l-8 border-l-blue-600' : ''}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black mr-4 transition-all shadow-sm ${patient.allergies.length > 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-black text-slate-800 text-sm leading-tight">{patient.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold font-mono tracking-tighter uppercase mt-0.5">{patient.cpf}</div>
                          </div>
                        </div>
                      </td>
                      {!selectedPatient && (
                        <>
                          <td className="px-6 py-5">
                             <div className="text-xs font-bold text-slate-600 leading-none">{patient.phone}</div>
                             <div className="text-[10px] text-slate-400 font-medium mt-1">{patient.email}</div>
                          </td>
                          <td className="px-6 py-5 text-right pr-12">
                             <div className="flex justify-end space-x-2">
                               {patient.allergies.length > 0 && (
                                 <div className="p-1.5 bg-red-100 text-red-600 rounded-lg animate-pulse">
                                   <ShieldAlert size={14} />
                                 </div>
                               )}
                               {patient.preExistingConditions.length > 0 && (
                                 <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                   <AlertTriangle size={14} />
                                 </div>
                               )}
                             </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-5 text-right">
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-slate-400 font-bold italic">Nenhum paciente localizado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selectedPatient && (
          <div className="lg:col-span-8 animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-full sticky top-8">
              <div className="p-10 border-b border-slate-100 bg-slate-50/30 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-8">
                    <div className={`w-28 h-28 rounded-[40px] flex items-center justify-center text-5xl font-black shadow-2xl ring-8 ring-white ${selectedPatient.allergies.length > 0 ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div className="text-center sm:text-left">
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{selectedPatient.name}</h2>
                      <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-slate-600">ID: #000{selectedPatient.id}</span>
                        <span>{selectedPatient.birthDate}</span>
                        <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl border border-blue-100">{selectedPatient.healthInsurance || 'PARTICULAR'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-600 shadow-sm transition-transform active:scale-90">
                      <Phone size={22} />
                    </button>
                    <button 
                      onClick={() => setSelectedPatient(null)}
                      className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl"
                    >
                      VOLTAR À LISTA
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`${selectedPatient.allergies.length > 0 ? 'bg-red-50 border-red-200 shadow-xl shadow-red-100/30 ring-4 ring-red-500/5' : 'bg-slate-50 border-slate-100'} p-8 rounded-[32px] border transition-all duration-500`}>
                    <div className={`flex items-center space-x-3 mb-4 ${selectedPatient.allergies.length > 0 ? 'text-red-600 font-black' : 'text-slate-500 font-bold'}`}>
                      <ShieldAlert size={24} className={selectedPatient.allergies.length > 0 ? 'animate-pulse' : ''} />
                      <h4 className="uppercase tracking-[0.2em] text-[10px]">Alergias & Contraindicações</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.allergies.length > 0 ? (
                        selectedPatient.allergies.map(a => (
                          <span key={a} className="bg-red-600 px-4 py-1.5 rounded-2xl text-[10px] font-black text-white border border-red-400 uppercase shadow-lg shadow-red-200/50">{a}</span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400 italic font-medium">Nenhum registro de alergia crítica.</span>
                      )}
                    </div>
                  </div>

                  <div className={`${selectedPatient.preExistingConditions.length > 0 ? 'bg-amber-50 border-amber-200 shadow-xl shadow-amber-100/30 ring-4 ring-amber-500/5' : 'bg-slate-50 border-slate-100'} p-8 rounded-[32px] border transition-all duration-500`}>
                    <div className={`flex items-center space-x-3 mb-4 ${selectedPatient.preExistingConditions.length > 0 ? 'text-amber-600 font-black' : 'text-slate-500 font-bold'}`}>
                      <Activity size={24} />
                      <h4 className="uppercase tracking-[0.2em] text-[10px]">Condições Clínicas Ativas</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.preExistingConditions.length > 0 ? (
                        selectedPatient.preExistingConditions.map(c => (
                          <span key={c} className="bg-white px-4 py-1.5 rounded-2xl text-[10px] font-black text-amber-700 border border-amber-200 uppercase shadow-sm">{c}</span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400 italic font-medium">Nenhuma condição crônica mapeada.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center">
                    <User size={16} className="mr-3 text-blue-500" />
                    REGISTRO CADASTRAL COMPLETO
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                    <InfoBlock icon={<Fingerprint size={18} className="text-slate-300"/>} label="CPF" value={selectedPatient.cpf} />
                    <InfoBlock icon={<Droplets size={18} className="text-red-400"/>} label="Tipo Sanguíneo" value={selectedPatient.bloodType || 'Não Coletado'} />
                    <InfoBlock icon={<Mail size={18} className="text-slate-300"/>} label="E-mail" value={selectedPatient.email} />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <InfoBlock icon={<MapPin size={18} className="text-blue-400"/>} label="Endereço de Residência" value={selectedPatient.address} />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 p-8 rounded-[32px] shadow-2xl shadow-blue-200 text-white">
                  <div className="flex items-center space-x-3 mb-4">
                    <History size={24} className="opacity-80" />
                    <h4 className="font-black uppercase tracking-widest text-xs">Histórico Pregresso Resumido</h4>
                  </div>
                  <p className="text-sm font-bold leading-relaxed italic opacity-95">
                    "{selectedPatient.history}"
                  </p>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-slate-400 mb-6 flex items-center uppercase tracking-widest">
                    <FileText size={18} className="mr-3 text-blue-600" />
                    Últimas Evoluções no Prontuário Digital
                  </h3>
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="group flex items-start space-x-5 p-6 rounded-3xl border border-slate-100 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 cursor-pointer">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-sm shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                          {i}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">Relatório de Evolução Mensal</h4>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">12 OUT 2023</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">Evolução clínica favorável. Paciente apresenta boa resposta terapêutica e sinais vitais estáveis durante avaliação presencial...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <button className="text-[10px] font-black text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-[0.2em] border-b-2 border-transparent hover:border-slate-800 pb-1">EXPORTAR PRONTUÁRIO CONSOLIDADO (PDF)</button>
                <div className="flex space-x-4 w-full sm:w-auto">
                  <button className="flex-1 sm:flex-none px-10 py-4 bg-white border border-slate-200 text-slate-700 rounded-3xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all active:scale-95">EDITAR</button>
                  <button className="flex-1 sm:flex-none px-10 py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">INICIAR CONSULTA</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoBlock: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="space-y-2">
    <div className="flex items-center space-x-3 text-slate-400">
      {icon}
      <span className="text-[10px] uppercase font-black tracking-[0.2em]">{label}</span>
    </div>
    <p className="text-sm font-black text-slate-800 break-words leading-tight" title={value}>{value}</p>
  </div>
);

export default PatientManager;
