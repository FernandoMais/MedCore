import React, { useState } from 'react';
import {
  ShieldCheck,
  User as UserIcon,
  FileText,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Hash,
  Home,
  Building2,
  Navigation,
  DollarSign,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Patient, Gender } from '../types';

interface PatientSelfRegisterProps {
  onSubmit: (patient: Patient) => void;
  onBack: () => void;
}

const EMPTY_FORM = {
  name: '',
  cpf: '',
  birthDate: '',
  email: '',
  phone: '',
  streetName: '',
  streetNumber: '',
  neighborhood: '',
  city: '',
  zipCode: '',
  paymentValue: '',
  paymentSender: '',
};

const PatientSelfRegister: React.FC<PatientSelfRegisterProps> = ({ onSubmit, onBack }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const formatCPF = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const formatZip = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    return d.replace(/(\d{5})(\d{0,3})/, '$1-$2');
  };

  const validate = () => {
    if (!form.name.trim()) return 'Nome completo é obrigatório.';
    if (form.cpf.replace(/\D/g, '').length < 11) return 'CPF inválido.';
    if (!form.birthDate) return 'Data de nascimento é obrigatória.';
    if (!form.email.includes('@')) return 'E-mail inválido.';
    if (form.phone.replace(/\D/g, '').length < 10) return 'Celular inválido.';
    if (!form.streetName.trim()) return 'Rua é obrigatória.';
    if (!form.city.trim()) return 'Cidade é obrigatória.';
    if (!form.paymentValue.trim()) return 'Informe o valor pago.';
    if (!form.paymentSender.trim()) return 'Informe o nome de quem realizou o pagamento.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 600));

    const address = [
      form.streetName.trim(),
      form.streetNumber.trim() ? `Nº ${form.streetNumber.trim()}` : '',
      form.neighborhood.trim() ? `Bairro ${form.neighborhood.trim()}` : '',
      form.city.trim(),
      form.zipCode.trim() ? `CEP ${form.zipCode.trim()}` : '',
    ].filter(Boolean).join(', ');

    const patient: Patient = {
      id: `patient-${crypto.randomUUID()}`,
      name: form.name.trim(),
      cpf: form.cpf,
      birthDate: form.birthDate,
      gender: Gender.OTHER,
      email: form.email.trim(),
      phone: form.phone,
      address,
      streetName: form.streetName.trim(),
      streetNumber: form.streetNumber.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      zipCode: form.zipCode.trim(),
      paymentValue: form.paymentValue.trim(),
      paymentSender: form.paymentSender.trim(),
      healthInsurance: '',
      bloodType: '',
      allergies: [],
      history: '',
      preExistingConditions: [],
      createdAt: new Date().toISOString(),
      primaryDoctorId: '',
      files: [],
      selfRegistered: true,
    };

    onSubmit(patient);
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-500 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-emerald-200 mx-auto mb-8">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4">Cadastro Realizado!</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-2">
            Seus dados foram enviados com sucesso para a clínica.
          </p>
          <p className="text-slate-400 text-sm font-medium mb-10">
            Nossa equipe entrará em contato para confirmar seu agendamento. Obrigado!
          </p>
          <button
            onClick={onBack}
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95"
          >
            Voltar à Página Inicial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden font-sans">
      {/* Header */}
      <nav className="bg-white border-b border-slate-100 px-6 md:px-12 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-slate-900 leading-none">MedCore<span className="text-blue-600">Pro</span></h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cadastro de Paciente</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 text-xs font-black uppercase tracking-widest transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar</span>
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        {/* Intro */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-3">
            Faça seu Cadastro
          </h2>
          <p className="text-slate-500 font-medium max-w-lg mx-auto">
            Preencha seus dados abaixo. Nossa equipe irá analisar e confirmar seu atendimento em breve.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {/* Dados Pessoais */}
          <Section icon={<UserIcon size={18} className="text-blue-600" />} title="Dados Pessoais">
            <Field label="Nome Completo" required>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Como consta no documento"
                className={inputCls}
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="CPF" required>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => setForm(p => ({ ...p, cpf: formatCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Data de Nascimento" required>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={set('birthDate')}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          </Section>

          {/* Contato */}
          <Section icon={<Mail size={18} className="text-indigo-600" />} title="Contato">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="E-mail" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="seu@email.com"
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Celular / WhatsApp" required>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          </Section>

          {/* Endereço */}
          <Section icon={<MapPin size={18} className="text-emerald-600" />} title="Endereço">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="sm:col-span-2">
                <Field label="Rua / Avenida" required>
                  <input
                    type="text"
                    value={form.streetName}
                    onChange={set('streetName')}
                    placeholder="Ex: Av. Paulista"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
              <Field label="Número">
                <input
                  type="text"
                  value={form.streetNumber}
                  onChange={set('streetNumber')}
                  placeholder="Ex: 1234"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Field label="Bairro">
                <input
                  type="text"
                  value={form.neighborhood}
                  onChange={set('neighborhood')}
                  placeholder="Ex: Centro"
                  className={inputCls}
                />
              </Field>
              <Field label="Cidade" required>
                <input
                  type="text"
                  value={form.city}
                  onChange={set('city')}
                  placeholder="Ex: São Paulo"
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="CEP">
                <input
                  type="text"
                  value={form.zipCode}
                  onChange={e => setForm(p => ({ ...p, zipCode: formatZip(e.target.value) }))}
                  placeholder="00000-000"
                  maxLength={9}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* Pagamento */}
          <Section icon={<CreditCard size={18} className="text-violet-600" />} title="Dados do Pagamento">
            <p className="text-xs text-slate-400 font-medium -mt-2 mb-2">
              Informe os dados do depósito ou PIX realizado para confirmar seu atendimento.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Valor Pago (R$)" required>
                <input
                  type="text"
                  value={form.paymentValue}
                  onChange={set('paymentValue')}
                  placeholder="Ex: 150,00"
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Nome Completo de Quem Fez o Depósito/PIX" required>
                <input
                  type="text"
                  value={form.paymentSender}
                  onChange={set('paymentSender')}
                  placeholder="Nome como aparece no comprovante"
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          </Section>

          {/* LGPD notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
              <ShieldCheck size={12} className="inline mr-1" />
              Seus dados são protegidos conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              Utilizamos as informações exclusivamente para finalidades clínicas e administrativas da consulta.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-wait"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <span>Confirmar Cadastro</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const inputCls = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all';

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white border border-slate-100 rounded-[28px] shadow-sm overflow-hidden">
    <div className="px-7 py-5 border-b border-slate-50 flex items-center space-x-3 bg-slate-50/50">
      {icon}
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-7 space-y-5">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {label} {required && <span className="text-blue-500">*</span>}
    </label>
    {children}
  </div>
);

export default PatientSelfRegister;
