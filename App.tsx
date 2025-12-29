
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  FileText, 
  LayoutDashboard, 
  LogOut, 
  Search, 
  Plus, 
  Bell, 
  Settings,
  ChevronRight,
  Clock,
  Activity,
  UserPlus
} from 'lucide-react';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS } from './constants';
import { Patient, Appointment, AppointmentStatus } from './types';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import Agenda from './components/Agenda';
import ConsultationRoom from './components/ConsultationRoom';

type View = 'dashboard' | 'patients' | 'agenda' | 'consultation' | 'settings';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);

  const startConsultation = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
    setCurrentView('consultation');
  };

  const SidebarItem: React.FC<{ 
    view: View; 
    icon: React.ReactNode; 
    label: string 
  }> = ({ view, icon, label }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-inner">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">MedCore</h1>
              <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">PRO</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          <SidebarItem view="dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <SidebarItem view="agenda" icon={<Calendar size={20} />} label="Agenda" />
          <SidebarItem view="patients" icon={<Users size={20} />} label="Pacientes" />
          <SidebarItem view="settings" icon={<Settings size={20} />} label="Configurações" />
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center p-3 rounded-lg bg-slate-50 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-300 mr-3 flex items-center justify-center font-bold text-slate-600">
              DR
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate text-slate-900">Dr. Ricardo Souza</p>
              <p className="text-xs text-slate-500">Cardiologia</p>
            </div>
          </div>
          <button className="w-full flex items-center space-x-3 px-4 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar paciente, prontuário..." 
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={() => setCurrentView('agenda')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus size={18} />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {currentView === 'dashboard' && <Dashboard patientsCount={patients.length} appointments={appointments} />}
          {currentView === 'agenda' && <Agenda appointments={appointments} startConsultation={startConsultation} />}
          {currentView === 'patients' && <PatientManager patients={patients} setPatients={setPatients} />}
          {currentView === 'consultation' && activeAppointmentId && (
            <ConsultationRoom 
              appointmentId={activeAppointmentId} 
              appointments={appointments}
              patients={patients}
              onFinish={() => setCurrentView('agenda')}
            />
          )}
          {currentView === 'settings' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold mb-4">Configurações do Sistema</h2>
              <p className="text-slate-500">Módulo de configurações em desenvolvimento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
