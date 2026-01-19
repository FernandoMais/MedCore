
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
  User as UserIcon,
  Database,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { Patient, Appointment, Doctor, MedicalRecord, User, UserRole, AppointmentStatus } from './types';
import { storage, AppDatabase } from './services/storage';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import Agenda from './components/Agenda';
import ConsultationRoom from './components/ConsultationRoom';
import DoctorRegistry from './components/DoctorRegistry';
import ExportCenter from './components/ExportCenter';
import Login from './components/Login';

type View = 'dashboard' | 'patients' | 'agenda' | 'consultation' | 'settings' | 'doctors' | 'backups';

const App: React.FC = () => {
  const [db, setDb] = useState<AppDatabase>(storage.initLocal());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'offline'>('offline');
  const [isLoading, setIsLoading] = useState(true);

  // Boot: Sincronização Inicial com Supabase
  useEffect(() => {
    const syncInit = async () => {
      setIsLoading(true);
      const cloudData = await storage.fetchFromCloud();
      
      setDb(prev => ({
        ...prev,
        ...cloudData
      }));
      
      if (cloudData && Object.keys(cloudData).length > 0) {
        setCloudStatus('connected');
      }
      setIsLoading(false);
    };
    
    syncInit();
  }, []);

  // Persistência Atômica (Local + Cloud)
  useEffect(() => {
    if (isLoading) return;
    
    storage.save(db);
    
    const cloudSync = async () => {
      setIsSyncing(true);
      try {
        await storage.syncToCloud(db);
        setCloudStatus('connected');
      } catch (err) {
        console.error("Cloud sync failed", err);
        setCloudStatus('offline');
      } finally {
        setTimeout(() => setIsSyncing(false), 1000);
      }
    };

    const timer = setTimeout(cloudSync, 2000);
    return () => clearTimeout(timer);
  }, [db, isLoading]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center text-white animate-bounce shadow-2xl shadow-blue-200 mb-6">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">Sincronizando MedCore Cloud</h2>
        <div className="flex items-center space-x-2 mt-4">
          <RefreshCw size={14} className="animate-spin text-blue-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Supabase...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login users={db.users || []} onLogin={setCurrentUser} />;
  }

  const filteredPatients = (db.patients || []).filter(p => 
    currentUser.role === UserRole.ADMIN || p.primaryDoctorId === currentUser.doctorId
  );

  const filteredAppointments = (db.appointments || []).filter(a => 
    currentUser.role === UserRole.ADMIN || a.doctorId === currentUser.doctorId
  );

  const startConsultation = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
    setCurrentView('consultation');
  };

  const handleFinishConsultation = (evolutionData?: { diagnosis: string; conduct: string; complaint: string }) => {
    // Se houver dados de evolução, salvamos no prontuário do paciente
    if (activeAppointmentId && evolutionData) {
      setDb(prev => {
        const appointment = prev.appointments.find(a => a.id === activeAppointmentId);
        if (!appointment) return prev;

        const dateStr = new Date().toLocaleDateString('pt-BR');
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const newEntry = `[DATA: ${dateStr} às ${timeStr}]\nQUEIXA: ${evolutionData.complaint}\nDIAGNÓSTICO: ${evolutionData.diagnosis}\nCONDUTA: ${evolutionData.conduct}\n\n`;
        
        const updatedPatients = (prev.patients || []).map(p => 
          p.id === appointment.patientId 
            ? { ...p, history: newEntry + (p.history || '') } 
            : p
        );
        
        const updatedAppointments = (prev.appointments || []).map(a => 
          a.id === activeAppointmentId 
            ? { ...a, status: AppointmentStatus.FINISHED } 
            : a
        );

        return {
          ...prev,
          patients: updatedPatients,
          appointments: updatedAppointments
        };
      });
    }
    
    // Independente de ter dados ou não (ex: botão voltar), fechamos a sala de consulta
    setActiveAppointmentId(null);
    setCurrentView('agenda');
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
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 no-print">
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
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center p-3 rounded-xl bg-white border border-slate-200 mb-4 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-blue-100 mr-3 flex items-center justify-center font-bold text-blue-600 text-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-800">{currentUser.name}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                {currentUser.role === UserRole.ADMIN ? 'ADMIN' : 'MÉDICO'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30 no-print">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Busca inteligente de prontuários..." 
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50 font-medium"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border shadow-inner transition-all ${cloudStatus === 'connected' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              {isSyncing ? (
                <RefreshCw size={14} className="text-blue-500 animate-spin" />
              ) : cloudStatus === 'connected' ? (
                <Cloud size={14} className="text-emerald-500" />
              ) : (
                <CloudOff size={14} className="text-slate-400" />
              )}
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${cloudStatus === 'connected' ? 'text-emerald-700' : 'text-slate-400'}`}>
                {isSyncing ? 'Salvando Nuvem...' : cloudStatus === 'connected' ? 'Supabase Online' : 'Cloud Offline'}
              </span>
              {cloudStatus === 'connected' && !isSyncing && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>}
            </div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {currentView === 'dashboard' && <Dashboard patientsCount={filteredPatients.length} appointments={filteredAppointments} />}
          {currentView === 'agenda' && (
            <Agenda 
              appointments={filteredAppointments} 
              setAppointments={(newA) => setDb(prev => {
                const apptsList = prev.appointments || [];
                const nextAppts = typeof newA === 'function' ? newA(apptsList) : newA;
                return { ...prev, appointments: nextAppts };
              })}
              patients={filteredPatients}
              doctors={db.doctors || []}
              currentUser={currentUser}
              startConsultation={startConsultation} 
            />
          )}
          {currentView === 'patients' && (
            <PatientManager 
              patients={filteredPatients} 
              setPatients={(newP) => setDb(prev => {
                const patientsList = prev.patients || [];
                const nextPatients = typeof newP === 'function' ? newP(patientsList) : newP;
                return { ...prev, patients: nextPatients };
              })}
              doctors={db.doctors || []}
              isAdmin={currentUser.role === UserRole.ADMIN}
            />
          )}
          {currentView === 'doctors' && (
            <DoctorRegistry 
              doctors={db.doctors || []} 
              users={db.users || []}
              setDoctors={(newD) => setDb(prev => {
                const doctorsList = prev.doctors || [];
                const nextDoctors = typeof newD === 'function' ? newD(doctorsList) : newD;
                return { ...prev, doctors: nextDoctors };
              })}
              setUsers={(newU) => setDb(prev => {
                const usersList = prev.users || [];
                const nextUsers = typeof newU === 'function' ? newU(usersList) : newU;
                return { ...prev, users: nextUsers };
              })}
            />
          )}
          {currentView === 'backups' && (
            <ExportCenter 
              onExport={storage.exportBackup} 
              onImport={async (file) => {
                try {
                  await storage.importBackup(file);
                  window.location.reload();
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            />
          )}
          {currentView === 'consultation' && activeAppointmentId && (
            <ConsultationRoom 
              appointmentId={activeAppointmentId} 
              appointments={db.appointments || []}
              patients={db.patients || []}
              doctors={db.doctors || []}
              onFinish={handleFinishConsultation}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
