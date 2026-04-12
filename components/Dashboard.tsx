
import React from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Heart,
  // Fix: Added missing ShieldCheck import to fix error on line 116
  ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Appointment, AppointmentStatus } from '../types';
import { MOCK_DOCTORS } from '../constants';

interface DashboardProps {
  patientsCount: number;
  appointments: Appointment[];
}

const data = [
  { name: 'Seg', total: 12 },
  { name: 'Ter', total: 18 },
  { name: 'Qua', total: 15 },
  { name: 'Qui', total: 22 },
  { name: 'Sex', total: 20 },
  { name: 'Sáb', total: 8 },
];

const Dashboard: React.FC<DashboardProps> = ({ patientsCount, appointments }) => {
  const confirmedCount = appointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length;
  const pendingCount = appointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length;
  const doctorsCount = MOCK_DOCTORS.length;

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">Painel de Controle</h1>
          <p className="text-sm lg:text-base text-slate-500 mt-1 font-medium">Resumo operacional da clínica para hoje.</p>
        </div>
        <div className="flex items-center space-x-2 text-[10px] lg:text-sm bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm self-start md:self-auto">
          <Calendar size={16} className="text-blue-500" />
          <span className="font-black text-slate-600 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" size={24} />}
          label="Total de Pacientes"
          value={patientsCount.toString()}
          trend="+12% este mês"
          bgColor="bg-blue-50"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-600" size={24} />}
          label="Confirmados Hoje"
          value={confirmedCount.toString()}
          trend="Atendimentos ativos"
          bgColor="bg-emerald-50"
        />
        <StatCard 
          icon={<Heart className="text-rose-600" size={24} />}
          label="Corpo Clínico"
          value={doctorsCount.toString()}
          trend="Médicos ativos"
          bgColor="bg-rose-50"
        />
        <StatCard 
          icon={<Activity className="text-purple-600" size={24} />}
          label="Total Atendimentos"
          value="452"
          trend="+5% vs mês passado"
          bgColor="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Fluxo Semanal</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Volume de pacientes atendidos</p>
            </div>
          </div>
          <div className="h-64 lg:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px'}}
                  itemStyle={{fontWeight: 900, fontSize: '12px'}}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center tracking-tight">
            <AlertCircle size={20} className="mr-2 text-blue-600" />
            Alertas Críticos
          </h3>
          <div className="space-y-6">
            <AlertItem 
              icon={<ShieldCheck size={20} className="text-blue-600" />}
              title="Backup Concluído"
              desc="Sincronização com nuvem realizada com sucesso."
              time="Há 2 horas"
              bgColor="bg-blue-50"
            />
            <AlertItem 
              icon={<AlertCircle size={20} className="text-amber-600" />}
              title="Exame Pendente"
              desc="João Silva: Resultados prontos para revisão."
              time="Há 4 horas"
              bgColor="bg-amber-50"
            />
            <AlertItem 
              icon={<TrendingUp size={20} className="text-emerald-600" />}
              title="Faturamento"
              desc="Relatório mensal pronto para análise."
              time="Há 1 dia"
              bgColor="bg-emerald-50"
            />
          </div>
          <button
            type="button"
            onClick={() => alert('Central de mensagens sem novas pendências no momento.')}
            className="w-full mt-8 py-4 text-[10px] font-black text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors border border-dashed border-blue-200 uppercase tracking-widest"
          >
            Ver Central de Mensagens
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  trend: string;
  bgColor: string;
}> = ({ icon, label, value, trend, bgColor }) => (
  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 hover:shadow-md transition-all group">
    <div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    <div className="flex items-end space-x-2 mt-1">
      <h4 className="text-2xl font-black text-slate-800">{value}</h4>
      <span className="text-[10px] font-black text-emerald-500 mb-1 uppercase">{trend}</span>
    </div>
  </div>
);

const AlertItem: React.FC<{ icon: React.ReactNode; title: string; desc: string; time: string; bgColor: string }> = ({ icon, title, desc, time, bgColor }) => (
  <div className="flex space-x-4">
    <div className={`shrink-0 w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center`}>
      {icon}
    </div>
    <div className="flex-1 overflow-hidden">
      <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
      <p className="text-xs text-slate-500 truncate">{desc}</p>
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">{time}</span>
    </div>
  </div>
);

export default Dashboard;
