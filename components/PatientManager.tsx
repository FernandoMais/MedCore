
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail,
  ShieldAlert,
  ChevronRight,
  Filter,
  MapPin,
  Activity,
  Droplets,
  FileText,
  History,
  AlertTriangle,
  User as UserIcon,
  Printer,
  X,
  Check,
  RefreshCw,
  Edit3,
  Upload,
  Download,
  FileIcon,
  Plus,
  Trash2,
  Eye,
  ExternalLink,
  ShieldCheck,
  Save
} from 'lucide-react';
import { Patient, Gender, Doctor, MedicalFile } from '../types';

interface PatientManagerProps {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  doctors: Doctor[];
  isAdmin: boolean;
}

const PatientManager: React.FC<PatientManagerProps> = ({ patients, setPatients, doctors, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [viewingFile, setViewingFile] = useState<MedicalFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;

  const [formData, setFormData] = useState<any>({
    name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', 
    phone: '', address: '', healthInsurance: '', bloodType: '', 
    allergies: '', preExistingConditions: '', history: '',
    primaryDoctorId: doctors[0]?.id || ''
  });

  // Efeito para Auto-save de rascunho enquanto edita
  useEffect(() => {
    if (showEditModal || showAddModal) {
      const timer = setTimeout(() => {
        localStorage.setItem('medcore_draft_patient', JSON.stringify(formData));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, showEditModal, showAddModal]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cpf.includes(searchTerm)
  );

  const startEdit = () => {
    if (!selectedPatient) return;
    setFormData({
      ...selectedPatient,
      allergies: selectedPatient.allergies.join(', '),
      preExistingConditions: selectedPatient.preExistingConditions.join(', ')
    });
    setShowEditModal(true);
  };

  const handleSavePatient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const processedPatient: Patient = {
      ...formData,
      id: showEditModal ? selectedPatient!.id : Date.now().toString(),
      allergies: typeof formData.allergies === 'string' ? formData.allergies.split(',').map((a: string) => a.trim()).filter((a: string) => a !== '') : formData.allergies,
      preExistingConditions: typeof formData.preExistingConditions === 'string' ? formData.preExistingConditions.split(',').map((c: string) => c.trim()).filter((c: string) => c !== '') : formData.preExistingConditions,
      createdAt: showEditModal ? selectedPatient!.createdAt : new Date().toISOString(),
      files: showEditModal ? selectedPatient!.files : []
    };

    setPatients(prev => {
      if (showEditModal) {
        return prev.map(p => p.id === processedPatient.id ? processedPatient : p);
      }
      return [processedPatient, ...prev];
    });
    
    setTimeout(() => {
      setIsSaving(false);
      if (e) {
        setShowAddModal(false);
        setShowEditModal(false);
        localStorage.removeItem('medcore_draft_patient');
      }
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newFile: MedicalFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name, type: file.type, size: file.size,
        date: new Date().toISOString(),
        url: event.target?.result as string,
        category: file.type.includes('pdf') ? 'Laudo' : (file.type.includes('image') ? 'Exame' : 'Outros')
      };

      setPatients(prev => prev.map(p => 
        p.id === selectedPatient.id ? { ...p, files: [...(p.files || []), newFile] } : p
      ));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Pacientes</h1>
          <p className="text-slate-500 font-medium">Controle de prontuários e histórico clínico.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => window.open('https://prescricao.cfm.org.br/login', '_blank')}
            className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center space-x-2"
          >
            <ShieldCheck size={18} />
            <span>PRESCRIÇÃO CFM</span>
          </button>
          <button 
            onClick={() => {
              const draft = localStorage.getItem('medcore_draft_patient');
              if (draft && confirm('Deseja recuperar o rascunho do último cadastro não finalizado?')) {
                setFormData(JSON.parse(draft));
              } else {
                setFormData({
                  name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', 
                  phone: '', address: '', healthInsurance: '', bloodType: '', 
                  allergies: '', preExistingConditions: '', history: '',
                  primaryDoctorId: doctors[0]?.id || ''
                });
              }
              setShowAddModal(true);
            }}
            className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>NOVO PACIENTE</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`space-y-4 transition-all duration-300 no-print ${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou CPF..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 text-sm font-bold outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-50">
                {filteredPatients.map((p) => (
                  <tr key={p.id} onClick={() => setSelectedPatientId(p.id)} className={`group cursor-pointer hover:bg-blue-50/30 transition-all ${selectedPatientId === p.id ? 'bg-blue-50 border-l-8 border-l-blue-600' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex items-center">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black mr-4 ${p.allergies.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-sm">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{p.cpf}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {p.allergies.length > 0 && <AlertTriangle size={16} className="text-red-500 inline-block mr-2" />}
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-all inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedPatient && (
          <div className="lg:col-span-8 animate-in slide-in-from-right-8 duration-500 printable-document">
            <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-full sticky top-8">
              <div className="p-10 border-b border-slate-100 bg-slate-50/30">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-8">
                    <div className={`w-28 h-28 rounded-[40px] flex items-center justify-center text-5xl font-black shadow-2xl ${selectedPatient.allergies.length > 0 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{selectedPatient.name}</h2>
                      <div className="flex flex-wrap gap-2 mt-3 no-print">
                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">{selectedPatient.gender}</span>
                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">{new Date().getFullYear() - new Date(selectedPatient.birthDate).getFullYear()} anos</span>
                      </div>
                      <div className="hidden print-only mt-2">
                        <p className="text-lg font-black text-slate-800">PRONTUÁRIO MÉDICO DIGITAL</p>
                        <p className="text-sm font-bold text-slate-600">CPF: {selectedPatient.cpf} | NASC: {new Date(selectedPatient.birthDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3 no-print">
                    <button 
                      onClick={() => window.print()}
                      className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-black shadow-lg flex items-center space-x-3"
                      title="Imprimir Resumo para Prontuário"
                    >
                      <Printer size={22} />
                      <span className="text-xs font-black uppercase tracking-widest">IMPRIMIR RESUMO PARA PRONTUÁRIO</span>
                    </button>
                    <button onClick={startEdit} className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-blue-600 shadow-sm" title="Editar Informações Clínicas"><Edit3 size={22} /></button>
                    <button onClick={() => setSelectedPatientId(null)} className="px-8 py-3 bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition-all">FECHAR</button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                <div className="grid grid-cols-1 gap-8">
                  <div className="bg-red-50 p-8 rounded-[32px] border border-red-100 space-y-4 print-alert">
                    <h3 className="text-xs font-black text-red-600 uppercase tracking-widest flex items-center">
                      <AlertTriangle size={16} className="mr-2" /> Alertas Críticos & Alergias Ativas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.allergies.length > 0 ? (
                        selectedPatient.allergies.map(a => <span key={a} className="bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-xl uppercase shadow-sm">{a}</span>)
                      ) : <p className="text-xs text-red-400 font-bold italic">Nenhuma alergia relatada pelo paciente.</p>}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center">
                        <History size={16} className="mr-2 text-blue-500" /> Histórico Resumido & Doenças Pré-existentes
                      </h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Doenças e Condições Atuais</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedPatient.preExistingConditions.length > 0 ? (
                            selectedPatient.preExistingConditions.map(c => <span key={c} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-lg uppercase">{c}</span>)
                          ) : <p className="text-xs text-slate-400 font-bold">Sem registros de doenças pré-existentes.</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Evolução Histórica e Notas Clínicas</p>
                        <div className="text-sm font-medium text-slate-700 leading-relaxed bg-white p-6 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                          {selectedPatient.history || 'Nenhuma nota histórica registrada no prontuário.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 no-print">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><FileText size={18} className="mr-3 text-blue-600" /> Central de Exames & Documentos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedPatient.files || []).map(file => (
                      <div key={file.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><FileIcon size={24} /></div>
                          <div>
                            <p className="text-sm font-black text-slate-800 truncate max-w-[150px]">{file.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{file.category} • {new Date(file.date).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                           <button onClick={() => setViewingFile(file)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Eye size={18} /></button>
                           <a href={file.url} download={file.name} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"><Download size={18} /></a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição com Auto-save reforçado */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 no-print">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserIcon size={24} /></div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{showEditModal ? 'Atualizar Prontuário' : 'Novo Paciente'}</h2>
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <RefreshCw size={12} className={isSaving ? 'animate-spin' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Proteção de dados ativa: Salvando alterações...</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-3 text-slate-400 hover:bg-slate-200 rounded-2xl transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSavePatient} className="flex-1 overflow-y-auto p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormInput label="Nome Completo" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
                <FormInput label="CPF" value={formData.cpf} onChange={v => setFormData({...formData, cpf: v})} required />
                <FormInput label="Data de Nascimento" type="date" value={formData.birthDate} onChange={v => setFormData({...formData, birthDate: v})} required />
              </div>

              <div className="space-y-6 pt-10 border-t border-slate-100">
                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest border-l-4 border-red-600 pl-3">Informações de Segurança Clínica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alergias (Separe por vírgula)</label>
                      <textarea 
                        value={formData.allergies} 
                        onChange={e => setFormData({...formData, allergies: e.target.value})} 
                        className="w-full p-4 bg-red-50/50 border border-red-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none text-sm font-bold text-red-900"
                        placeholder="Ex: Penicilina, Dipirona..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doenças Prévias</label>
                      <textarea 
                        value={formData.preExistingConditions} 
                        onChange={e => setFormData({...formData, preExistingConditions: e.target.value})} 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico Clínico Detalhado (Auto-save)</label>
                      <textarea 
                        value={formData.history} 
                        onChange={e => setFormData({...formData, history: e.target.value})} 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium leading-relaxed"
                        placeholder="Escreva aqui o histórico completo, as notas das consultas e observações importantes..."
                        rows={8}
                      />
                      <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1">O sistema salva rascunhos automaticamente para evitar perda de dados.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end space-x-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-12 py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center space-x-3 transition-all active:scale-95"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>{showEditModal ? 'ATUALIZAR REGISTRO DEFINITIVO' : 'CADASTRAR E SALVAR'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6 no-print">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800">{viewingFile.name}</h2>
              <button onClick={() => setViewingFile(null)} className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl"><X size={28} /></button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-8">
              {viewingFile.type.includes('image') ? <img src={viewingFile.url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" /> : viewingFile.type.includes('pdf') ? <iframe src={viewingFile.url} className="w-full h-full rounded-xl" /> : <div className="text-center p-12 bg-white rounded-3xl shadow-sm"><FileIcon size={48} className="mx-auto text-slate-200 mb-4" /><p className="font-bold text-slate-500">Visualização indisponível. Baixe o arquivo para ler.</p><a href={viewingFile.url} download={viewingFile.name} className="mt-4 inline-block text-blue-600 font-black text-xs uppercase border-b-2 border-blue-600">Baixar agora</a></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', required }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label} {required && '*'}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold" />
  </div>
);

export default PatientManager;
