import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Sparkles, 
  ChevronRight, 
  History, 
  Calendar, 
  Users,
  Database,
  ArrowRight
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-emerald-50 rounded-full blur-[100px] opacity-50"></div>
        <div className="absolute -bottom-[5%] left-[20%] w-[35%] h-[35%] bg-indigo-50 rounded-full blur-[130px] opacity-40"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 md:px-20 py-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900">MedCore<span className="text-blue-600">Pro</span></h1>
        </div>
        <button 
          onClick={onEnter}
          className="hidden md:flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
        >
          <span>Acesso Restrito</span>
          <ChevronRight size={14} />
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 px-8 md:px-20 pt-16 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-10">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-full text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-700">
            <Sparkles size={14} className="animate-pulse" />
            <span>Inteligência Artificial & Gestão em Nuvem</span>
          </div>

          <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Sua Clínica na <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Velocidade da Luz.</span>
          </h2>

          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            O ecossistema definitivo para médicos modernos. Prontuário eletrônico inteligente, agenda dinâmica e assistência clínica por IA integrada ao Supabase.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
              onClick={onEnter}
              className="group relative px-12 py-6 bg-blue-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center space-x-4 overflow-hidden"
            >
              <span className="relative z-10">Iniciar Atendimento</span>
              <ArrowRight size={18} className="relative z-10 group-hover:translate-x-2 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
              <ShieldCheck size={14} className="mr-2 text-emerald-500" />
              Segurança em nível bancário (LGPD)
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
          <FeatureCard 
            icon={<History className="text-blue-600" />}
            title="Prontuário Infinito"
            desc="Histórico clínico completo com visualização split-screen e busca instantânea de registros passados."
          />
          <FeatureCard 
            icon={<Activity className="text-indigo-600" />}
            title="Assistente Gemini IA"
            desc="Sugestões de CID-10 e diagnósticos automáticos baseados em queixas principais em tempo real."
          />
          <FeatureCard 
            icon={<Database className="text-emerald-600" />}
            title="Supabase Cloud"
            desc="Seus dados sincronizados instantaneamente entre todos os dispositivos com segurança de ponta."
          />
        </div>
      </main>

      {/* Stats Section */}
      <section className="bg-slate-50 py-24 border-y border-slate-100 relative z-10">
        <div className="max-w-6xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          <Stat label="Médicos Ativos" value="2.4k+" />
          <Stat label="Consultas/Mês" value="850k" />
          <Stat label="Uptime Server" value="99.9%" />
          <Stat label="IA Precision" value="94.2%" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-8 text-center relative z-10">
        <div className="flex items-center justify-center space-x-3 mb-8 opacity-40">
           <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <ShieldCheck size={18} />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900">MedCore Pro</h1>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          © 2024 MEDCORE SYSTEMS S.A. • DESENVOLVIDO PARA ALTA PERFORMANCE CLÍNICA.
        </p>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="p-10 bg-white border border-slate-100 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
      {/* Fix: Added safety check and any casting to React.ReactElement to resolve TS error with 'size' prop in cloneElement */}
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 32 }) : icon}
    </div>
    <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">{title}</h3>
    <p className="text-sm text-slate-500 font-medium leading-relaxed">{desc}</p>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="space-y-2">
    <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{value}</h4>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

export default LandingPage;