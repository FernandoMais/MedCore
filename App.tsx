
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
  ShieldCheck,
  Download,
  Upload,
  User as UserIcon
} from 'lucide-react';
import { Patient, Appointment, Doctor, MedicalRecord, User, UserRole } from './types';
import { storage } from './services/storage';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import Agenda from './components/Agenda';
import ConsultationRoom from './components/ConsultationRoom';
import DoctorRegistry from './components/DoctorRegistry';
import ExportCenter from './components/ExportCenter';
import Login from './components/Login';

type View = 'dashboard' | 'patients' | 'agenda' | 'consultation' | 'settings' | 'doctors' | 'backups';

const App: React.FC = () => {
  const [db, setDb] = useState(storage.init());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    storage.save(db);
  }, [db]);

  if (!currentUser) {
    return <Login users={db.users} onLogin={setCurrentUser} />;
  }

  // Filtragem de dados baseada no papel
  const filteredPatients = currentUser.role === UserRole.ADMIN 
    ? db.patients 
    : db.patients.filter(p => p.primaryDoctorId === currentUser.doctorId);

  const filteredAppointments = currentUser.role === UserRole.ADMIN
    ? db.appointments
    : db.appointments.filter(a => a.doctorId === currentUser.doctorId);

  const startConsultation = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
    setCurrentView('consultation');
  };

  const SidebarItem: React.FC<{ 
    view: View; 
    icon: React.ReactNode; 
    label: string;
    adminOnly?: boolean;
  }> = ({ view, icon, label, adminOnly }) => {
    if (adminOnly && currentUser.role !== UserRole.ADMIN) return null;
    
    return (
      <button
        onClick={() => setCurrentView(view)}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
          currentView === view 
            ? 'bg-blue-600 text-white shadow-lg' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
        }`}
      >
        <div className={`${currentView === view ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
          {icon}
        </div>
        <span className="font-bold text-sm tracking-tight">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-800 leading-none">MedCore</h1>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                {currentUser.role === UserRole.ADMIN ? 'ADMIN PANEL' : 'DOCTOR PORTAL'}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
          <SidebarItem view="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarItem view="agenda" icon={<Calendar size={18} />} label="Minha Agenda" />
          <SidebarItem view="patients" icon={<Users size={18} />} label="Meus Pacientes" />
          <SidebarItem view="doctors" icon={<Heart size={18} />} label="Corpo Clínico" adminOnly />
          <SidebarItem view="backups" icon={<Download size={18} />} label="Exportar Dados" adminOnly />
          <SidebarItem view="settings" icon={<Settings size={18} />} label="Configurações" adminOnly />
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center p-3 rounded-xl bg-white border border-slate-200 mb-4 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-blue-100 mr-3 flex items-center justify-center font-bold text-blue-600 text-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-800">{currentUser.name}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                {currentUser.role === UserRole.ADMIN ? 'ADMIN' : 'MÉDICO TITULAR'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all group"
          >
            <LogOut size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Busca inteligente..." 
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={() => setCurrentView('agenda')}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-200"
            >
              <span>+ NOVA CONSULTA</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {currentView === 'dashboard' && <Dashboard patientsCount={filteredPatients.length} appointments={filteredAppointments} />}
          {currentView === 'agenda' && <Agenda appointments={filteredAppointments} startConsultation={startConsultation} />}
          {currentView === 'patients' && (
            <PatientManager 
              patients={filteredPatients} 
              setPatients={(newP) => setDb(p => ({...p, patients: typeof newP === 'function' ? newP(p.patients) : newP}))}
              doctors={db.doctors}
              isAdmin={currentUser.role === UserRole.ADMIN}
            />
          )}
          {currentView === 'doctors' && (
            <DoctorRegistry 
              doctors={db.doctors} 
              setDoctors={(newD) => setDb(p => ({...p, doctors: typeof newD === 'function' ? newD(p.doctors) : newD}))}
              setUsers={(newU) => setDb(p => ({...p, users: typeof newU === 'function' ? newU(p.users) : newU}))}
            />
          )}
          {currentView === 'backups' && (
            <ExportCenter 
              onExport={storage.exportBackup} 
              onImport={async (file) => {
                await storage.importBackup(file);
                window.location.reload();
              }}
            />
          )}
          {currentView === 'consultation' && activeAppointmentId && (
            <ConsultationRoom 
              appointmentId={activeAppointmentId} 
              appointments={db.appointments}
              patients={db.patients}
              doctors={db.doctors}
              onFinish={() => setCurrentView('agenda')}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
