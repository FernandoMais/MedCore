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
import RestrictedHistory from './RestrictedHistory';

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
  const [restrictedPassword, setRestrictedPassword] = useState('');
  const [showRestrictedPassword, setShowRestrictedPassword] = useState(false);

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
          return <p key={index} className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap pl-2">{part}</p>;
        })}
      </div>
    );
  };

  const restrictedEntries = selectedPatient?.history ? selectedPatient.history.split('--------------------------------------------------').filter(Boolean).slice(0, 20) : [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Pacientes</h1>
          <p className="text-slate-500 font-medium">Gestão clínica e histórico dos pacientes.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`space-y-4 transition-all duration-300 ${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          {filteredPatients.map((patient) => (
            <div key={patient.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm cursor-pointer" onClick={() => setSelectedPatientId(patient.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800">{patient.name}</h3>
                  <p className="text-xs text-slate-400">CPF {patient.cpf}</p>
                </div>
                {patient.selfRegistered && <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Auto</span>}
              </div>
            </div>
          ))}
        </div>

        {selectedPatient && (
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedPatient.name}</h2>
                  <p className="text-slate-500 text-sm">CPF {selectedPatient.cpf}</p>
                </div>
                <button type="button" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest" onClick={() => setShowRestrictedPassword(true)}>
                  Acesso Restrito
                </button>
              </div>

              {showRestrictedPassword ? (
                <RestrictedHistory patientId={selectedPatient.id} currentUserName={currentUser.name} entries={restrictedEntries} adminGeneratedPassword={restrictedPassword} />
              ) : (
                <div className="space-y-4">
                  <button type="button" className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-widest" onClick={() => setShowRestrictedPassword(true)}>
                    Ver histórico sigiloso
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientManager;
