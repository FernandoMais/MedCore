
import React, { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Filter, 
  Stethoscope, 
  ShieldCheck,
  Award,
  X,
  Check,
  Edit3,
  Trash2,
  PlusCircle,
  Save,
  Lock,
  User as UserIcon,
  Shield
} from 'lucide-react';
import { Doctor, DoctorSchedule, User, UserRole } from '../types';

interface DoctorRegistryProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const DoctorRegistry: React.FC<DoctorRegistryProps> = ({ doctors, setDoctors, setUsers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Doctor being viewed/edited
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId) || null;

  // Edit State
  const [editFormData, setEditFormData] = useState<Doctor | null>(null);

  // Form State for NEW Doctor
  const [formData, setFormData] = useState({
    name: '',
    crm: '',
    specialty: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: UserRole.DOCTOR
  });

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.crm.includes(searchTerm)
  );

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    const doctorId = 'd' + Date.now().toString();
    
    // Create Doctor Record
    const newDoctor: Doctor = {
      id: doctorId,
      name: formData.name,
      crm: formData.crm,
      specialty: formData.specialty,
      email: formData.email,
      phone: formData.phone,
      availableTimes: [
        { dayOfWeek: 'Segunda', startTime: '08:00', endTime: '18:00' }
      ]
    };

    // Create User Record
    const newUser: User = {
      id: 'u' + Date.now().toString(),
      username: formData.username,
      password: formData.password,
      name: formData.name,
      role: formData.role,
      doctorId: doctorId
    };

    setDoctors(prev => [newDoctor, ...prev]);
    setUsers(prev => [newUser, ...prev]);
    
    setShowAddModal(false);
    setFormData({ 
      name: '', crm: '', specialty: '', email: '', phone: '', 
      username: '', password: '', role: UserRole.DOCTOR 
    });
    alert('Profissional e usuário de acesso criados com sucesso!');
  };

  const startEditing = () => {
    if (selectedDoctor) {
      setEditFormData({ ...selectedDoctor });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (editFormData) {
      setDoctors(prev => prev.map(d => d.id === editFormData.id ? editFormData : d));
      setIsEditing(false);
    }
  };

  const addScheduleItem = () => {
    if (editFormData) {
      const newItem: DoctorSchedule = { dayOfWeek: 'Segunda', startTime: '08:00', endTime: '12:00' };
      setEditFormData({
        ...editFormData,
        availableTimes: [...editFormData.availableTimes, newItem]
      });
    }
  };

  const removeScheduleItem = (index: number) => {
    if (editFormData) {
      const newTimes = [...editFormData.availableTimes];
      newTimes.splice(index, 1);
      setEditFormData({ ...editFormData, availableTimes: newTimes });
    }
  };

  const updateScheduleItem = (index: number, field: keyof DoctorSchedule, value: string) => {
    if (editFormData) {
      const newTimes = [...editFormData.availableTimes];
      newTimes[index] = { ...newTimes[index], [field]: value };
      setEditFormData({ ...editFormData, availableTimes: newTimes });
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Corpo Clínico</h1>
          <p className="text-slate-500 font-medium">Gestão estratégica dos profissionais de saúde.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center space-x-2"
        >
          <UserPlus size={18} />
          <span>CADASTRAR PROFISSIONAL</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Doctors Grid/List */}
        <div className={`space-y-4 transition-all duration-300 ${selectedDoctor ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome, CRM ou especialidade..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">
              <Filter size={20} />
            </button>
          </div>

          <div className={`grid gap-4 ${selectedDoctor ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {filteredDoctors.map((doctor) => (
              <div 
                key={doctor.id} 
                onClick={() => { setSelectedDoctorId(doctor.id); setIsEditing(false); }}
                className={`group cursor-pointer bg-white border rounded-[32px] p-6 transition-all hover:shadow-xl ${
                  selectedDoctorId === doctor.id 
                    ? 'border-blue-500 ring-4 ring-blue-500/5' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border transition-all shadow-inner ${
                    selectedDoctorId === doctor.id ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-50 text-blue-600 border-slate-100'
                  }`}>
                    {doctor.name.split(' ').filter(n => n.length > 2).map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                    <Award size={18} />
                  </div>
                </div>
                
                <div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors leading-tight">{doctor.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Stethoscope size={14} className="text-blue-500" />
                    <span className="text-sm font-bold text-blue-600">{doctor.specialty}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-widest font-black">CRM {doctor.crm}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {['S', 'T', 'Q', 'Q', 'S'].map((day, i) => {
                      const dayMap = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
                      const hasDay = doctor.availableTimes.some(t => t.dayOfWeek === dayMap[i]);
                      return (
                        <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black ${
                          hasDay ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {day}
                        </div>
                      );
                    })}
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail/Edit Panel */}
        {selectedDoctor && (
          <div className="lg:col-span-8 animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-full sticky top-8">
              {/* Header */}
              <div className="p-10 border-b border-slate-100 bg-slate-50/50 relative">
                <button 
                  onClick={() => setSelectedDoctorId(null)}
                  className="absolute top-10 right-10 p-3 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:shadow-md transition-all z-10"
                >
                  <X size={20} />
                </button>
                
                <div className="flex items-center space-x-8">
                  <div className="w-28 h-28 bg-blue-600 rounded-[36px] flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-200 ring-8 ring-white">
                    {selectedDoctor.name.split(' ').filter(n => n.length > 2).map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <input 
                        className="text-3xl font-black text-slate-900 bg-white border-b-2 border-blue-500 outline-none w-full"
                        value={editFormData?.name}
                        onChange={e => setEditFormData(prev => prev ? {...prev, name: e.target.value} : null)}
                      />
                    ) : (
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedDoctor.name}</h2>
                    )}
                    
                    {isEditing ? (
                      <input 
                        className="text-blue-600 font-bold text-xl bg-white border-b border-blue-200 outline-none w-full mt-2"
                        value={editFormData?.specialty}
                        onChange={e => setEditFormData(prev => prev ? {...prev, specialty: e.target.value} : null)}
                      />
                    ) : (
                      <p className="text-blue-600 font-bold text-xl mt-1">{selectedDoctor.specialty}</p>
                    )}

                    <div className="flex items-center space-x-4 mt-4">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase">CRM:</span>
                           <input 
                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                            value={editFormData?.crm}
                            onChange={e => setEditFormData(prev => prev ? {...prev, crm: e.target.value} : null)}
                          />
                        </div>
                      ) : (
                        <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">CRM {selectedDoctor.crm}</span>
                      )}
                      <span className="flex items-center text-emerald-500 text-xs font-black uppercase tracking-widest">
                        <ShieldCheck size={16} className="mr-2" /> Credenciado Ativo
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                {/* Contact Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Mail size={12} className="mr-2" /> E-mail Profissional
                    </p>
                    {isEditing ? (
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none"
                        value={editFormData?.email}
                        onChange={e => setEditFormData(prev => prev ? {...prev, email: e.target.value} : null)}
                      />
                    ) : (
                      <div className="text-slate-800 font-black text-sm">{selectedDoctor.email}</div>
                    )}
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Phone size={12} className="mr-2" /> Telefone Direto
                    </p>
                    {isEditing ? (
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none"
                        value={editFormData?.phone}
                        onChange={e => setEditFormData(prev => prev ? {...prev, phone: e.target.value} : null)}
                      />
                    ) : (
                      <div className="text-slate-800 font-black text-sm">{selectedDoctor.phone}</div>
                    )}
                  </div>
                </div>

                {/* Schedule Management */}
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] flex items-center">
                      <Clock size={18} className="mr-3 text-blue-600" />
                      Configuração da Agenda de Atendimento
                    </h3>
                    {isEditing && (
                      <button 
                        onClick={addScheduleItem}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-black text-[10px] uppercase tracking-widest"
                      >
                        <PlusCircle size={16} />
                        <span>Adicionar Turno</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(isEditing ? editFormData?.availableTimes : selectedDoctor.availableTimes)?.map((time, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-lg transition-all group">
                        <div className="flex items-center space-x-6 mb-4 sm:mb-0">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                            {time.dayOfWeek.substring(0, 3)}
                          </div>
                          
                          {isEditing ? (
                            <select 
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                              value={time.dayOfWeek}
                              onChange={e => updateScheduleItem(idx, 'dayOfWeek', e.target.value)}
                            >
                              {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          ) : (
                            <span className="font-black text-slate-800 tracking-tight">{time.dayOfWeek}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                            {isEditing ? (
                              <>
                                <input 
                                  type="time" 
                                  className="bg-transparent text-xs font-black text-slate-700 outline-none" 
                                  value={time.startTime}
                                  onChange={e => updateScheduleItem(idx, 'startTime', e.target.value)}
                                />
                                <span className="text-slate-300 mx-2">—</span>
                                <input 
                                  type="time" 
                                  className="bg-transparent text-xs font-black text-slate-700 outline-none" 
                                  value={time.endTime}
                                  onChange={e => updateScheduleItem(idx, 'endTime', e.target.value)}
                                />
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-black text-slate-600">{time.startTime}</span>
                                <span className="text-[10px] text-slate-300 font-bold">ATÉ</span>
                                <span className="text-xs font-black text-slate-600">{time.endTime}</span>
                              </>
                            )}
                          </div>

                          {isEditing && (
                            <button 
                              onClick={() => removeScheduleItem(idx)}
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {isEditing && editFormData?.availableTimes.length === 0 && (
                      <div className="py-12 text-center border-4 border-dashed border-slate-50 rounded-[40px]">
                        <p className="text-slate-400 font-bold">Nenhum horário configurado para este médico.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end space-x-4">
                {isEditing ? (
                  <>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="px-10 py-4 bg-white border border-slate-200 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                      Descartar
                    </button>
                    <button 
                      onClick={handleSaveEdit}
                      className="px-12 py-4 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center space-x-2"
                    >
                      <Save size={18} />
                      <span>Salvar Alterações</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={startEditing}
                      className="px-10 py-4 bg-white border border-slate-200 text-slate-700 rounded-3xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all flex items-center space-x-2"
                    >
                      <Edit3 size={18} />
                      <span>Editar Perfil</span>
                    </button>
                    <button className="px-12 py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">
                      Gerenciar Escalas
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Doctor Modal (Formulário Original com Design Polido) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cadastrar Novo Profissional</h2>
                <p className="text-sm text-slate-500 font-medium">Inicie o registro e defina o perfil de acesso.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddDoctor} className="p-10 space-y-10 overflow-y-auto">
              {/* Seção Dados Profissionais */}
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                  <Stethoscope className="text-blue-600" size={20} />
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dados Profissionais</h3>
                </div>
                <FormInput label="Nome Completo" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
                <div className="grid grid-cols-2 gap-6">
                  <FormInput label="CRM Profissional" placeholder="000000/UF" value={formData.crm} onChange={v => setFormData({...formData, crm: v})} required />
                  <FormInput label="Especialidade" placeholder="Ex: Cardiologia" value={formData.specialty} onChange={v => setFormData({...formData, specialty: v})} required />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <FormInput label="E-mail Corporativo" type="email" value={formData.email} onChange={v => setFormData({...formData, email: v})} required />
                  <FormInput label="Telefone / Celular" placeholder="(00) 00000-0000" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} required />
                </div>
              </div>

              {/* Seção Segurança e Acesso */}
              <div className="space-y-6 pt-10 border-t border-slate-100">
                <div className="flex items-center space-x-3 mb-2">
                  <Shield className="text-blue-600" size={20} />
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Segurança e Acesso ao Sistema</h3>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perfil de Acesso (Papel) *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, role: UserRole.DOCTOR})}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${formData.role === UserRole.DOCTOR ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                    >
                      <Stethoscope size={20} />
                      <span className="font-black text-xs uppercase tracking-widest">Usuário Médico</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, role: UserRole.ADMIN})}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${formData.role === UserRole.ADMIN ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                    >
                      <Shield size={20} />
                      <span className="font-black text-xs uppercase tracking-widest">Administrativo</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    {formData.role === UserRole.ADMIN 
                      ? "O perfil ADMINISTRATIVO possui acesso total a todos os dados, configurações e backups."
                      : "O perfil MÉDICO possui acesso restrito apenas aos seus pacientes vinculados."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome de Usuário (Acesso) *</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="text"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        required
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold"
                        placeholder="Ex: dr.silva"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        required
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center space-x-4">
                <Clock className="text-blue-600" size={24} />
                <p className="text-[10px] text-blue-800 font-bold leading-relaxed uppercase tracking-wider">
                  O VÍNCULO ENTRE PROFISSIONAL E USUÁRIO É CRIADO AUTOMATICAMENTE. APÓS O CADASTRO, O PROFISSIONAL JÁ PODERÁ REALIZAR LOGIN COM AS CREDENCIAIS ACIMA.
                </p>
              </div>

              <div className="pt-6 flex justify-end space-x-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center space-x-2"
                >
                  <Check size={18} />
                  <span>Confirmar e Criar Acesso</span>
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
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label} {required && '*'}</label>
    <input 
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold placeholder:text-slate-300 transition-all"
    />
  </div>
);

export default DoctorRegistry;
