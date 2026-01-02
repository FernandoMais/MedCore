
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
  // Added Activity to fix the error on line 256
  Activity
} from 'lucide-react';
import { Appointment, AppointmentStatus, Doctor } from '../types';
import { MOCK_PATIENTS, MOCK_DOCTORS } from '../constants';

interface AgendaProps {
  appointments: Appointment[];
  startConsultation: (id: string) => void;
}

type ViewType = 'day' | 'week' | 'month';

const Agenda: React.FC<AgendaProps> = ({ appointments, startConsultation }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<ViewType>('day');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  // Cores de status aprimoradas
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

  // Salas únicas encontradas nos agendamentos
  const availableRooms = useMemo(() => {
    const rooms = new Set(appointments.map(a => a.room).filter(Boolean));
    return Array.from(rooms) as string[];
  }, [appointments]);

  // Filtragem complexa
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

  // Helper para renderizar a visualização semanal
  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate);
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(date => {
          const appts = filteredAppointments.filter(a => a.date === date);
          const isToday = date === new Date().toISOString().split('T')[0];
          return (
            <div key={date} className={`bg-white rounded-[24px] border ${isToday ? 'border-blue-500 ring-2 ring-blue-500/5' : 'border-slate-100'} p-4 min-h-[400px] flex flex-col`}>
              <div className="text-center mb-4 pb-4 border-b border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                  {new Date(date).getDate()}
                </p>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide">
                {appts.map(a => (
                  <div key={a.id} className={`${getStatusConfig(a.status).bg} p-2 rounded-xl border ${getStatusConfig(a.status).border} text-[10px] font-bold truncate cursor-pointer hover:brightness-95 transition-all`}>
                    {a.time} - {MOCK_PATIENTS.find(p => p.id === a.patientId)?.name.split(' ')[0]}
                  </div>
                ))}
                {appts.length === 0 && <p className="text-[9px] text-slate-300 font-bold text-center mt-10 italic uppercase">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper para renderizar a visualização mensal
  const renderMonthView = () => {
    const date = new Date(selectedDate);
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
          {Array.from({ length: startingDay + daysInMonth }).map((_, i) => {
            const dayNum = i - startingDay + 1;
            const currentDayDate = dayNum > 0 ? new Date(date.getFullYear(), date.getMonth(), dayNum).toISOString().split('T')[0] : null;
            const apptsCount = currentDayDate ? filteredAppointments.filter(a => a.date === currentDayDate).length : 0;
            const isToday = currentDayDate === new Date().toISOString().split('T')[0];

            return (
              <div key={i} className={`h-24 p-2 border-r border-b border-slate-50 flex flex-col justify-between ${dayNum <= 0 ? 'bg-slate-50/50' : 'hover:bg-blue-50/20 transition-colors cursor-pointer'}`} onClick={() => currentDayDate && setSelectedDate(currentDayDate)}>
                {dayNum > 0 && (
                  <>
                    <span className={`text-xs font-black ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg' : 'text-slate-500'}`}>{dayNum}</span>
                    {apptsCount > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{apptsCount} Consultas</span>
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
      {/* Cabeçalho da Agenda */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Agenda Médica</h1>
          <p className="text-slate-500 font-medium tracking-tight">Planejamento e controle de fluxo operacional.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Profissional */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm hover:border-blue-300 transition-all">
            <Stethoscope size={18} className="text-slate-400 mr-3" />
            <select 
              value={doctorFilter} 
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-700 outline-none uppercase tracking-widest cursor-pointer"
            >
              <option value="all">TODOS OS MÉDICOS</option>
              {MOCK_DOCTORS.map(d => <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Seletor de Sala */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm hover:border-blue-300 transition-all">
            <MapPin size={18} className="text-slate-400 mr-3" />
            <select 
              value={roomFilter} 
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-700 outline-none uppercase tracking-widest cursor-pointer"
            >
              <option value="all">TODAS AS SALAS</option>
              {availableRooms.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
            <button onClick={() => setView('day')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'day' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Dia</button>
            <button onClick={() => setView('week')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'week' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Semana</button>
            <button onClick={() => setView('month')} className={`px-5 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${view === 'month' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Mês</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Lateral */}
        <div className="lg:col-span-3 space-y-6 no-print">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Calendário</h3>
              <div className="flex space-x-1">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ChevronRight size={16} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <span key={d} className="text-[10px] font-black text-slate-300">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }).map((_, i) => {
                const dayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                const isSelected = selectedDate === dayStr;
                return (
                  <button 
                    key={i} 
                    onClick={() => setSelectedDate(dayStr)}
                    className={`aspect-square flex items-center justify-center text-[11px] rounded-xl font-black transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' 
                        : 'hover:bg-blue-50 text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <h4 className="font-black text-white text-lg tracking-tight">Ocupação Médica</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                     <CheckCircle2 size={14} className="mr-2" /> Confirmados
                   </div>
                   <span className="text-white font-black">{filteredAppointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center text-blue-400 text-[10px] font-black uppercase tracking-widest">
                     <Clock size={14} className="mr-2" /> Agendados
                   </div>
                   <span className="text-white font-black">{filteredAppointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center text-purple-400 text-[10px] font-black uppercase tracking-widest">
                     <Activity size={14} className="mr-2" /> Ativos
                   </div>
                   <span className="text-white font-black">{filteredAppointments.filter(a => a.status === AppointmentStatus.IN_PROGRESS).length}</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-600 rounded-full opacity-10 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
          </div>
        </div>

        {/* Visualização Principal */}
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
                      {new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-200 uppercase tracking-widest">
                  {dayAppointments.length} Paciente(s) Hoje
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {dayAppointments.length > 0 ? (
                  dayAppointments.map((appt) => {
                    const patient = MOCK_PATIENTS.find(p => p.id === appt.patientId);
                    const doctor = MOCK_DOCTORS.find(d => d.id === appt.doctorId);
                    const statusConfig = getStatusConfig(appt.status);
                    
                    return (
                      <div key={appt.id} className="group p-8 flex flex-col sm:flex-row items-center hover:bg-slate-50/50 transition-all border-l-0 hover:border-l-[12px] hover:border-l-blue-600">
                        <div className="w-24 shrink-0 text-center sm:text-left mb-4 sm:mb-0">
                          <span className="text-2xl font-black text-slate-800 tracking-tighter">{appt.time}</span>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">45 MINUTOS</p>
                        </div>
                        
                        <div className="flex-1 flex items-center space-x-6 sm:ml-6">
                          <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center font-black text-xl shadow-xl transition-all group-hover:scale-110 ${patient?.allergies.length ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white'}`}>
                            {patient?.name.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors truncate">{patient?.name}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              <span className="flex items-center bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><Users size={12} className="mr-2 text-blue-500" /> {appt.type}</span>
                              <span className="flex items-center bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><MapPin size={12} className="mr-2 text-emerald-500" /> {appt.room}</span>
                              <span className="flex items-center text-slate-500"><Stethoscope size={12} className="mr-2" /> Dr. {doctor?.name.split(' ')[2]}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 sm:mt-0">
                          <div className={`flex items-center px-4 py-2 rounded-2xl border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                            <div className={`w-2 h-2 rounded-full ${statusConfig.color} mr-2 shadow-sm`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{appt.status}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {appt.type === 'Telemedicina' && (
                              <button className="p-3 text-blue-600 bg-white border border-slate-100 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Sala Virtual">
                                <Video size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => startConsultation(appt.id)}
                              className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 active:scale-95"
                            >
                              Atender
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
                      <CalendarIcon size={40} className="text-slate-200" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">Canais Livres</h4>
                    <p className="text-sm text-slate-400 font-medium max-w-xs mt-2">Nenhum paciente agendado para os filtros selecionados nesta data.</p>
                    <button className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Novo Agendamento</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>
      </div>
    </div>
  );
};

export default Agenda;
