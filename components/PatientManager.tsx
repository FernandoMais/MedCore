
import React, { useState } from 'react';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft,
  FileText, 
  History, 
  AlertTriangle, 
  X, 
  Edit3, 
  Upload, 
  Download, 
  FileIcon, 
  Plus, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  Save,
  User as UserIcon,
  RefreshCw,
  Clock,
  Camera,
  Mic,
  FileDown,
  ExternalLink
} from 'lucide-react';
import { Patient, Gender, Doctor, MedicalFile, User as AppUser } from '../types';
import PatientEvolution from './PatientEvolution';

interface PatientManagerProps {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  doctors: Doctor[];
  isAdmin: boolean;
  currentUser: AppUser;
}

const PatientManager: React.FC<PatientManagerProps> = ({ patients, setPatients, doctors, isAdmin, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingFile, setViewingFile] = useState<MedicalFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;

  const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

  const [formData, setFormData] = useState<any>({
    name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', 
    phone: '', address: '', healthInsurance: '', bloodType: '', 
    allergies: '', preExistingConditions: '', history: '',
    primaryDoctorId: doctors[0]?.id || ''
  });

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cpf.includes(searchTerm)
  );

  const handleSavePDF = () => {
    if (!selectedPatient) return;
    const originalTitle = document.title;
    const safeName = selectedPatient.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    document.title = `Prontuario_${safeName}_${dateStr}`;
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
    setTimeout(restoreTitle, 1000);
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
          newWindow.document.write(`<img src="${file.url}" style="max-width:100%; height:auto; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); margin: 20px auto; display: block;">`);
        }
      }
    } catch (e) {
      console.error("Erro ao abrir arquivo:", e);
      alert("Não foi possível abrir o arquivo nesta aba devido a restrições do navegador. Tente baixar o documento ou verifique se as janelas pop-up estão permitidas.");
    }
  };

  const startEdit = () => {
    if (!selectedPatient) return;
    setFormData({
      ...selectedPatient,
      allergies: selectedPatient.allergies.join(', '),
      preExistingConditions: selectedPatient.preExistingConditions.join(', ')
    });
    setShowEditModal(true);
  };

  const handleSavePatient = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const processedPatient: Patient = {
      ...formData,
      id: showEditModal ? selectedPatient!.id : createId('patient'),
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
    setSelectedPatientId(processedPatient.id);

    setTimeout(() => {
      setIsSaving(false);
      setShowAddModal(false);
      setShowEditModal(false);
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newFile: MedicalFile = {
        id: createId('file'),
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

  const removeFile = (id: string) => {
    if (!selectedPatient || !confirm('Excluir documento permanentemente?')) return;
    setPatients(prev => prev.map(p => 
      p.id === selectedPatient.id ? { ...p, files: p.files.filter(f => f.id !== id) } : p
    ));
  };

  const renderFormattedHistory = (historyText: string) => {
    if (!historyText) return <p className="text-sm italic text-slate-400 p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">Nenhum histórico registrado no prontuário até o momento.</p>;
    const parts = historyText.split(/(\[DATA: .*?\])/);
    return (
      <div className="space-y-4">
        {parts.map((part, index) => {
          if (part.startsWith('[DATA:')) {
            return (
              <div key={index} className="flex items-center space-x-3 pt-6 pb-2 border-b border-slate-100 mt-4 evolution-block-header">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 no-print">
                  <Clock size={16} />
                </div>
                <span className="text-xs font-black text-blue-600 uppercase tracking-[0.2em]">{part.replace(/[\[\]]/g, '')}</span>
              </div>
            );
          }
          if (!part.trim()) return null;
          return (
            <div key={index} className="evolution-block bg-white border border-slate-100 p-8 rounded-[32px] text-sm font-medium text-slate-700 leading-relaxed shadow-sm hover:shadow-md transition-shadow whitespace-pre-wrap">
              {part.trim()}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 h-full pb-10">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between no-print mb-4 alert-banner">
        <div className="flex items-center space-x-3 text-amber-800">
          <ShieldCheck size={20} className="text-amber-600" />
          <p className="text-xs font-bold">Aviso de Privacidade: O MedCore Pro solicita acesso à sua <span className="underline">Câmera</span> e <span className="underline">Microfone</span> apenas para teleconsultas protegidas.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Camera size={16} className="text-amber-400" />
          <Mic size={16} className="text-amber-400" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">Prontuário Médico Digital</h1>
          <p className="text-sm lg:text-base text-slate-500 font-medium tracking-tight">Gestão de histórico clínico cronológico e exames.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button onClick={() => window.open('https://prescricao.cfm.org.br/login', '_blank')} className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs shadow-xl hover:bg-emerald-700 flex items-center justify-center space-x-2 transition-all active:scale-95"><ShieldCheck size={18} /><span>RECEITAS ONLINE</span></button>
          <button onClick={() => { setFormData({ name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', phone: '', address: '', healthInsurance: '', bloodType: '', allergies: '', preExistingConditions: '', history: '', primaryDoctorId: doctors[0]?.id || '' }); setShowAddModal(true); }} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs shadow-xl hover:bg-blue-700 flex items-center justify-center space-x-2 transition-all active:scale-95"><Plus size={20} /><span>NOVO PACIENTE</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className={`space-y-4 transition-all duration-300 no-print ${selectedPatient ? 'hidden lg:block lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Pesquisar por nome ou CPF..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 text-sm font-bold outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden"><table className="w-full text-left"><tbody className="divide-y divide-slate-50">{filteredPatients.map((p) => (<tr key={p.id} onClick={() => setSelectedPatientId(p.id)} className={`group cursor-pointer hover:bg-blue-50/30 transition-all ${selectedPatientId === p.id ? 'bg-blue-50 border-l-8 border-l-blue-600' : ''}`}><td className="px-6 py-5"><div className="flex items-center"><div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black mr-4 ${p.allergies.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{p.name.charAt(0)}</div><div><div className="font-black text-slate-800 text-sm">{p.name}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{p.cpf}</div></div></div></td><td className="px-6 py-5 text-right"><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-all inline-block" /></td></tr>))}</tbody></table></div>
        </div>

        {selectedPatient && (
          <div className="lg:col-span-8 printable-document animate-in slide-in-from-right-8 duration-500">
            <div className="print-only mb-10 border-b-2 border-slate-900 pb-6"><div className="flex justify-between items-center"><div><h1 className="text-2xl font-black text-slate-900">MEDCORE PRO - SISTEMA CLÍNICO</h1><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Relatório de Prontuário Eletrônico</p></div><div className="text-right"><p className="text-xs font-black">Data da Exportação: {new Date().toLocaleDateString('pt-BR')}</p><p className="text-xs font-medium">Unidade: Clínica de Especialidades</p></div></div></div>
            <div className="bg-white border border-slate-200 rounded-[30px] lg:rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-full">
              <div className="p-6 lg:p-10 border-b border-slate-100 bg-slate-50/30">
                <div className="flex flex-col justify-between items-start gap-6">
                  <div className="flex items-center space-x-4 lg:space-x-6 w-full">
                    <button 
                      onClick={() => setSelectedPatientId(null)} 
                      className="lg:hidden p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className={`w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-[32px] flex items-center justify-center text-2xl lg:text-4xl font-black text-white shadow-xl shrink-0 ${selectedPatient.allergies.length > 0 ? 'bg-red-600' : 'bg-blue-600'}`}>{selectedPatient.name.charAt(0)}</div>
                    <div className="overflow-hidden"><h2 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tighter truncate">{selectedPatient.name}</h2><p className="text-[10px] lg:text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">NASC: {new Date(selectedPatient.birthDate).toLocaleDateString('pt-BR')} • CPF: {selectedPatient.cpf}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 no-print w-full">
                    <button onClick={handleSavePDF} className="flex-1 lg:flex-none flex items-center justify-center space-x-3 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest hover:bg-black shadow-xl transition-all active:scale-95"><FileDown size={18} /><span>SALVAR PDF</span></button>
                    <button onClick={startEdit} className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 text-blue-600 shadow-sm transition-all active:scale-95"><Edit3 size={18} /> <span className="lg:hidden text-[10px] font-black uppercase tracking-widest">EDITAR</span></button>
                    <button onClick={() => setSelectedPatientId(null)} className="hidden lg:block p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"><X size={20} /></button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 lg:p-10 space-y-8 lg:space-y-10 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <div className="bg-red-50 p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-red-100 print-alert"><h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4 flex items-center"><AlertTriangle size={14} className="mr-2" /> Alertas de Segurança & Alergias</h3><div className="flex flex-wrap gap-2">{selectedPatient.allergies.length > 0 ? (selectedPatient.allergies.map((a, idx) => <span key={`${a}-${idx}`} className="bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase">{a}</span>)) : <p className="text-[10px] text-red-400 font-bold italic">Nenhuma alergia relatada pelo paciente.</p>}</div></div>
                  <div className="bg-slate-50 p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-100 print-alert"><h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center"><History size={14} className="mr-2 text-blue-500" /> Condições Pré-existentes</h3><div className="flex flex-wrap gap-2">{selectedPatient.preExistingConditions.length > 0 ? (selectedPatient.preExistingConditions.map((c, idx) => <span key={`${c}-${idx}`} className="bg-white border border-slate-200 text-slate-700 text-[9px] font-bold px-3 py-1 rounded-lg uppercase">{c}</span>)) : <p className="text-[10px] text-slate-400 font-bold italic">Sem registros prévios no sistema.</p>}</div></div>
                </div>

                <div className="space-y-6">
                  <PatientEvolution patientId={selectedPatient.id} currentUser={currentUser} />
                </div>

                <div className="space-y-6 pt-8 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center px-2">
                    <History size={18} className="mr-3 text-blue-600" /> 
                    Histórico de Texto (Legado)
                  </h3>
                  <div className="history-content bg-slate-50/30 p-4 rounded-[40px] border border-slate-100">
                    {renderFormattedHistory(selectedPatient.history)}
                  </div>
                </div>

                <div className="space-y-6 no-print pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between"><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center"><FileText size={18} className="mr-3 text-emerald-600" /> Central de Documentos & Laudos Digitais</h3><label className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-xs font-black cursor-pointer hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95"><Upload size={18} /><span>ANEXAR DOCUMENTO</span><input type="file" onChange={handleFileUpload} className="hidden" /></label></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedPatient.files || []).length > 0 ? (selectedPatient.files.map(file => (
                      <div key={file.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                        <div className="flex items-center space-x-4"><div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><FileIcon size={24} /></div><div><p className="text-sm font-black text-slate-800 truncate max-w-[150px]">{file.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{file.category} • {new Date(file.date).toLocaleDateString('pt-BR')}</p></div></div>
                        <div className="flex items-center space-x-2">
                           <button onClick={() => setViewingFile(file)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={18} /></button>
                           <button onClick={() => removeFile(file.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    ))) : <div className="col-span-2 py-12 text-center border-4 border-dashed border-slate-50 rounded-[40px] bg-slate-50/20"><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Aguardando envio de exames ou laudos.</p></div>}
                  </div>
                </div>
              </div>
              <div className="print-only mt-10 border-t border-slate-200 pt-4 text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Este documento foi gerado eletronicamente e contém informações protegidas por sigilo médico.</p><p className="text-[10px] font-bold text-slate-400 mt-1">Página 1 de 1</p></div>
            </div>
          </div>
        )}
      </div>

      {/* Modals for Add/Edit */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"><h2 className="text-2xl font-black text-slate-800 tracking-tight">{showEditModal ? 'Editar Registro Clínico' : 'Novo Paciente'}</h2><button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-3 text-slate-400 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button></div>
            <form onSubmit={handleSavePatient} className="flex-1 overflow-y-auto p-10 space-y-10"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><FormInput label="Nome Completo" value={formData.name} onChange={v => setFormData({...formData, name: v})} required /><FormInput label="CPF" value={formData.cpf} onChange={v => setFormData({...formData, cpf: v})} required /><FormInput label="Data de Nascimento" type="date" value={formData.birthDate} onChange={v => setFormData({...formData, birthDate: v})} required /></div><div className="space-y-6 pt-10 border-t border-slate-100"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Alergias Conhecidas (Separe por vírgula)</label><textarea value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} className="w-full p-4 bg-red-50/50 border border-red-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-200" rows={2} /><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Histórico Resumido</label><textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium leading-relaxed outline-none focus:ring-2 focus:ring-blue-100" placeholder="Descreva aqui o histórico detalhado..." rows={12} /></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Patologias Pré-existentes</label><textarea value={formData.preExistingConditions} onChange={e => setFormData({...formData, preExistingConditions: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" rows={2} /></div></div></div><div className="pt-6 flex justify-end space-x-4 border-t border-slate-100"><button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all">Descartar</button><button type="submit" disabled={isSaving} className="px-12 py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center space-x-2 transition-all hover:bg-blue-700 active:scale-95">{isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}<span>{showEditModal ? 'ATUALIZAR DADOS' : 'SALVAR PACIENTE'}</span></button></div></form>
          </div>
        </div>
      )}

      {/* File Viewer Modal with Fix for Chrome PDF Block */}
      {viewingFile && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-6 no-print">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="text-lg font-black text-slate-800">{viewingFile.name}</h2>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => openFileInNewTab(viewingFile)} 
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
                >
                  <ExternalLink size={16} />
                  <span>Abrir Nativo (Chrome/Edge)</span>
                </button>
                <button onClick={() => setViewingFile(null)} className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all"><X size={28} /></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-8">
              {viewingFile.type.includes('image') ? (
                <img src={viewingFile.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-4 border-white" />
              ) : viewingFile.type.includes('pdf') ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="p-16 bg-white rounded-[48px] shadow-2xl text-center border border-slate-200 max-w-2xl">
                    <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-8 shadow-inner">
                      <FileIcon size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Visualização Segura de PDF</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mb-10">
                      Para garantir a máxima segurança e compatibilidade total com o seu navegador (Chrome, Edge ou Safari), 
                      os documentos PDF são abertos em uma aba protegida utilizando o visualizador nativo do sistema.
                    </p>
                    <button 
                      onClick={() => openFileInNewTab(viewingFile)} 
                      className="inline-flex items-center space-x-4 px-10 py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-2xl shadow-blue-100 transition-all active:scale-95"
                    >
                      <ExternalLink size={20} />
                      <span>VISUALIZAR DOCUMENTO AGORA</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-20 bg-white rounded-[40px] shadow-sm border border-slate-100">
                  <FileIcon size={64} className="mx-auto text-slate-200 mb-6" />
                  <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Arquivo não suportado para visualização direta.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', required }) => (<div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label} {required && '*'}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold shadow-sm transition-all" /></div>);

export default PatientManager;
