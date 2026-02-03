
import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Search, 
  Filter, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X,
  ExternalLink,
  ChevronRight,
  Stethoscope,
  TrendingDown,
  PieChart,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { Appointment, Patient, Doctor, AppointmentStatus } from '../types';

interface AppointmentReportProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
}

const AppointmentReport: React.FC<AppointmentReportProps> = ({ appointments, patients, doctors }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const getPatient = (id: string) => patients.find(p => p.id === id);
  const getDoctor = (id: string) => doctors.find(d => d.id === id);

  const filteredData = useMemo(() => {
    return appointments.filter(appt => {
      const patient = getPatient(appt.patientId);
      const matchesSearch = patient?.name.toLowerCase().includes(searchTerm.toLowerCase()) || patient?.cpf.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
      const matchesDoctor = doctorFilter === 'all' || appt.doctorId === doctorFilter;
      return matchesSearch && matchesStatus && matchesDoctor;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, searchTerm, statusFilter, doctorFilter, patients]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredData.length;
    const finished = filteredData.filter(a => a.status === AppointmentStatus.FINISHED).length;
    const absent = filteredData.filter(a => a.status === AppointmentStatus.ABSENT).length;
    const scheduled = filteredData.filter(a => a.status === AppointmentStatus.SCHEDULED).length;
    const rate = total > 0 ? ((absent / total) * 100).toFixed(1) : '0';
    return { total, finished, absent, scheduled, rate };
  }, [filteredData]);

  const getStatusStyle = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.FINISHED: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case AppointmentStatus.ABSENT: return 'bg-red-50 text-red-700 border-red-100';
      case AppointmentStatus.SCHEDULED: return 'bg-blue-50 text-blue-700 border-blue-100';
      case AppointmentStatus.CONFIRMED: return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatório de Atendimentos</h1>
          <p className="text-slate-500 font-medium">Análise operacional e controle de absenteísmo.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
          <PieChart size={18} className="text-blue-500" />
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Taxa de Faltas: {stats.rate}%</span>
        </div>
      </div>

      {/* Cards de Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Analisado" value={stats.total} icon={<BarChart3 className="text-blue-600" />} />
        <StatCard title="Concluídas" value={stats.finished} icon={<CheckCircle2 className="text-emerald-600" />} />
        <StatCard title="Faltas (No-show)" value={stats.absent} icon={<AlertCircle className="text-red-600" />} />
        <StatCard title="Pendentes" value={stats.scheduled} icon={<Clock className="text-amber-600" />} />
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por paciente ou CPF..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <select 
            className="bg-slate-50 border-none rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos Status</option>
            {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            className="bg-slate-50 border-none rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          >
            <option value="all">Todos Médicos</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela de Relatório */}
      <div className="bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissional</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.length > 0 ? (
              filteredData.map((appt) => {
                const patient = getPatient(appt.patientId);
                const doctor = getDoctor(appt.doctorId);
                return (
                  <tr key={appt.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${appt.status === AppointmentStatus.ABSENT ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {patient?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm tracking-tight">{patient?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{patient?.cpf}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-700 tracking-tight">{new Date(appt.date).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{appt.time}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2">
                        <Stethoscope size={14} className="text-blue-400" />
                        <span className="text-sm font-bold text-slate-600">{doctor?.name.split(' ')[1]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusStyle(appt.status)}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setSelectedAppointment(appt)}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all active:scale-90"
                      >
                        <Phone size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <BarChart3 size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum registro encontrado para este filtro.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes de Contato (Busca Ativa) */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className={`p-8 border-b border-slate-100 flex items-center justify-between ${selectedAppointment.status === AppointmentStatus.ABSENT ? 'bg-red-50/50' : 'bg-blue-50/50'}`}>
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${selectedAppointment.status === AppointmentStatus.ABSENT ? 'bg-red-600' : 'bg-blue-600'}`}>
                  {getPatient(selectedAppointment.patientId)?.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Busca Ativa</h2>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${selectedAppointment.status === AppointmentStatus.ABSENT ? 'text-red-600' : 'text-blue-600'}`}>
                    {selectedAppointment.status === AppointmentStatus.ABSENT ? 'Paciente faltou à consulta' : 'Detalhes do agendamento'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedAppointment(null)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors cursor-pointer">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Phone size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</p>
                    <p className="text-sm font-black text-slate-800">{getPatient(selectedAppointment.patientId)?.phone}</p>
                  </div>
                  <ExternalLink size={16} className="text-slate-300 group-hover:text-blue-500" />
                </div>

                <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors cursor-pointer">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Mail size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</p>
                    <p className="text-sm font-black text-slate-800 truncate">{getPatient(selectedAppointment.patientId)?.email}</p>
                  </div>
                  <ExternalLink size={16} className="text-slate-300 group-hover:text-blue-500" />
                </div>

                <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço Registrado</p>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">{getPatient(selectedAppointment.patientId)?.address}</p>
                  </div>
                </div>
              </div>

              {selectedAppointment.status === AppointmentStatus.ABSENT && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-[32px] space-y-3">
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertTriangle size={18} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Ação Sugerida</h4>
                  </div>
                  <p className="text-xs font-bold text-red-800 leading-relaxed">
                    Entre em contato via WhatsApp para entender o motivo da falta e oferecer uma nova data de retorno. 
                    Pacientes com no-show recorrente impactam a ociosidade clínica.
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95"
                >
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Fix: Added safety check and any casting to React.ReactElement to resolve TS error with 'size' prop in cloneElement
const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 24 }) : icon}
      </div>
      <ChevronRight size={18} className="text-slate-100" />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
    <h3 className="text-3xl font-black text-slate-800 tracking-tighter mt-1">{value}</h3>
  </div>
);

export default AppointmentReport;
