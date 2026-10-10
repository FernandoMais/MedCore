
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
  RefreshCw,
  BarChart3,
  PieChart,
  Pill,
  Wallet,
  Menu,
  X
} from 'lucide-react';
import { Patient, Appointment, Doctor, MedicalRecord, User, UserRole, AppointmentStatus, Medication, SigilousNote, FinanceSection } from './types';
import type { AppDatabase } from './services/storage';
import { storage } from './services/operationalStorage';
import { OperationalCenter } from './components/OperationalCenter';
import { supabase } from './services/supabase';
import { ensureFinancialEntriesForAppointment } from './services/financialAutomation';
import Dashboard from './components/Dashboard';
import PatientManager from './components/PatientManager';
import Agenda from './components/Agenda';
import ConsultationRoom from './components/ConsultationRoom';
import DoctorRegistry from './components/DoctorRegistry';
import ExportCenter from './components/ExportCenter';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import AppointmentReport from './components/AppointmentReport';
import MedicationRegistry from './components/MedicationRegistry';
import PatientSelfRegister from './components/PatientSelfRegister';
import PatientLogin from './components/PatientLogin';
import PatientPortal from './components/PatientPortal';
import FinancialModule from './components/FinancialModule';
import PatientPasswordReset from './components/PatientPasswordReset';
import StaffPasswordReset from './components/StaffPasswordReset';
import { freshStartEnabled } from './services/freshStart';
import {
  registerPatient, loadPatientPortal, bookPatientAppointment, logoutPatient,
  isPatientRecoveryPage, isPatientConfirmationPage, clearPatientCallbackUrl,
} from './services/patientAuth';

type View = 'dashboard' | 'patients' | 'agenda' | 'consultation' | 'settings' | 'doctors' | 'backups' | 'reports' | 'medications' | 'finance';
type AppScreen = 'landing' | 'login' | 'self-register' | 'app';

