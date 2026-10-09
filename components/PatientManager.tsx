import React, { useState } from 'react';
import { 
  Search, 
  FileText, 
  X, 
  Edit3,
  Upload,
  Download,
  FileIcon, 
  Plus, 
  Trash2, 
  Eye,
  Save,
  User as UserIcon,
  Clock,
  FileDown,
  ExternalLink,
  FileLock2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Home
} from 'lucide-react';
import { Patient, Gender, Doctor, MedicalFile, User as AppUser, SigilousNote, UserRole } from '../types';
import RestrictedHistory from './RestrictedHistory';
import PatientEvolution from './PatientEvolution';
import { supabase } from '../services/supabase';
import { requestAdminPatientReset } from '../services/patientAuth';

interface PatientManagerProps {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  doctors: Doctor[];
  isAdmin: boolean;
  currentUser: AppUser;
  sigilousNotes?: SigilousNote[];
  onBackHome?: () => void;
}

const inputCls = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all';

type PatientAuthMetadata = Patient & { authUserId?: string; pendingAuthUserId?: string; clinicId?: string };

const PatientManager: React.FC<PatientManagerProps> = ({ patients, setPatients, doctors, isAdmin, currentUser, sigilousNotes = [], onBackHome }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingPatientId, setResettingPatientId] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<{ patientId: string; kind: 'success' | 'error'; message: string } | null>(null);
  const [showSigilous, setShowSigilous] = useState(false);
  const [sigilousUnlocked, setSigilousUnlocked] = useState(false);
  const [sigilousInput, setSigilousInput] = useState('');
  const [sigilousError, setSigilousError] = useState('');
  const [showSigilousInput, setShowSigilousInput] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;
  const selectedPatientHasAuthAccount = Boolean(
    showEditModal &&
    selectedPatient &&
    ((selectedPatient as PatientAuthMetadata).authUserId || (selectedPatient as PatientAuthMetadata).pendingAuthUserId || selectedPatient.portalEnrollmentPending)
  );

  const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

  const [formData, setFormData] = useState<any>({
    name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', 
    phone: '', address: '', healthInsurance: '', bloodType: '', 
    allergies: '', preExistingConditions: '', history: '',
    primaryDoctorId: doctors[0]?.id || ''
  });

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cpf.includes(searchTerm) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = () => {
    if (!selectedPatient) return;
    setFormData({
      name: selectedPatient.name,
      birthDate: selectedPatient.birthDate,
      gender: selectedPatient.gender,
      cpf: selectedPatient.cpf,
      email: selectedPatient.email,
      phone: selectedPatient.phone,
      address: selectedPatient.address,
      healthInsurance: selectedPatient.healthInsurance || '',
      bloodType: selectedPatient.bloodType || '',
      allergies: selectedPatient.allergies.join(', '),
      preExistingConditions: selectedPatient.preExistingConditions.join(', '),
      history: selectedPatient.history,
      primaryDoctorId: selectedPatient.primaryDoctorId
    });
    setShowEditModal(true);
  };

  const handleSavePatient = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const originalPatient = showEditModal ? selectedPatient as PatientAuthMetadata : null;
    const processedPatient: PatientAuthMetadata = {
      id: showEditModal ? selectedPatient!.id : createId('patient'),
      name: formData.name,
      birthDate: formData.birthDate,
      gender: formData.gender,
      cpf: formData.cpf,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      healthInsurance: formData.healthInsurance || undefined,
      bloodType: formData.bloodType || undefined,
      allergies: typeof formData.allergies === 'string' ? formData.allergies.split(',').map((a: string) => a.trim()).filter((a: string) => a !== '') : formData.allergies,
      preExistingConditions: typeof formData.preExistingConditions === 'string' ? formData.preExistingConditions.split(',').map((c: string) => c.trim()).filter((c: string) => c !== '') : formData.preExistingConditions,
      history: formData.history || '',
      createdAt: showEditModal ? selectedPatient!.createdAt : new Date().toISOString(),
      files: showEditModal ? (selectedPatient!.files || []) : [],
      primaryDoctorId: formData.primaryDoctorId || '',
      streetName: originalPatient?.streetName,
      streetNumber: originalPatient?.streetNumber,
      neighborhood: originalPatient?.neighborhood,
      city: originalPatient?.city,
      zipCode: originalPatient?.zipCode,
      paymentValue: originalPatient?.paymentValue,
      paymentSender: originalPatient?.paymentSender,
      selfRegistered: originalPatient?.selfRegistered,
      patientPasswordSet: originalPatient?.patientPasswordSet,
      authUserId: originalPatient?.authUserId,
      pendingAuthUserId: originalPatient?.pendingAuthUserId,
      portalEnrollmentPending: originalPatient?.portalEnrollmentPending,
      clinicId: originalPatient?.clinicId || currentUser.clinicId,
    };

    setPatients(prev => {
      if (showEditModal) {
        return prev.map(p => {
          if (p.id !== processedPatient.id) return p;
          const currentPatient = p as PatientAuthMetadata;
          return {
            ...processedPatient,
            files: currentPatient.files || processedPatient.files,
            createdAt: currentPatient.createdAt,
            selfRegistered: currentPatient.selfRegistered,
            patientPasswordSet: currentPatient.patientPasswordSet,
            authUserId: currentPatient.authUserId,
            pendingAuthUserId: currentPatient.pendingAuthUserId,
            portalEnrollmentPending: currentPatient.portalEnrollmentPending,
            clinicId: currentPatient.clinicId || processedPatient.clinicId,
          };
        });
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
      p.id === selectedPatient.id ? { ...p, files: (p.files || []).filter(f => f.id !== id) } : p
    ));
  };

  const handleResetPatientPassword = async (patient: PatientAuthMetadata) => {
    if (!patient.email || resettingPatientId) return;
    const hasAuthAccount = Boolean(patient.authUserId || patient.pendingAuthUserId || patient.portalEnrollmentPending);
    const instruction = hasAuthAccount
      ? 'enviar um link para recuperar o acesso'
      : 'enviar um convite para criar a senha inicial';
    if (!confirm(`Enviar ${instruction} para ${patient.name} no e-mail cadastrado ${patient.email}?`)) return;

    setResettingPatientId(patient.id);
    setResetFeedback(null);
    try {
      await requestAdminPatientReset(patient.id);
      if (!patient.authUserId) {
        // Display only; the backend already persisted the protected enrollment.
        setPatients(prev => prev.map(p => p.id === patient.id
          ? { ...p, portalEnrollmentPending: true } : p));
      }
      setResetFeedback({
        patientId: patient.id,
        kind: 'success',
        message: `${hasAuthAccount ? 'Link de recuperação' : 'Convite para criar a senha'} enviado para ${patient.email}.`
      });
    } catch (error) {
      setResetFeedback({
        patientId: patient.id,
        kind: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível enviar o link. Tente novamente.'
      });
    } finally {
      setResettingPatientId(null);
    }
  };

  const handleUnlockSigilous = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== currentUser.authUserId
      || ![UserRole.ADMIN, UserRole.DOCTOR].includes(currentUser.role)) {
      setSigilousError('Acesso restrito a uma sessão autenticada de médico ou administrador. As permissões são verificadas no servidor.');
      return;
    }
    setSigilousUnlocked(true);
    setShowSigilous(true);
    setSigilousError('');
    setShowSigilousInput(false);
  };

  const historyBlocks = (selectedPatient?.history || '')
    .split(/(?=\[DATA:)/g)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const dateLabel = entry.match(/^\[DATA:\s*(.*?)\]/)?.[1] || '';
      const author = entry.match(/MÉDICO:\s*(.*)/)?.[1] || '';
      const cleaned = entry
        .replace(/^\[DATA:.*?\]\n?/, '')
        .replace(/\n-+\n?$/, '')
        .trim();
      return { dateLabel, author, cleaned };
    });

  const patientSigilousNotes = sigilousNotes
    .filter(note => note.patientId === selectedPatient?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}{required && <span className="text-blue-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  const patientFormFields = (
    <div className="space-y-4">
      {selectedPatientHasAuthAccount && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-800">
          O e-mail e o CPF estão bloqueados porque este paciente já possui uma conta ou convite de acesso. A identidade da conta não pode ser alterada por este cadastro.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo" required>
          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputCls} placeholder="Nome do paciente" required />
        </Field>
        <Field label="Data de Nascimento">
          <input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="CPF">
          <input type="text" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} placeholder="000.000.000-00" disabled={selectedPatientHasAuthAccount} />
        </Field>
        <Field label="Gênero">
          <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className={inputCls}>
            <option value={Gender.MALE}>Masculino</option>
            <option value={Gender.FEMALE}>Feminino</option>
            <option value={Gender.OTHER}>Outro</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mail">
          <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} placeholder="paciente@email.com" disabled={selectedPatientHasAuthAccount} />
        </Field>
        <Field label="Telefone">
          <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputCls} placeholder="(00) 00000-0000" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Plano de Saúde">
          <input type="text" value={formData.healthInsurance || ''} onChange={e => setFormData({...formData, healthInsurance: e.target.value})} className={inputCls} placeholder="Ex: Unimed" />
        </Field>
        <Field label="Tipo Sanguíneo">
          <select value={formData.bloodType || ''} onChange={e => setFormData({...formData, bloodType: e.target.value})} className={inputCls}>
            <option value="">Não informado</option>
            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Endereço">
        <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputCls} placeholder="Rua, número, bairro, cidade" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Alergias (separadas por vírgula)">
          <input type="text" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} className={inputCls} placeholder="Ex: Penicilina, Dipirona" />
        </Field>
        <Field label="Condições Pré-existentes">
          <input type="text" value={formData.preExistingConditions} onChange={e => setFormData({...formData, preExistingConditions: e.target.value})} className={inputCls} placeholder="Ex: Hipertensão, Diabetes" />
        </Field>
      </div>
      <Field label="Médico Principal">
        <select value={formData.primaryDoctorId} onChange={e => setFormData({...formData, primaryDoctorId: e.target.value})} className={inputCls}>
          <option value="">Sem médico vinculado</option>
          {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
        </select>
      </Field>
    </div>
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Pacientes</h1>
          <p className="text-slate-500 font-medium">Gestão clínica e histórico dos pacientes.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {onBackHome && (
            <button
              onClick={onBackHome}
              className="flex items-center space-x-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              <Home size={15} />
              <span>Voltar à página inicial</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setFormData({ name: '', birthDate: '', gender: Gender.MALE, cpf: '', email: '', phone: '', address: '', healthInsurance: '', bloodType: '', allergies: '', preExistingConditions: '', history: '', primaryDoctorId: doctors[0]?.id || '' }); setShowAddModal(true); }}
              className="flex items-center space-x-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
            >
              <Plus size={16} />
              <span>Novo Paciente</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou e-mail..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lista de pacientes */}
        <div className={`space-y-3 transition-all duration-300 ${selectedPatient ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <UserIcon size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Nenhum paciente encontrado.</p>
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div 
                key={patient.id} 
                className={`bg-white rounded-3xl p-5 border cursor-pointer transition-all hover:shadow-md ${selectedPatientId === patient.id ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-100 shadow-sm'}`}
                onClick={() => { setSelectedPatientId(patient.id); setSigilousUnlocked(false); setShowSigilous(false); setSigilousInput(''); setSigilousError(''); }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-600 text-sm shrink-0">
                    {patient.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-sm truncate">{patient.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{patient.email || `CPF ${patient.cpf}`}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {patient.selfRegistered && <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Auto</span>}
                    {patient.patientPasswordSet && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Portal Ativo</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detalhe do paciente */}
        {selectedPatient && (
          <div className="lg:col-span-8 space-y-5">

            {/* Cabeçalho do paciente */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center font-black text-blue-600 text-xl">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{selectedPatient.name}</h2>
                    <p className="text-slate-400 text-sm">{selectedPatient.email || `CPF: ${selectedPatient.cpf}`}</p>
                    {selectedPatient.patientPasswordSet ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
                        <ShieldCheck size={10} />
                        <span>Portal do Paciente Ativo</span>
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full mt-1">
                        Sem acesso ao portal
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {isAdmin && (
                    <>
                      <button
                        onClick={startEdit}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                      >
                        <Edit3 size={13} />
                        <span>Editar Cadastro</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Acesso do paciente</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {selectedPatient.email ? `E-mail cadastrado: ${selectedPatient.email}` : 'Cadastre um e-mail para enviar o link de acesso.'}
                      </p>
                      {resetFeedback?.patientId === selectedPatient.id && (
                        <p className={`text-xs font-bold mt-2 ${resetFeedback.kind === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {resetFeedback.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetPatientPassword(selectedPatient as PatientAuthMetadata)}
                      disabled={!selectedPatient.email || resettingPatientId !== null}
                      className="shrink-0 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resettingPatientId === selectedPatient.id ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                      <span>{resettingPatientId === selectedPatient.id ? 'Enviando...' : 'Enviar link para criar/redefinir senha'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dados básicos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'CPF', value: selectedPatient.cpf },
                  { label: 'Nascimento', value: selectedPatient.birthDate ? new Date(selectedPatient.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—' },
                  { label: 'Telefone', value: selectedPatient.phone || '—' },
                  { label: 'Plano', value: selectedPatient.healthInsurance || '—' },
                  { label: 'Tipo Sanguíneo', value: selectedPatient.bloodType || '—' },
                  { label: 'Médico', value: doctors.find(d => d.id === selectedPatient.primaryDoctorId)?.name || '—' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                    <p className="text-xs font-black text-slate-700 mt-0.5 truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Alergias e condições */}
              {(selectedPatient.allergies?.length > 0 || selectedPatient.preExistingConditions?.length > 0) && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedPatient.allergies?.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
                      <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Alergias</p>
                      <p className="text-xs font-bold text-red-700">{selectedPatient.allergies.join(', ')}</p>
                    </div>
                  )}
                  {selectedPatient.preExistingConditions?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Condições Pré-existentes</p>
                      <p className="text-xs font-bold text-amber-700">{selectedPatient.preExistingConditions.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload de arquivos */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(selectedPatient.files || []).length} Documento(s)</p>
                <label className="cursor-pointer flex items-center space-x-1.5 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-all uppercase tracking-widest">
                  <Upload size={12} />
                  <span>Anexar arquivo</span>
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                </label>
              </div>

              {(selectedPatient.files || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(selectedPatient.files || []).map(file => (
                    <div key={file.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <FileIcon size={16} className="text-slate-400" />
                        <div>
                          <p className="text-xs font-black text-slate-700 truncate max-w-[180px]">{file.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{file.category} • {new Date(file.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <a href={file.url} download={file.name} className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-all">
                          <Download size={14} />
                        </a>
                        <button onClick={() => removeFile(file.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico completo */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                <FileText size={14} />
                <span>Histórico de Atendimentos</span>
              </h3>
              {historyBlocks.length === 0 ? (
                <p className="text-sm italic text-slate-400 p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                  Nenhum atendimento registrado no prontuário ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyBlocks.map((block, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-blue-600 uppercase tracking-[0.15em] flex items-center space-x-1.5">
                          <Clock size={11} />
                          <span>{block.dateLabel}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 truncate">{block.author}</span>
                      </div>
                      <div className="p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                        {block.cleaned}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <PatientEvolution key={selectedPatient.id} patientId={selectedPatient.id} currentUser={currentUser} />
            </div>

            {/* Área Sigilosa */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                  <FileLock2 size={14} className="text-amber-500" />
                  <span>Histórico Sigiloso</span>
                </h3>
                <button
                  onClick={() => {
                    if (!sigilousUnlocked) {
                      setShowSigilousInput(v => !v);
                      setSigilousError('');
                    } else {
                      setShowSigilous(v => !v);
                    }
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                >
                  <KeyRound size={12} />
                  <span>{sigilousUnlocked ? (showSigilous ? 'Ocultar' : 'Ver Sigiloso') : 'Ver Histórico Sigiloso'}</span>
                </button>
              </div>

              {!sigilousUnlocked && showSigilousInput && (
                <form onSubmit={handleUnlockSigilous} className="space-y-3 p-5 bg-amber-50 border border-amber-200 rounded-2xl animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-amber-700 leading-relaxed">
                    Confirme sua sessão autenticada. Apenas o autor e o administrador da mesma clínica podem ler estas notas; uma senha compartilhada não concede acesso.
                  </p>
                  {sigilousError && (
                    <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{sigilousError}</p>
                  )}
                  <div className="flex space-x-2">
                    <input
                      type="password"
                      value={sigilousInput}
                      onChange={e => setSigilousInput(e.target.value)}
                      placeholder="Acesso pela sessão autenticada"
                      disabled
                      className="flex-1 px-4 py-3 bg-white border border-amber-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                      autoFocus
                    />
                    <button type="submit" className="px-5 py-3 bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all">
                      Confirmar acesso
                    </button>
                  </div>
                </form>
              )}

              {sigilousUnlocked && showSigilous && (
                <div className="animate-in fade-in duration-200">
                  {patientSigilousNotes.length === 0 ? (
                    <p className="text-sm italic text-slate-400 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                      Nenhuma anotação sigilosa registrada para este paciente.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {patientSigilousNotes.map(note => (
                        <div key={note.id} className="rounded-2xl border border-amber-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center space-x-1.5">
                              <Clock size={11} />
                              <span>{new Date(note.createdAt).toLocaleDateString('pt-BR')} às {new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">{note.authorName}{note.authorSpecialty ? ` • ${note.authorSpecialty}` : ''}</span>
                          </div>
                          <div className="p-5 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                            {note.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Modal Adicionar/Editar */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-4">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center space-x-2">
                <UserIcon size={20} className="text-blue-600" />
                <span>{showEditModal ? 'Editar Cadastro' : 'Novo Paciente'}</span>
              </h3>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSavePatient}>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {patientFormFields}
              </div>
              <div className="p-6 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-60">
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientManager;
