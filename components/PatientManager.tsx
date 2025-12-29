
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
  AlertTriangle
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Pacientes</h1>
          <p className="text-slate-500">Base de dados clínica centralizada e segura.</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center space-x-2">
          <UserPlus size={20} />
          <span>Cadastrar Novo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* List Side */}
        <div className={`space-y-4 ${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Nome, CPF ou Prontuário..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Filter size={20} />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Paciente</th>
                  {!selectedPatient && (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Convênio</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-12">Alertas</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => (
                  <tr 
                    key={patient.id} 
                    onClick={() => setSelectedPatient(patient)}
                    className={`group cursor-pointer hover:bg-blue-50/50 transition-colors ${selectedPatient?.id === patient.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 group-hover:scale-105 transition-transform ${patient.allergies.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{patient.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{patient.cpf}</div>
                        </div>
                      </div>
                    </td>
                    {!selectedPatient && (
                      <>
                        <td className="px-6 py-4 text-sm text-slate-600">{patient.phone}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <span className="px-2 py-1 bg-slate-100 rounded-md font-medium">{patient.healthInsurance || 'Particular'}</span>
                        </td>
                        <td className="px-6 py-4 text-right pr-12">
                           <div className="flex justify-end space-x-1">
                             {patient.allergies.length > 0 && <ShieldAlert size={14} className="text-red-500" />}
                             {patient.preExistingConditions.length > 0 && <AlertTriangle size={14} className="text-amber-500" />}
                           </div>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Side */}
        {selectedPatient && (
          <div className="lg:col-span-8 animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden flex flex-col h-full">
              <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-6">
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-inner ${selectedPatient.allergies.length > 0 ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedPatient.name}</h2>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                        <span className="bg-white px-3 py-1 rounded-full border border-slate-200 font-mono">ID: #000{selectedPatient.id}</span>
                        <span>{selectedPatient.birthDate}</span>
                        <span className="font-semibold text-blue-600">{selectedPatient.healthInsurance}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm transition-transform active:scale-95">
                      <Phone size={20} />
                    </button>
                    <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm transition-transform active:scale-95">
                      <Mail size={20} />
                    </button>
                    <button 
                      onClick={() => setSelectedPatient(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-semibold transition-all active:scale-95"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Highlights for Clinical Safety */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={`${selectedPatient.allergies.length > 0 ? 'bg-red-50 border-red-200 shadow-md shadow-red-100/50' : 'bg-slate-50 border-slate-100'} p-6 rounded-3xl border transition-all`}>
                    <div className={`flex items-center space-x-2 mb-3 ${selectedPatient.allergies.length > 0 ? 'text-red-600 font-bold' : 'text-slate-500 font-medium'}`}>
                      <ShieldAlert size={20} />
                      <h4 className="uppercase tracking-wider text-xs">Alergias & Reações Graves</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.allergies.length > 0 ? (
                        selectedPatient.allergies.map(a => (
                          <span key={a} className="bg-red-600 px-3 py-1 rounded-full text-[10px] font-black text-white border border-red-500 uppercase animate-pulse-slow">{a}</span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400 italic">Sem registros de alergias.</span>
                      )}
                    </div>
                  </div>

                  <div className={`${selectedPatient.preExistingConditions.length > 0 ? 'bg-amber-50 border-amber-200 shadow-md shadow-amber-100/50' : 'bg-slate-50 border-slate-100'} p-6 rounded-3xl border transition-all`}>
                    <div className={`flex items-center space-x-2 mb-3 ${selectedPatient.preExistingConditions.length > 0 ? 'text-amber-600 font-bold' : 'text-slate-500 font-medium'}`}>
                      <Activity size={20} />
                      <h4 className="uppercase tracking-wider text-xs">Condições Pré-Existentes</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.preExistingConditions.length > 0 ? (
                        selectedPatient.preExistingConditions.map(c => (
                          <span key={c} className="bg-amber-100 px-3 py-1 rounded-full text-[10px] font-bold text-amber-700 border border-amber-200 uppercase">{c}</span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400 italic">Nenhuma condição crônica reportada.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Clinical/Registration Data */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
                    <Fingerprint size={16} className="mr-2 text-blue-600" />
                    Dados Cadastrais e Clínicos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <InfoBlock icon={<Fingerprint size={16}/>} label="CPF" value={selectedPatient.cpf} />
                    <InfoBlock icon={<Droplets size={16} className="text-red-500"/>} label="Tipo Sanguíneo" value={selectedPatient.bloodType || 'Não Informado'} />
                    <InfoBlock icon={<Phone size={16}/>} label="Telefone" value={selectedPatient.phone} />
                    <div className="md:col-span-2 lg:col-span-3">
                      <InfoBlock icon={<MapPin size={16}/>} label="Endereço Completo" value={selectedPatient.address} />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                  <div className="flex items-center space-x-2 text-blue-600 mb-3">
                    <History size={20} />
                    <h4 className="font-bold uppercase tracking-wider text-xs">Observações e Histórico</h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "{selectedPatient.history}"
                  </p>
                </div>

                {/* Patient Timeline */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                    <FileText size={18} className="mr-2 text-blue-600" />
                    Últimas Evoluções no Prontuário
                  </h3>
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="group flex items-start space-x-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {i}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-800 text-sm">Registro de Evolução Médica</h4>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">12 OUT 2023</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">Paciente em acompanhamento regular. Quadro estável com medicação de uso contínuo...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Exportar Prontuário em PDF</button>
                <div className="flex space-x-3">
                  <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors active:scale-95 shadow-sm">Editar Cadastro</button>
                  <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors active:scale-95">Iniciar Consulta</button>
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
  <div className="space-y-1">
    <div className="flex items-center space-x-2 text-slate-400">
      {icon}
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-semibold text-slate-800 break-words" title={value}>{value}</p>
  </div>
);

export default PatientManager;
