
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Pill, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  ChevronRight,
  Info,
  Beaker,
  Stethoscope
} from 'lucide-react';
import { Medication } from '../types';

interface MedicationRegistryProps {
  medications: Medication[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
}

const MedicationRegistry: React.FC<MedicationRegistryProps> = ({ medications, setMedications }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  
  const [formData, setFormData] = useState<Partial<Medication>>({
    name: '',
    dosage: '',
    posology: '',
    period: '',
    purpose: '',
    manufacturer: ''
  });

  const filteredMedications = medications.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

  const handleOpenModal = (med?: Medication) => {
    if (med) {
      setEditingMedication(med);
      setFormData(med);
    } else {
      setEditingMedication(null);
      setFormData({ name: '', dosage: '', posology: '', period: '', purpose: '', manufacturer: '' });
    }
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.dosage) {
      alert("Nome e Dosagem são obrigatórios.");
      return;
    }

    if (editingMedication) {
      setMedications(prev => prev.map(m => m.id === editingMedication.id ? { ...formData as Medication } : m));
    } else {
      const newMed: Medication = {
        ...formData as Medication,
        id: createId('med')
      };
      setMedications(prev => [newMed, ...prev]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir este medicamento do cadastro?")) {
      setMedications(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Cadastro de Medicamentos</h1>
          <p className="text-slate-500 font-medium">Gerencie o catálogo de medicamentos para prescrição rápida.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>CADASTRAR MEDICAMENTO</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou finalidade..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMedications.map((med) => (
          <div key={med.id} className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Pill size={24} />
              </div>
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(med)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit3 size={18} /></button>
                <button onClick={() => handleDelete(med.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-800 tracking-tight mb-1">{med.name}</h3>
              <p className="text-blue-600 font-bold text-sm mb-4">{med.dosage}</p>
              
              <div className="space-y-3">
                {med.purpose && (
                  <div className="flex items-start space-x-2">
                    <Info size={14} className="text-slate-300 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">{med.purpose}</p>
                  </div>
                )}
                {med.manufacturer && (
                  <div className="flex items-center space-x-2">
                    <Beaker size={14} className="text-slate-300 shrink-0" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{med.manufacturer}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Favorito para Prescrição</span>
              <ChevronRight size={18} className="text-slate-200" />
            </div>
          </div>
        ))}
        {filteredMedications.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white border border-slate-200 border-dashed rounded-[40px]">
            <Pill size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum medicamento encontrado.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingMedication ? 'Editar Medicamento' : 'Novo Medicamento'}</h2>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Nome do Medicamento *" value={formData.name || ''} onChange={v => setFormData({...formData, name: v})} required />
                <FormInput label="Dosagem *" placeholder="Ex: 500mg, 5ml" value={formData.dosage || ''} onChange={v => setFormData({...formData, dosage: v})} required />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Posologia Padrão</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={formData.posology || ''}
                  onChange={e => setFormData({...formData, posology: e.target.value})}
                  placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Período de Uso" placeholder="Ex: 7 dias, contínuo" value={formData.period || ''} onChange={v => setFormData({...formData, period: v})} />
                <FormInput label="Laboratório / Fabricante" value={formData.manufacturer || ''} onChange={v => setFormData({...formData, manufacturer: v})} />
              </div>

              <FormInput label="Finalidade / Classe" placeholder="Ex: Antibiótico, Analgésico" value={formData.purpose || ''} onChange={v => setFormData({...formData, purpose: v})} />

              <div className="pt-6 flex justify-end space-x-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-slate-700">Cancelar</button>
                <button type="submit" className="px-10 py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition-all flex items-center space-x-2">
                  <Save size={18} />
                  <span>SALVAR MEDICAMENTO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', placeholder, required }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
    />
  </div>
);

export default MedicationRegistry;
