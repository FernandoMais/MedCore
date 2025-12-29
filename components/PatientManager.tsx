
import React, { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  MoreHorizontal, 
  FileText, 
  History, 
  Phone, 
  Mail,
  ShieldAlert,
  ChevronRight,
  Filter
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
          <p className="text-slate-500">Base de dados completa e histórico clínico.</p>
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
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Última Consulta</th>
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
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 mr-3 group-hover:bg-white transition-colors">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{patient.name}</div>
                          <div className="text-xs text-slate-400">{patient.cpf}</div>
                        </div>
                      </div>
                    </td>
                    {!selectedPatient && (
                      <>
                        <td className="px-6 py-4 text-sm text-slate-600">{patient.phone}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <span className="px-2 py-1 bg-slate-100 rounded-md">{patient.healthInsurance || 'Particular'}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">12/03/2024</td>
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
                    <div className="w-24 h-24 bg-blue-100 rounded-3xl flex items-center justify-center text-4xl font-bold text-blue-600 shadow-inner">
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedPatient.name}</h2>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                        <span className="bg-white px-3 py-1 rounded-full border border-slate-200">ID: #000{selectedPatient.id}</span>
                        <span>{selectedPatient.birthDate} (38 anos)</span>
                        <span className="font-semibold text-blue-600">{selectedPatient.healthInsurance}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm">
                      <Phone size={20} />
                    </button>
                    <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm">
                      <Mail size={20} />
                    </button>
                    <button 
                      onClick={() => setSelectedPatient(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-semibold transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Critical Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                    <div className="flex items-center space-x-2 text-red-600 mb-3">
                      <ShieldAlert size={20} />
                      <h4 className="font-bold">Alergias & Restrições</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.allergies.length > 0 ? (
                        selectedPatient.allergies.map(a => (
                          <span key={a} className="bg-white px-3 py-1 rounded-full text-xs font-bold text-red-600 border border-red-200 uppercase">{a}</span>
                        ))
                      ) : (
                        <span className="text-sm text-red-400 italic">Nenhuma alergia informada.</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <div className="flex items-center space-x-2 text-blue-600 mb-3">
                      <History size={20} />
                      <h4 className="font-bold">Histórico Resumido</h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedPatient.history}
                    </p>
                  </div>
                </div>

                {/* Tabs / Timeline */}
                <div>
                  <div className="flex border-b border-slate-100 mb-6">
                    <button className="px-6 py-3 border-b-2 border-blue-600 text-blue-600 font-bold text-sm">Cronologia</button>
                    <button className="px-6 py-3 text-slate-400 font-medium text-sm hover:text-slate-600">Documentos</button>
                    <button className="px-6 py-3 text-slate-400 font-medium text-sm hover:text-slate-600">Exames</button>
                    <button className="px-6 py-3 text-slate-400 font-medium text-sm hover:text-slate-600">Financeiro</button>
                  </div>

                  <div className="space-y-6">
                    {[1, 2].map((i) => (
                      <div key={i} className="relative pl-8 before:content-[''] before:absolute before:left-3 before:top-1 before:bottom-0 before:w-px before:bg-slate-100 last:before:hidden">
                        <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-blue-600 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Consulta de Rotina</span>
                            <span className="text-xs text-slate-400">12 Out, 2023 • 14:30</span>
                          </div>
                          <h4 className="font-bold text-slate-800">Hipertensão Estágio I</h4>
                          <p className="text-sm text-slate-500 mt-2 line-clamp-2">Paciente apresenta melhora nos níveis tensionais após início de terapia medicamentosa com Losartana 50mg...</p>
                          <div className="mt-4 flex space-x-2">
                            <button className="flex items-center text-xs font-bold text-blue-600 hover:underline">
                              <FileText size={14} className="mr-1" /> Ver Prontuário Completo
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button className="text-sm font-semibold text-slate-500 hover:text-slate-800">Exportar PDF</button>
                <div className="flex space-x-3">
                  <button className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors">Editar Perfil</button>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">Nova Consulta</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientManager;
