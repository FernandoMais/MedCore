
import React from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Appointment, AppointmentStatus } from '../types';

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Bem-vindo, Dr. Ricardo</h1>
          <p className="text-slate-500 mt-1">Aqui está um resumo do dia hoje.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
          <Calendar size={16} className="text-blue-500" />
          <span className="font-medium text-slate-600">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          trend="85% taxa comparecimento"
          bgColor="bg-emerald-50"
        />
        <StatCard 
          icon={<Clock className="text-amber-600" size={24} />}
          label="Pendentes"
          value={pendingCount.toString()}
          trend="Próximas 4 horas"
          bgColor="bg-amber-50"
        />
        <StatCard 
          icon={<Activity className="text-purple-600" size={24} />}
          label="Atendimentos Realizados"
          value="452"
          trend="+5% vs mês passado"
          bgColor="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Fluxo de Atendimentos</h3>
              <p className="text-sm text-slate-500">Visualização semanal de consultas</p>
            </div>
            <select className="text-sm border border-slate-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 outline-none">
              <option>Últimos 7 dias</option>
              <option>Último mês</option>
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Notifications / Alerts */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Alertas & Notificações</h3>
          <div className="space-y-6">
            <div className="flex space-x-4">
              <div className="shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Exame de João Silva</p>
                <p className="text-xs text-slate-500">Resultado de Hemograma disponível para revisão.</p>
                <span className="text-[10px] text-slate-400 mt-1 block">Há 2 horas</span>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Novo Agendamento</p>
                <p className="text-xs text-slate-500">Maria Oliveira marcou um retorno para amanhã.</p>
                <span className="text-[10px] text-slate-400 mt-1 block">Há 5 horas</span>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Relatório Mensal</p>
                <p className="text-xs text-slate-500">Seu resumo de faturamento está pronto.</p>
                <span className="text-[10px] text-slate-400 mt-1 block">Ontem</span>
              </div>
            </div>
          </div>
          <button className="w-full mt-8 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            Ver todas notificações
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
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <div className="flex items-end space-x-2 mt-1">
      <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      <span className="text-xs font-semibold text-emerald-500 mb-1">{trend}</span>
    </div>
  </div>
);

export default Dashboard;
