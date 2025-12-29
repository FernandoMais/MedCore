
import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Video, 
  Users, 
  MoreVertical,
  Calendar as CalendarIcon,
  Search,
  // Added missing Clock import
  Clock
} from 'lucide-react';
import { Appointment, AppointmentStatus } from '../types';
import { MOCK_PATIENTS } from '../constants';

interface AgendaProps {
  appointments: Appointment[];
  startConsultation: (id: string) => void;
}

const Agenda: React.FC<AgendaProps> = ({ appointments, startConsultation }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.CONFIRMED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case AppointmentStatus.SCHEDULED: return 'bg-blue-100 text-blue-700 border-blue-200';
      case AppointmentStatus.IN_PROGRESS: return 'bg-purple-100 text-purple-700 border-purple-200 animate-pulse';
      case AppointmentStatus.ABSENT: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const dayAppointments = appointments.filter(a => a.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Agenda Médica</h1>
          <p className="text-slate-500">Gerencie seus horários e atendimentos.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button className="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-50 text-blue-600">Dia</button>
            <button className="px-4 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:bg-slate-50">Semana</button>
            <button className="px-4 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:bg-slate-50">Mês</button>
          </div>
          <button className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50">
            <MoreVertical size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Date Selector Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Calendário</h3>
              <div className="flex space-x-1">
                <button className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={18} /></button>
                <button className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={18} /></button>
              </div>
            </div>
            {/* Minimal calendar mock */}
            <div className="grid grid-cols-7 gap-2 text-center mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }).map((_, i) => (
                <button 
                  key={i} 
                  className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                    i + 1 === new Date().getDate() 
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-100' 
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold text-lg mb-2">Resumo do Dia</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-blue-100 text-sm">
                  <span>Confirmados</span>
                  <span className="font-bold text-white">12</span>
                </div>
                <div className="flex items-center justify-between text-blue-100 text-sm">
                  <span>Telemedicina</span>
                  <span className="font-bold text-white">4</span>
                </div>
                <div className="flex items-center justify-between text-blue-100 text-sm">
                  <span>Pendentes</span>
                  <span className="font-bold text-white">3</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-500 rounded-full opacity-20 blur-2xl"></div>
          </div>
        </div>

        {/* Schedule View */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock size={18} className="text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">Horários de Atendimento</span>
              </div>
              <div className="text-xs text-slate-500">Visualizando: 08:00 - 18:00</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {dayAppointments.length > 0 ? (
                dayAppointments.map((appt) => {
                  const patient = MOCK_PATIENTS.find(p => p.id === appt.patientId);
                  return (
                    <div key={appt.id} className="group p-6 flex items-center hover:bg-slate-50 transition-all">
                      <div className="w-20 shrink-0">
                        <span className="text-lg font-bold text-slate-800">{appt.time}</span>
                        <p className="text-xs text-slate-400">45 min</p>
                      </div>
                      
                      <div className="flex-1 flex items-center space-x-4 ml-6">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {patient?.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{patient?.name}</h4>
                          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center"><Users size={12} className="mr-1" /> {appt.type}</span>
                            <span className="flex items-center"><CalendarIcon size={12} className="mr-1" /> {appt.room}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(appt.status)}`}>
                          {appt.status}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          {appt.type === 'Telemedicina' && (
                            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Entrar na sala virtual">
                              <Video size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => startConsultation(appt.id)}
                            className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
                          >
                            Atender
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon size={24} className="text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-800">Nenhum agendamento</h4>
                  <p className="text-sm text-slate-500">Não há pacientes marcados para esta data.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agenda;
