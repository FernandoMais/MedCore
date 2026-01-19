
import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Video, 
  Users, 
  MoreVertical,
  Calendar as CalendarIcon,
  Search,
  Clock,
  Filter,
  Stethoscope,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Activity,
  X,
  Save,
  UserPlus
} from 'lucide-react';
import { Appointment, AppointmentStatus, Doctor, Patient, UserRole } from '../types';

interface AgendaProps {
  appointments: Appointment[];
  setAppointments: (appts: Appointment[] | ((prev: Appointment[]) => Appointment[])) => void;
  patients: Patient[];
  doctors: Doctor[];
  currentUser: any;
  startConsultation: (id: string) => void;
}

type ViewType = 'day' | 'week' | 'month';

const Agenda: React.FC<AgendaProps> = ({ 
  appointments, 
  setAppointments, 
  patients, 
  doctors, 
  currentUser,
  startConsultation 
}) => {
  // Helper para obter a data local no formato YYYY-MM-DD com precisão
  const getLocalDateString = (date: Date = new Date()) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  // Helper para formatar a data para exibição sem erro de fuso horário
  const formatDisplayDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [view, setView] = useState<ViewType>('day');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State para Novo Agendamento
  const [newAppt, setNewAppt] = useState({
    patientId: '',
    doctorId: currentUser.role === UserRole.DOCTOR ? (currentUser.doctorId || '') : '',
    date: getLocalDateString(),
    time: '09:00',
    type: 'Consulta' as const,
    room: 'Consultório 01'
  });

  const getStatusConfig = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.CONFIRMED: 
        return { color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' };
      case AppointmentStatus.SCHEDULED: 
        return { color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' };
      case AppointmentStatus.IN_PROGRESS: 
        return { color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200 animate-pulse' };
      case AppointmentStatus.ABSENT: 
        return { color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' };
      case AppointmentStatus.FINISHED:
        return { color: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' };
      default: 
        return { color: 'bg-slate-300', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' };
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchDoctor = doctorFilter === 'all' || a.doctorId === doctorFilter;
      const matchRoom = roomFilter === 'all' || a.room === roomFilter;
      return matchDoctor && matchRoom;
    });
  }, [appointments, doctorFilter, roomFilter]);

  const dayAppointments = useMemo(() => {
    return filteredAppointments
      .filter(a => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredAppointments, selectedDate]);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.patientId || !newAppt.doctorId) {
      alert("Por favor, selecione um paciente e um médico.");
      return;
    }

    const createdAppt: Appointment = {
      id: 'appt-' + Date.now(),
      ...newAppt,
      status: AppointmentStatus.SCHEDULED
    };

    setAppointments(prev => [createdAppt, ...prev]);
    setShowAddModal(false);
    alert("Agendamento realizado com sucesso!");
  };

  const renderWeekView = () => {
    const startOfWeek = formatDisplayDate(selectedDate);
    // Ajustar para o início da semana (Domingo)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return getLocalDateString(d);
    });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(date => {
          const appts = filteredAppointments.filter(a => a.date === date);
          const isToday = date === getLocalDateString();
          const displayObj = formatDisplayDate(date);
          return (
            <div key={date} className={`bg-white rounded-[24px] border ${isToday ? 'border-blue-500 ring-2 ring-blue-500/5' : 'border-slate-100'} p-4 min-h-[400px] flex flex-col shadow-sm`}>
              <div className="text-center mb-4 pb-4 border-b border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {displayObj.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                  {displayObj.getDate()}
                </p>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide">
                {appts.map(a => (
                  <div key={a.id} className={`${getStatusConfig(a.status).bg} p-2 rounded-xl border ${getStatusConfig(a.status).border} text-[10px] font-bold truncate cursor-pointer hover:brightness-95 transition-all`}>
                    {a.time} - {patients.find(p => p.id === a.patientId)?.name.split(' ')[0] || 'Paciente'}
                  </div>
                ))}
                {appts.length === 0 && <p className="text-[9px] text-slate-300 font-bold text-center mt-10 italic uppercase">Livre</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const date = formatDisplayDate(selectedDate);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    return (
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100 py-3">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => {
            const dayNum = i - startingDay + 1;
            const currentDayDate = dayNum > 0 && dayNum <= daysInMonth 
              ? getLocalDateString(new Date(date.getFullYear(), date.getMonth(), dayNum)) 
              : null;
            
            const apptsCount = currentDayDate ? filteredAppointments.filter(a => a.date === currentDayDate).length : 0;
            const isToday = currentDayDate === getLocalDateString();

            return (
              <div 
                key={i} 
                className={`h-24 p-2 border-r border-b border-slate-50 flex flex-col justify-between ${!currentDayDate ? 'bg-slate-50/50' : 'hover:bg-blue-50/20 transition-colors cursor-pointer'}`} 
                onClick={() => currentDayDate && setSelectedDate(currentDayDate)}
              >
                {currentDayDate && (
                  <>
                    <span className={`text-xs font-black ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg' : 'text-slate-500'}`}>{dayNum}</span>
                    {apptsCount > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{apptsCount} {apptsCount === 1 ? 'Consulta' : 'Consultas'}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Agenda Médica</h1>
          <p className="text-slate-500 font-medium tracking-tight">Planejamento e controle de fluxo operacional.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center space-x-2 mr-2"
          >
            <Plus size={18} />
            <span>Novo Agendamento</span>
          </button>

          <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
            <button onClick={() => setView('day')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'day' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Dia</button>
            <button onClick={() => setView('week')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'week' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Semana</button>
            <button onClick={() => setView('month')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'month' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Mês</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6 no-print">
          {/* Calendário Lateral Fixo */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                {formatDisplayDate(selectedDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <span key={d} className="text-[10px] font-black text-slate-300">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const now = formatDisplayDate(selectedDate);
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const startDay = first.getDay();
                
                return Array.from({ length: 42 }).map((_, i) => {
                  const dNum = i - startDay + 1;
                  if (dNum <= 0 || dNum > last.getDate()) return <div key={i} />;
                  
                  const dStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), dNum));
                  const isSelected = selectedDate === dStr;
                  const isToday = getLocalDateString() === dStr;

                  return (
                    <button 
                      key={i} 
                      onClick={() => setSelectedDate(dStr)}
                      className={`aspect-square flex flex-col items-center justify-center text-[11px] rounded-xl font-black transition-all relative ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' 
                          : isToday ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'hover:bg-blue-50 text-slate-600'
                      }`}
                    >
                      {dNum}
                      {isSelected && <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full"></div>}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Ocupação Médica */}
          <div className="bg-slate-900 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <h4 className="font-black text-white text-lg tracking-tight">Ocupação Médica</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-white">
                   <div className="flex items-center text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                     <CheckCircle2 size={14} className="mr-2" /> Confirmados
                   </div>
                   <span className="font-black">{filteredAppointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length}</span>
                </div>
                <div className="flex items-center justify-between text-white">
                   <div className="flex items-center text-blue-400 text-[10px] font-black uppercase tracking-widest">
                     <Clock size={14} className="mr-2" /> Agendados
                   </div>
                   <span className="font-black">{filteredAppointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 animate-in fade-in duration-500">
          {view === 'day' && (
            <div className="bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização Diária</span>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                      {formatDisplayDate(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {dayAppointments.length > 0 ? (
                  dayAppointments.map((appt) => {
                    const patient = patients.find(p => p.id === appt.patientId);
                    const doctor = doctors.find(d => d.id === appt.doctorId);
                    const statusConfig = getStatusConfig(appt.status);
                    
                    return (
                      <div key={appt.id} className="group p-8 flex flex-col sm:flex-row items-center hover:bg-slate-50/50 transition-all border-l-0 hover:border-l-[12px] hover:border-l-blue-600">
                        <div className="w-24 shrink-0 text-center sm:text-left mb-4 sm:mb-0">
                          <span className="text-2xl font-black text-slate-800 tracking-tighter">{appt.time}</span>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">45 MINUTOS</p>
                        </div>
                        
                        <div className="flex-1 flex items-center space-x-6 sm:ml-6">
                          <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center font-black text-xl shadow-xl transition-all group-hover:scale-110 ${patient?.allergies && patient.allergies.length > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white'}`}>
                            {patient?.name.charAt(0) || 'P'}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors truncate">{patient?.name || 'Paciente'}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              <span className="flex items-center bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><Users size={12} className="mr-2 text-blue-500" /> {appt.type}</span>
                              <span className="flex items-center bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><MapPin size={12} className="mr-2 text-emerald-500" /> {appt.room}</span>
                              <span className="flex items-center text-slate-500"><Stethoscope size={12} className="mr-2" /> Dr. {doctor?.name || 'Médico'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 sm:mt-0">
                          <div className={`flex items-center px-4 py-2 rounded-2xl border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                            <div className={`w-2 h-2 rounded-full ${statusConfig.color} mr-2 shadow-sm`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{appt.status}</span>
                          </div>
                          <button 
                            onClick={() => startConsultation(appt.id)}
                            className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                          >
                            Atender
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 border border-slate-100">
                      <CalendarIcon size={40} className="text-slate-200" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800">Sem Agendamentos</h4>
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl"
                    >
                      Agendar Primeiro Paciente
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>
      </div>

      {/* Modal de Novo Agendamento */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Novo Agendamento</h2>
              <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl text-slate-400"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleCreateAppointment} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente *</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  value={newAppt.patientId}
                  onChange={e => setNewAppt({...newAppt, patientId: e.target.value})}
                  required
                >
                  <option value="">Selecione um Paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name} - {p.cpf}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Médico Responsável *</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  value={newAppt.doctorId}
                  onChange={e => setNewAppt({...newAppt, doctorId: e.target.value})}
                  disabled={currentUser.role === UserRole.DOCTOR}
                  required
                >
                  <option value="">Selecione um Médico...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data *</label>
                  <input 
                    type="date"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                    value={newAppt.date}
                    onChange={e => setNewAppt({...newAppt, date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário *</label>
                  <input 
                    type="time"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                    value={newAppt.time}
                    onChange={e => setNewAppt({...newAppt, time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo *</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                    value={newAppt.type}
                    onChange={e => setNewAppt({...newAppt, type: e.target.value as any})}
                    required
                  >
                    <option value="Consulta">Consulta</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Procedimento">Procedimento</option>
                    <option value="Telemedicina">Telemedicina</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sala *</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                    value={newAppt.room}
                    onChange={e => setNewAppt({...newAppt, room: e.target.value})}
                    required
                  >
                    <option value="Consultório 01">Consultório 01</option>
                    <option value="Consultório 02">Consultório 02</option>
                    <option value="Sala de Exames">Sala de Exames</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all mt-4 flex items-center justify-center space-x-2"
              >
                <Save size={18} />
                <span>Confirmar Agendamento</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