const App: React.FC = () => {
  const [db, setDb] = useState<AppDatabase>(storage.initLocal());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [financeSection, setFinanceSection] = useState<FinanceSection>('dashboard');
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'offline' | 'pending'>('offline');
  const [cloudReady, setCloudReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showSelfRegister, setShowSelfRegister] = useState(false);
  const [showPatientLogin, setShowPatientLogin] = useState(false);
  const [loggedPatient, setLoggedPatient] = useState<import('./types').Patient | null>(null);
  const [patientPortalData, setPatientPortalData] = useState<{ doctors: Doctor[]; appointments: Appointment[] }>({ doctors: [], appointments: [] });
  const [showPatientRecovery, setShowPatientRecovery] = useState(isPatientRecoveryPage);
  const [showPatientConfirmation, setShowPatientConfirmation] = useState(isPatientConfirmationPage);
  const [showStaffRecovery, setShowStaffRecovery] = useState(() =>
    freshStartEnabled && new URLSearchParams(window.location.search).get('staff-auth') === 'recovery');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [syncError,setSyncError]=useState('');
  useEffect(()=>{
    if(!currentUser&&!loggedPatient)return;
    let lastActivity=Date.now();
    const activity=()=>{
      if(Date.now()-lastActivity>=10*60*1000){returnHome();return;}
      lastActivity=Date.now();
    };
    ['pointerdown','keydown','touchstart'].forEach(event=>window.addEventListener(event,activity));
    const timer=setInterval(()=>{
      if(Date.now()-lastActivity>=10*60*1000)returnHome();
    },1000);
    const authority=setInterval(async()=>{
      if(!currentUser)return;
      const binding=await supabase.rpc('bind_current_user');
      const profile=await supabase.from('users').select('id,role,active').eq('id',currentUser.id).maybeSingle();
      if(binding.error||profile.error||!profile.data?.active||profile.data.role!==currentUser.role)handleLogout();
    },30000);
    return()=>{clearInterval(timer);clearInterval(authority);['pointerdown','keydown','touchstart'].forEach(event=>window.removeEventListener(event,activity));};
  },[currentUser,loggedPatient]);

  useEffect(() => {
    // Close sidebar on mobile when view changes
    setIsSidebarOpen(false);
  }, [currentView]);

  useEffect(() => {
    const syncInit = async () => {
      const cloudData = await storage.fetchFromCloud();
      if (cloudData && Object.keys(cloudData).length > 0) {
        setDb(prev => ({ ...prev, ...cloudData }));
        setCloudStatus('connected');
      }
    };
    syncInit();
  }, []);

  useEffect(() => {
    void storage.save(db).catch(()=>setSyncError('As pendências não puderam ser protegidas neste navegador. Aguarde uma gravação confirmada antes de sair.'));
    if (currentUser && cloudReady) setCloudStatus('pending');
    const cloudSync = async () => {
      if (currentUser && cloudReady) {
        setIsSyncing(true);
        try {
          await storage.syncToCloud(db, currentUser.clinicId);
          setCloudStatus('connected');
          setSyncError('');
        } catch (err) {
          setCloudStatus('offline');
          setSyncError(err instanceof Error?err.message:'Gravação não confirmada.');
        } finally {
          setTimeout(() => setIsSyncing(false), 1000);
        }
      }
    };
    const timer = setTimeout(cloudSync, 3000);
    return () => clearTimeout(timer);
  }, [db, currentUser, cloudReady]);

  const handleLogin = async (user: User) => {
    setIsLoading(true);
    setCloudReady(false);
    storage.resetCloudSyncState();
    setCurrentUser(user);
    // Só busca dados financeiros depois que o login vinculou a sessão ao
    // tenant. Antes disso, o fetch é deliberadamente um no-op.
    try {
      await storage.prepareSession(user.role);
      const cloudData = await storage.fetchFromCloud(user.clinicId);
      setDb(prev => ({ ...prev, ...cloudData }));
      const pending=await storage.getPendingChanges();
      if(pending?.changes?.length)setSyncError('Há alterações criptografadas não confirmadas da sua sessão anterior. Revise ou recupere essas pendências antes de continuar.');
      setCloudReady(true);
      setCloudStatus('connected');
    } catch(e) {
      setCloudStatus('offline');
      setSyncError(e instanceof Error?e.message:'Não foi possível abrir a sessão segura.');
    } finally {
      setIsLoading(false);
    }
    setCurrentView('dashboard');
    setActiveAppointmentId(null);
    setShowLanding(false);
  };

  const handleLogout = () => {
    import('./services/auth').then(m => m.logoutUser()).catch(() => {});
    setCurrentUser(null);
    setCloudReady(false);
    storage.resetCloudSyncState();
    setDb(storage.initLocal());
    setSyncError('');
    setCurrentView('dashboard');
    setActiveAppointmentId(null);
    setShowLanding(true);
  };

  const returnHome = () => {
    handleLogout();
    logoutPatient().catch(() => {});
    setLoggedPatient(null);
    setPatientPortalData({ doctors: [], appointments: [] });
    setShowPatientLogin(false);
    setShowSelfRegister(false);
    setShowPatientRecovery(false);
    setShowPatientConfirmation(false);
    setShowStaffRecovery(false);
    clearPatientCallbackUrl();
  };

  const reloadOperationalData=async()=>{
    if(!currentUser)return;
    const fresh=await storage.fetchFromCloud(currentUser.clinicId);
    setDb(prev=>({...prev,...fresh}));
    const me=fresh.users?.find(u=>u.id===currentUser.id);
    if(me&&(me.role!==currentUser.role||(me as any).active===false))handleLogout();
    setCloudStatus('connected');setSyncError('');
  };

  if (showPatientRecovery) {
    return <PatientPasswordReset onBack={returnHome} />;
  }

  if (showStaffRecovery) {
    return <StaffPasswordReset onBack={returnHome} />;
  }

  if (showPatientConfirmation) {
    const callbackHasError = new URLSearchParams(window.location.hash.slice(1)).has('error')
      || new URLSearchParams(window.location.search).has('error');
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-lg text-center">
          <ShieldCheck size={40} className="mx-auto text-blue-600 mb-4" />
          <h1 className="text-2xl font-black text-slate-800">Acesso do paciente</h1>
          <p className="text-slate-600 mt-4">
            {callbackHasError
              ? 'O link de confirmação é inválido ou expirou. Entre em contato com a clínica para receber um novo link.'
              : 'A confirmação será validada no seu próximo acesso. Entre com seu CPF e a senha criada no cadastro.'}
          </p>
          <button onClick={returnHome} className="mt-6 bg-blue-600 text-white rounded-xl px-5 py-3 font-bold">
            Voltar à página inicial
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center text-white animate-bounce shadow-2xl shadow-blue-200 mb-6">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">Processando dados...</h2>
      </div>
    );
  }

  if (showSelfRegister) {
    return (
      <PatientSelfRegister
        onBack={returnHome}
        onSubmit={registerPatient}
      />
    );
  }

  if (showPatientLogin) {
    if (loggedPatient) {
      return (
        <PatientPortal
          patient={loggedPatient}
          doctors={patientPortalData.doctors}
          appointments={patientPortalData.appointments}
          onAddAppointment={async (appt) => {
            const saved = await bookPatientAppointment(loggedPatient, appt);
            setPatientPortalData(prev => ({ ...prev, appointments: [saved, ...prev.appointments] }));
          }}
          onLogout={returnHome}
        />
      );
    }
    return (
      <PatientLogin
        onLogin={async (patient) => {
          try {
            const portal = await loadPatientPortal(patient);
            setPatientPortalData(portal);
            setLoggedPatient(patient);
          } catch (error) {
            await logoutPatient();
            throw error;
          }
        }}
        onBack={returnHome}
      />
    );
  }

  if (showLanding && !currentUser) {
    return (
      <LandingPage
        onEnter={() => setShowLanding(false)}
        onSelfRegister={() => setShowSelfRegister(true)}
        onPatientLogin={() => { setShowLanding(false); setShowPatientLogin(true); }}
      />
    );
  }

  if (!currentUser) {
    return <Login users={db.users || []} onLogin={handleLogin} />;
  }

  if (!cloudReady) {
    return <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg bg-white rounded-3xl p-8 space-y-5">
        <h1 className="text-xl font-black">Não foi possível carregar os dados da clínica</h1>
        <p>Para evitar gravar uma cópia antiga sobre o prontuário, a edição está suspensa até uma leitura confirmada do Supabase.</p>
        {syncError&&<p role="alert">{syncError}</p>}
        <button className="bg-blue-600 text-white rounded-xl px-5 py-3 font-bold" onClick={() => handleLogin(currentUser)}>Tentar conexão novamente</button>
        <button className="block text-slate-600 font-bold" onClick={handleLogout}>Voltar ao acesso</button>
      </div>
    </div>;
  }

  const seesAllRecords = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.COLLABORATOR;

  const filteredPatients = (db.patients || []).filter(p =>
    seesAllRecords || p.primaryDoctorId === currentUser.doctorId
  );

  const filteredAppointments = (db.appointments || []).filter(a =>
    seesAllRecords || a.doctorId === currentUser.doctorId
  );

  const startConsultation = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
    setCurrentView('consultation');
  };

  const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatus) => {
    setDb(prev => {
      const appointment = (prev.appointments || []).find(item => item.id === appointmentId);
      if (!appointment) return prev;

      const nextAppointments = (prev.appointments || []).map(item =>
        item.id === appointmentId ? { ...item, status } : item,
      );
      const shouldGenerateFinancialEntries = status === AppointmentStatus.CONFIRMED || status === AppointmentStatus.FINISHED;
      const nextFinancial = shouldGenerateFinancialEntries
        ? ensureFinancialEntriesForAppointment(
            prev.financial,
            appointment,
            currentUser.clinicId,
          )
        : prev.financial;

      return {
        ...prev,
        appointments: nextAppointments,
        financial: nextFinancial,
      };
    });
  };

  const handleFinishConsultation = async (evolutionData?: { 
    diagnosis: string; 
    conduct: string; 
    complaint: string; 
    prescription: string;
    especialidade?: string;
    senha_acesso?: string;
  }) => {
    if (activeAppointmentId && evolutionData && currentUser) {
      await storage.syncToCloud(db,currentUser.clinicId);
      const saved = await storage.finishConsultation(activeAppointmentId, evolutionData);
      setDb(prev => ({
        ...prev,
        appointments: prev.appointments.map(a => a.id === saved.appointment.id ? saved.appointment : a),
        evolutions: [saved.evolution, ...(prev.evolutions || []).filter(e => e.id !== saved.evolution.id)],
        financial: {...prev.financial,transactions:saved.transactions,repasses:saved.repasses},
      }));
      alert("Atendimento, evolução e geração financeira confirmados em uma única transação no Supabase.");
      setActiveAppointmentId(null);
      setCurrentView('agenda');
    } else {
      setActiveAppointmentId(null);
      setCurrentView('agenda');
    }
  };

  const SidebarItem: React.FC<{ 
    view: View; 
    icon: React.ReactNode; 
    label: string;
    adminOnly?: boolean;
    allowedRoles?: UserRole[];
  }> = ({ view, icon, label, adminOnly, allowedRoles }) => {
    if (adminOnly && currentUser.role !== UserRole.ADMIN) return null;
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) return null;
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          setIsSidebarOpen(false);
        }}
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

  const financialNavigation: Array<{ section: FinanceSection; label: string }> = [
    { section: 'dashboard', label: 'Dashboard Financeiro' },
    { section: 'receivable', label: 'Contas a Receber' },
    { section: 'payable', label: 'Contas a Pagar' },
    { section: 'cashflow', label: 'Fluxo de Caixa' },
    { section: 'income', label: 'Receitas' },
    { section: 'expenses', label: 'Despesas' },
    { section: 'payments', label: 'Pagamentos' },
    { section: 'repasses', label: 'Repasses aos Profissionais' },
    { section: 'cash', label: 'Caixa' },
    { section: 'bank-accounts', label: 'Contas Bancárias' },
    { section: 'categories', label: 'Categorias Financeiras' },
    { section: 'cost-centers', label: 'Centros de Custo' },
    { section: 'payment-methods', label: 'Formas de Pagamento' },
    { section: 'insurance', label: 'Convênios e Planos' },
    { section: 'billing', label: 'Faturamento' },
    { section: 'reconciliation', label: 'Conciliação Bancária' },
    { section: 'delinquency', label: 'Inadimplência' },
    { section: 'reports', label: 'Relatórios Financeiros' },
    { section: 'settings', label: 'Configurações Financeiras' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 no-print z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-800 leading-none">MedCore</h1>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                {currentUser.role === UserRole.ADMIN
                  ? 'ADMIN PANEL'
                  : currentUser.role === UserRole.COLLABORATOR
                    ? 'COLLABORATOR PORTAL'
                    : 'DOCTOR PORTAL'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
          <SidebarItem view="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarItem view="agenda" icon={<Calendar size={18} />} label="Minha Agenda" />
          <SidebarItem view="patients" icon={<Users size={18} />} label="Meus Pacientes" />
          <SidebarItem view="medications" icon={<Pill size={18} />} label="Medicamentos" />
          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setCurrentView('finance');
                setFinanceSection('dashboard');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                currentView === 'finance'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
              }`}
            >
              <Wallet size={18} className={currentView === 'finance' ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'} />
              <span className="font-black text-sm tracking-tight uppercase">Financeiro</span>
            </button>
            {currentView === 'finance' && (
              <div className="mt-2 ml-2 pl-3 border-l-2 border-blue-100 space-y-0.5">
                {financialNavigation.map(item => (
                  <button
                    key={item.section}
                    onClick={() => {
                      setCurrentView('finance');
                      setFinanceSection(item.section);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                      financeSection === item.section
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-blue-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SidebarItem view="reports" icon={<BarChart3 size={18} />} label="Relatórios" adminOnly />
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
                {currentUser.role === UserRole.ADMIN
                  ? 'ADMIN'
                  : currentUser.role === UserRole.COLLABORATOR
                    ? 'COLABORADOR'
                    : 'MÉDICO'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {cloudStatus !== 'connected' && <div role="status" className="bg-amber-50 border-b border-amber-200 p-3 text-sm text-amber-900">
          A sincronização não foi confirmada. Alterações de cadastro, agenda ou financeiro podem estar pendentes neste computador; não as considere salvas na nuvem.
        </div>}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 z-30 no-print">
          <div className="flex items-center space-x-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="relative w-full max-w-96 group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Busca inteligente de prontuários..." 
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50 font-medium"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 lg:space-x-6">
            <div className={`flex items-center space-x-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border shadow-inner transition-all ${cloudStatus === 'connected' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              {isSyncing ? (
                <RefreshCw size={14} className="text-blue-500 animate-spin" />
              ) : cloudStatus === 'connected' ? (
                <Cloud size={14} className="text-emerald-500" />
              ) : (
                <CloudOff size={14} className="text-slate-400" />
              )}
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] hidden sm:inline-block ${cloudStatus === 'connected' ? 'text-emerald-700' : 'text-slate-400'}`}>
                {isSyncing ? 'Salvando...' : cloudStatus === 'connected' ? 'Cloud Online' : cloudStatus === 'pending' ? 'Verificando pendências' : 'Gravação não confirmada'}
              </span>
            </div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50">
          {syncError&&<div role="alert" className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p>{syncError} Não feche esta tela enquanto houver alterações não confirmadas.</p>
            <button className="mt-2 mr-4 underline font-semibold" onClick={()=>void storage.recoverPendingChanges().then(reloadOperationalData).catch(e=>setSyncError(e.message))}>Recuperar pendências protegidas desta conta</button>
            <button className="mt-2 mr-4 underline" onClick={()=>{
              if(confirm('Descartar somente as alterações locais não confirmadas desta conta? Nenhum registro do servidor será apagado.'))
                void storage.discardPendingChanges().then(reloadOperationalData).catch(e=>setSyncError(e.message));
            }}>Descartar pendências locais após revisão</button>
            <button className="mt-2 underline font-semibold" onClick={()=>{
              if(confirm('Recarregar os dados do servidor? Alterações de cadastros ainda não confirmadas nesta tela serão descartadas. O rascunho criptografado da consulta permanece.'))
                void reloadOperationalData().catch(e=>setSyncError(e.message));
            }}>Recarregar para comparar com os dados confirmados</button>
          </div>}
          {currentView === 'dashboard' && <Dashboard patientsCount={filteredPatients.length} appointments={filteredAppointments} doctorsCount={(db.doctors || []).length} />}
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
               onUpdateAppointmentStatus={updateAppointmentStatus}
              startConsultation={startConsultation} 
            />
          )}
          {currentView === 'patients' && (
            <PatientManager 
              onBackHome={returnHome}
              patients={filteredPatients} 
              setPatients={(newP) => setDb(prev => {
                const visible=new Set(filteredPatients.map(p=>p.id));
                const patientsList = (prev.patients || []).filter(p=>visible.has(p.id));
                const nextPatients = typeof newP === 'function' ? newP(patientsList) : newP;
                return { ...prev, patients: [...prev.patients.filter(p=>!visible.has(p.id)),...nextPatients] };
              })}
              doctors={db.doctors || []}
              isAdmin={currentUser.role === UserRole.ADMIN}
              currentUser={currentUser}
              sigilousNotes={db.sigilousNotes || []}
            />
          )}
          {currentView === 'medications' && (
            <MedicationRegistry 
              medications={db.medications || []}
              setMedications={(newM) => setDb(prev => {
                const medicationsList = prev.medications || [];
                const nextMedications = typeof newM === 'function' ? newM(medicationsList) : newM;
                return { ...prev, medications: nextMedications };
              })}
            />
          )}
          {currentView === 'reports' && (
            <AppointmentReport 
              appointments={db.appointments || []} 
              patients={db.patients || []} 
              doctors={db.doctors || []} 
            />
          )}
          {currentView === 'finance' && (
            <FinancialModule
              section={financeSection}
              clinicId={currentUser.clinicId}
              currentUser={currentUser}
              patients={filteredPatients}
              doctors={db.doctors || []}
              appointments={filteredAppointments}
              data={db.financial}
              onUpdate={(financial) => setDb(prev => ({ ...prev, financial }))}
            />
          )}
          {currentView === 'doctors' && (
            <div className="space-y-8">
            <OperationalCenter db={db} user={currentUser} onReload={reloadOperationalData} team/>
            <DoctorRegistry providersOnly
              doctors={db.doctors || []} 
              users={[]}
              clinicId={currentUser.clinicId}
              setDoctors={(newD) => setDb(prev => {
                const doctorsList = prev.doctors || [];
                const nextDoctors = typeof newD === 'function' ? newD(doctorsList) : newD;
                return { ...prev, doctors: nextDoctors };
              })}
              setUsers={()=>{}}
            />
            </div>
          )}
          {currentView === 'backups' && (
            <OperationalCenter db={db} user={currentUser} onReload={reloadOperationalData}/>
          )}
          {currentView === 'consultation' && activeAppointmentId && (
            <ConsultationRoom 
              key={activeAppointmentId}
              appointmentId={activeAppointmentId} 
              appointments={db.appointments || []}
              patients={db.patients || []}
              doctors={db.doctors || []}
              medications={db.medications || []}
              currentUser={currentUser}
              users={db.users || []}
              sigilousNotes={db.sigilousNotes || []}
              setMedications={(newM) => setDb(prev => {
                const medicationsList = prev.medications || [];
                const nextMedications = typeof newM === 'function' ? newM(medicationsList) : newM;
                return { ...prev, medications: nextMedications };
              })}
              onAddSigilousNote={async (note: SigilousNote) => {
                const confirmed=await storage.saveSigilousNoteToCloud(note);
                setDb(prev => ({
                  ...prev,
                  sigilousNotes: [confirmed, ...(prev.sigilousNotes || []).filter(n=>n.id!==confirmed.id)]
                }));
              }}
              onFinish={handleFinishConsultation}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
