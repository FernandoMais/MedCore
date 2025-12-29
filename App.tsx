
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
  UserPlus,
  Heart,
  ShieldCheck
} from 'lucide-react';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS, MOCK_DOCTORS } from './constants';
import { Patient, Appointment, AppointmentStatus, Doctor } from './types';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import Agenda from './components/Agenda';
import ConsultationRoom from './components/ConsultationRoom';
import DoctorRegistry from './components/DoctorRegistry';

type View = 'dashboard' | 'patients' | 'agenda' | 'consultation' | 'settings' | 'doctors';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [doctors, setDoctors] = useState<Doctor[]>(MOCK_DOCTORS);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    console.log("MedCore Pro initialized. All modules operational.");
  }, []);

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
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
      }`}
    >
      <div className={`${currentView === view ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'} transition-colors`}>
        {icon}
      </div>
      <span className="font-semibold text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-inner animate-pulse">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 leading-none">MedCore</h1>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">PLATFORM PRO</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
          <SidebarItem view="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarItem view="agenda" icon={<Calendar size={18} />} label="Agenda Médica" />
          <SidebarItem view="patients" icon={<Users size={18} />} label="Meus Pacientes" />
          <SidebarItem view="doctors" icon={<Heart size={18} />} label="Corpo Clínico" />
          <SidebarItem view="settings" icon={<Settings size={18} />} label="Configurações" />
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center p-3 rounded-xl bg-white border border-slate-200 mb-4 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-blue-100 mr-3 flex items-center justify-center font-bold text-blue-600 text-xs">
              RS
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-800">Dr. Ricardo Souza</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">CRM 123456/SP</p>
            </div>
          </div>
          <button className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all group">
            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
            <span className="font-bold text-xs uppercase tracking-widest">Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisa rápida (nome, cpf, id)..." 
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-slate-50"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 mr-4">
               <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistema Operante</span>
            </div>
            <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={() => setCurrentView('agenda')}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center space-x-2"
            >
              <Plus size={18} />
              <span>NOVO AGENDAMENTO</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {currentView === 'dashboard' && <Dashboard patientsCount={patients.length} appointments={appointments} />}
          {currentView === 'agenda' && <Agenda appointments={appointments} startConsultation={startConsultation} />}
          {currentView === 'patients' && <PatientManager patients={patients} setPatients={setPatients} />}
          {currentView === 'doctors' && <DoctorRegistry doctors={doctors} setDoctors={setDoctors} />}
          {currentView === 'consultation' && activeAppointmentId && (
            <ConsultationRoom 
              appointmentId={activeAppointmentId} 
              appointments={appointments}
              patients={patients}
              doctors={doctors}
              onFinish={() => setCurrentView('agenda')}
            />
          )}
          {currentView === 'settings' && (
            <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                 <Settings size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Configurações de Administrador</h2>
              <p className="text-slate-500 max-w-md">Este painel permite gerenciar permissões, logs de segurança (LGPD), integrações de API e modelos de documentos.</p>
              <button className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 active:scale-95 transition-transform">ACESSAR PAINEL DE CONTROLE</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
