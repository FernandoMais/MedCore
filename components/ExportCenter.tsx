
import React from 'react';
import { 
  Download, 
  Upload, 
  FileJson, 
  ShieldCheck, 
  Database,
  FileText,
  Clock,
  ExternalLink
} from 'lucide-react';

interface ExportCenterProps {
  onExport: () => void;
  onImport: (file: File) => void;
}

const ExportCenter: React.FC<ExportCenterProps> = ({ onExport, onImport }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-start gap-2">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Exportação & Backup</h1>
        <p className="text-slate-500">Garanta a segurança dos seus dados clínicos e exporte prontuários completos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Database size={28} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Backup Completo (JSON)</h3>
          <p className="text-sm text-slate-500 mb-8">Exporta toda a base de dados (pacientes, médicos, agendamentos e prontuários) em um único arquivo de segurança.</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={onExport}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Download size={18} />
              <span>Fazer Download do Backup</span>
            </button>
            <label className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer">
              <Upload size={18} />
              <span>Restaurar de Arquivo</span>
              <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* PDF Export Info */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <FileText size={28} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Prontuários para PDF</h3>
          <p className="text-sm text-slate-500 mb-8">Para exportar prontuários individuais como PDF, acesse o perfil do paciente ou finalize uma consulta e utilize a opção de impressão.</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center text-xs font-bold text-slate-600">
              <ShieldCheck size={14} className="mr-2 text-emerald-500" /> Layout Otimizado para Documentos Clínicos
            </li>
            <li className="flex items-center text-xs font-bold text-slate-600">
              <ShieldCheck size={14} className="mr-2 text-emerald-500" /> Inclusão de Logo e Cabeçalho da Unidade
            </li>
            <li className="flex items-center text-xs font-bold text-slate-600">
              <ShieldCheck size={14} className="mr-2 text-emerald-500" /> Histórico Completo de Evoluções
            </li>
          </ul>
        </div>
      </div>

      <div className="p-8 bg-amber-50 rounded-[40px] border border-amber-100 flex items-center space-x-6">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
          <Clock size={32} />
        </div>
        <div>
          <h4 className="font-black text-amber-900 text-lg">Recomendação de Segurança</h4>
          <p className="text-sm text-amber-700 max-w-2xl leading-relaxed">
            É recomendável realizar um backup completo semanalmente e armazená-lo em local seguro externo. Os arquivos exportados contêm dados sensíveis e devem ser tratados sob as normas da LGPD.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
