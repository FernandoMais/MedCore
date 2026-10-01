import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Stethoscope,
  CheckCircle2,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bell,
  ShieldCheck,
  X,
  Loader2,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { Patient, Doctor, Appointment, AppointmentStatus } from '../types';

interface PatientPortalProps {
  patient: Patient;
  doctors: Doctor[];
  appointments: Appointment[];
  onAddAppointment: (appt: Appointment) => Promise<void>;
  onLogout: () => void;
}

const getLocalDateString = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const formatDisplayDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  Agendado:       { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Agendado' },
  Confirmado:     { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Confirmado' },
  'Em Atendimento':{ bg: 'bg-purple-50', text: 'text-purple-700',  label: 'Em Atendimento' },
  Finalizado:     { bg: 'bg-slate-50',   text: 'text-slate-500',   label: 'Finalizado' },
  Faltou:         { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Faltou' },
  Cancelado:      { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'Cancelado' },
};

const TIMES = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

const PatientPortal: React.FC<PatientPortalProps> = ({ patient, doctors, appointments, onAddAppointment, onLogout }) => {
  const [tab, setTab] = useState<'agenda' | 'agendar'>('agenda');
  const [selectedDoctorId, setSelectedDoctorId] = useState(patient.primaryDoctorId || doctors[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedType, setSelectedType] = useState<'Consulta' | 'Retorno'>('Consulta');
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const myAppointments = useMemo(
    () => appointments
      .filter(a => a.patientId === patient.id)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [appointments, patient.id]
  );

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  const takenTimes = useMemo(
    () => appointments
      .filter(a => a.doctorId === selectedDoctorId && a.date === selectedDate && a.status !== AppointmentStatus.CANCELLED)
      .map(a => a.time),
    [appointments, selectedDoctorId, selectedDate]
  );

  const handleBook = async () => {
    if (!selectedTime || !selectedDoctorId || !selectedDate || loading) return;
    setLoading(true);
    setBookingError('');

    try {
      const appt: Appointment = {
        id: `appt-${crypto.randomUUID()}`,
        patientId: patient.id,
        doctorId: selectedDoctorId,
        date: selectedDate,
        time: selectedTime,
        type: selectedType,
        status: AppointmentStatus.SCHEDULED,
        room: 'A definir',
        serviceValue: selectedType === 'Retorno' ? 180 : 350,
        repassRule: { type: 'percentage', value: 60 },
      };

      await onAddAppointment(appt);

      const dateFormatted = formatDisplayDate(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      setNotifMsg(
        `Consulta agendada com ${selectedDoctor?.name} para ${dateFormatted} às ${selectedTime}. ` +
        `Uma confirmação foi registrada no sistema.`
      );

      setShowConfirm(false);
      setDone(true);
      setSelectedTime('');
      setTimeout(() => {
        setDone(false);
        setTab('agenda');
      }, 4000);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Não foi possível salvar o agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const upcomingCount = myAppointments.filter(a =>
    a.date >= getLocalDateString() && a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.FINISHED
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tighter text-slate-900 leading-none">MedCore<span className="text-blue-600">Pro</span></h1>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Portal do Paciente</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {upcomingCount > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
              <Bell size={12} className="text-blue-500" />
              <span className="text-[10px] font-black text-blue-600">{upcomingCount} próxima{upcomingCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all text-xs font-black uppercase tracking-widest">
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Boas vindas */}
        <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm flex items-center space-x-4">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center font-black text-blue-600 text-xl shrink-0">
            {patient.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Olá, {patient.name.split(' ')[0]}!</h2>
            <p className="text-sm text-slate-500 font-medium">{patient.email}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
            <LogOut size={14} />
            <span>Voltar à página inicial</span>
          </button>
        </div>

        {/* Notificação de agendamento */}
        {notifMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-emerald-800">Agendamento Confirmado!</p>
              <p className="text-xs text-emerald-700 font-medium mt-1 leading-relaxed">{notifMsg}</p>
            </div>
            <button onClick={() => setNotifMsg('')} className="ml-auto text-emerald-400 hover:text-emerald-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
          <button onClick={() => setTab('agenda')} className={`flex-1 py-3 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${tab === 'agenda' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            Minhas Consultas
          </button>
          <button onClick={() => setTab('agendar')} className={`flex-1 py-3 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${tab === 'agendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            Agendar Consulta
          </button>
        </div>

        {/* Tab: Minhas Consultas */}
        {tab === 'agenda' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {myAppointments.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-slate-200 p-12 text-center shadow-sm">
                <Calendar size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold text-sm">Nenhuma consulta registrada.</p>
                <p className="text-slate-300 text-xs font-medium mt-1">Use a aba "Agendar Consulta" para marcar seu atendimento.</p>
                <button onClick={() => setTab('agendar')} className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">
                  Agendar Agora
                </button>
              </div>
            ) : (
              myAppointments.map(appt => {
                const doc = doctors.find(d => d.id === appt.doctorId);
                const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG['Agendado'];
                const isPast = appt.date < getLocalDateString();
                return (
                  <div key={appt.id} className={`bg-white rounded-[28px] border border-slate-200 p-5 shadow-sm flex items-center space-x-4 ${isPast ? 'opacity-60' : ''}`}>
                    <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Stethoscope size={22} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm truncate">{doc?.name || 'Médico'}</p>
                      <p className="text-xs text-slate-400 font-medium truncate">{doc?.specialty}</p>
                      <div className="flex items-center space-x-3 mt-1.5">
                        <span className="flex items-center space-x-1 text-[10px] font-bold text-slate-500">
                          <Calendar size={11} />
                          <span>{formatDisplayDate(appt.date).toLocaleDateString('pt-BR')}</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[10px] font-bold text-slate-500">
                          <Clock size={11} />
                          <span>{appt.time}</span>
                        </span>
                        {appt.room && (
                          <span className="flex items-center space-x-1 text-[10px] font-bold text-slate-500">
                            <MapPin size={11} />
                            <span>{appt.room}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 ${cfg.bg} ${cfg.text} rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0`}>
                      {cfg.label}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Agendar */}
        {tab === 'agendar' && (
          <div className="space-y-5 animate-in fade-in duration-300">

            {done && (
              <div className="bg-white rounded-[32px] border border-emerald-200 p-10 text-center shadow-sm space-y-4">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Consulta Agendada!</h3>
                <p className="text-sm text-slate-500 font-medium">Redirecionando para suas consultas...</p>
              </div>
            )}

            {!done && (
              <>
                {/* Médico */}
                <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                    <UserIcon size={14} />
                    <span>Escolha o Médico</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doctors.map(doc => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => { setSelectedDoctorId(doc.id); setSelectedTime(''); }}
                        className={`text-left p-4 rounded-2xl border transition-all ${selectedDoctorId === doc.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
                      >
                        <p className="font-black text-slate-800 text-sm">{doc.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{doc.specialty} • CRM {doc.crm}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data */}
                <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                    <Calendar size={14} />
                    <span>Data</span>
                  </h3>
                  <input
                    type="date"
                    value={selectedDate}
                    min={getLocalDateString()}
                    onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Horários */}
                <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                    <Clock size={14} />
                    <span>Horário Disponível</span>
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {TIMES.map(t => {
                      const taken = takenTimes.includes(t);
                      const selected = selectedTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={taken}
                          onClick={() => setSelectedTime(t)}
                          className={`py-2 rounded-xl text-xs font-black transition-all ${
                            taken ? 'bg-slate-100 text-slate-300 cursor-not-allowed line-through' :
                            selected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                            'bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {takenTimes.length > 0 && (
                    <p className="text-[10px] text-slate-400 font-bold">Os horários riscados já estão ocupados nesta data.</p>
                  )}
                </div>

                {/* Tipo */}
                <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo de Atendimento</h3>
                  <div className="flex space-x-3">
                    {(['Consulta', 'Retorno'] as const).map(type => (
                      <button key={type} type="button" onClick={() => setSelectedType(type)}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedType === type ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resumo + botão */}
                {selectedTime && (
                  <div className="bg-blue-600 rounded-[28px] p-6 shadow-xl shadow-blue-200 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-200">Resumo do Agendamento</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-200 text-xs font-bold">Médico</span>
                        <span className="text-white font-black text-sm">{selectedDoctor?.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-200 text-xs font-bold">Data</span>
                        <span className="text-white font-black text-sm">{formatDisplayDate(selectedDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-200 text-xs font-bold">Horário</span>
                        <span className="text-white font-black text-sm">{selectedTime}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-200 text-xs font-bold">Tipo</span>
                        <span className="text-white font-black text-sm">{selectedType}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowConfirm(true)}
                      className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <CheckCircle2 size={16} />
                      <span>Confirmar Agendamento</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center justify-center mx-auto">
                <Calendar size={24} className="text-blue-500" />
              </div>
              <h3 className="font-black text-slate-800 text-lg">Confirmar Agendamento?</h3>
              <p className="text-xs text-slate-500 font-medium">
                {selectedDoctor?.name} — {formatDisplayDate(selectedDate).toLocaleDateString('pt-BR')} às {selectedTime}
              </p>
            </div>
            {bookingError && (
              <div role="alert" className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}
            <div className="flex space-x-3">
              <button onClick={() => { setShowConfirm(false); setBookingError(''); }} disabled={loading} className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleBook} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-60">
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>{loading ? 'Salvando...' : 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPortal;
