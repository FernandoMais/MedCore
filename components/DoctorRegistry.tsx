
import React, { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Filter, 
  Stethoscope, 
  ShieldCheck,
  Award
} from 'lucide-react';
import { Doctor } from '../types';

interface DoctorRegistryProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
}

const DoctorRegistry: React.FC<DoctorRegistryProps> = ({ doctors, setDoctors }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.crm.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Corpo Clínico</h1>
          <p className="text-slate-500">Gestão e acompanhamento dos profissionais da unidade.</p>
        </div>
        <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center space-x-2">
          <UserPlus size={18} />
          <span>CADASTRAR PROFISSIONAL</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Doctors Grid/List */}
        <div className={`space-y-4 ${selectedDoctor ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome, CRM ou especialidade..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl">
              <Filter size={20} />
            </button>
          </div>

          <div className={`grid gap-4 ${selectedDoctor ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {filteredDoctors.map((doctor) => (
              <div 
                key={doctor.id} 
                onClick={() => setSelectedDoctor(doctor)}
                className={`group cursor-pointer bg-white border rounded-3xl p-6 transition-all hover:shadow-lg ${
                  selectedDoctor?.id === doctor.id 
                    ? 'border-blue-500 ring-2 ring-blue-500/10' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-bold text-blue-600 text-xl border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
                    {doctor.name.split(' ').filter(n => n.length > 2).map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="p-2 bg-slate-50 rounded-full text-slate-400">
                    <Award size={18} />
                  </div>
                </div>
                
                <div>
                  <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{doctor.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Stethoscope size={14} className="text-blue-500" />
                    <span className="text-sm font-bold text-blue-600">{doctor.specialty}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-black">CRM {doctor.crm}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {['S', 'T', 'Q', 'Q', 'S'].map((day, i) => (
                      <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black ${
                        doctor.availableTimes.some(t => t.dayOfWeek.startsWith(day)) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {day}
                      </div>
                    ))}
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedDoctor && (
          <div className="lg:col-span-7 animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white border border-slate-200 rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-full sticky top-8">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 relative">
                <button 
                  onClick={() => setSelectedDoctor(null)}
                  className="absolute top-8 right-8 p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:shadow-md transition-all"
                >
                  <ChevronRight size={20} />
                </button>
                
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-100">
                    {selectedDoctor.name.split(' ').filter(n => n.length > 2).map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{selectedDoctor.name}</h2>
                    <p className="text-blue-600 font-bold text-lg">{selectedDoctor.specialty}</p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">CRM {selectedDoctor.crm}</span>
                      <span className="flex items-center text-emerald-500 text-xs font-bold">
                        <ShieldCheck size={14} className="mr-1" /> Credenciado
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Contact Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail Profissional</p>
                    <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                      <Mail size={16} className="text-blue-500" />
                      <span>{selectedDoctor.email}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone de Contato</p>
                    <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                      <Phone size={16} className="text-blue-500" />
                      <span>{selectedDoctor.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Available Times Section */}
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center">
                    <Clock size={16} className="mr-2 text-blue-600" />
                    Horários de Disponibilidade
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedDoctor.availableTimes.map((time, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-colors group">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                            {time.dayOfWeek.substring(0, 3)}
                          </div>
                          <span className="font-bold text-slate-700">{time.dayOfWeek}</span>
                        </div>
                        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                          <span className="text-xs font-black text-slate-500">{time.startTime}</span>
                          <span className="text-[10px] text-slate-300">—</span>
                          <span className="text-xs font-black text-slate-500">{time.endTime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-8 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex flex-col items-center justify-center p-6 bg-blue-50 border border-blue-100 rounded-[32px] group hover:bg-blue-600 transition-all">
                      <Calendar size={24} className="text-blue-600 group-hover:text-white mb-2 transition-colors" />
                      <span className="text-xs font-black text-blue-600 group-hover:text-white uppercase tracking-widest transition-colors">Ver Agenda</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-[32px] group hover:bg-slate-900 transition-all">
                      <Filter size={24} className="text-slate-400 group-hover:text-white mb-2 transition-colors" />
                      <span className="text-xs font-black text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">Relatórios</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end space-x-4">
                <button className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors">Editar Perfil</button>
                <button className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">Bloquear Horários</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorRegistry;
