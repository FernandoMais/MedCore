import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Filter,
  Landmark,
  Lock,
  Plus,
  RefreshCw,
  Settings2,
  Tags,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  BankAccount,
  BankReconciliation,
  BillingRecord,
  CostCenter,
  Doctor,
  FinanceSection,
  FinancialCategory,
  FinancialData,
  FinancialEntryType,
  FinancialStatus,
  FinancialTransaction,
  InsurancePlan,
  Patient,
  PaymentMethod,
  ProfessionalRepass,
  User,
} from '../types';

interface FinancialModuleProps {
  section: FinanceSection;
  clinicId: string;
  currentUser: User;
  patients: Patient[];
  doctors: Doctor[];
  appointments: { id: string; patientId: string; doctorId: string; date: string; time: string; type: string }[];
  data: FinancialData;
  onUpdate: (data: FinancialData) => void;
}

type ModalKind = 'transaction' | 'category' | 'costCenter' | 'paymentMethod' | 'bankAccount' | 'insurance' | 'repass' | 'cash' | 'billing' | null;

const sectionMeta: Record<FinanceSection, { label: string; title: string; description: string; icon: React.ReactNode }> = {
  dashboard: { label: 'Dashboard Financeiro', title: 'Dashboard Financeiro', description: 'Visão consolidada do caixa, recebimentos e compromissos da clínica.', icon: <BarChart3 size={17} /> },
  receivable: { label: 'Contas a Receber', title: 'Contas a Receber', description: 'Acompanhe valores previstos, vencidos e recebidos dos pacientes e convênios.', icon: <ArrowDownRight size={17} /> },
  payable: { label: 'Contas a Pagar', title: 'Contas a Pagar', description: 'Organize despesas, fornecedores, vencimentos e pagamentos da clínica.', icon: <ArrowUpRight size={17} /> },
  cashflow: { label: 'Fluxo de Caixa', title: 'Fluxo de Caixa', description: 'Compare entradas e saídas para antecipar decisões financeiras.', icon: <Activity size={17} /> },
  income: { label: 'Receitas', title: 'Receitas', description: 'Lançamentos de consultas, procedimentos, convênios e outras entradas.', icon: <TrendingUp size={17} /> },
  expenses: { label: 'Despesas', title: 'Despesas', description: 'Lançamentos de custos fixos, variáveis, fornecedores e operação.', icon: <TrendingDown size={17} /> },
  payments: { label: 'Pagamentos', title: 'Pagamentos', description: 'Histórico de pagamentos efetivados e baixa de títulos.', icon: <CircleDollarSign size={17} /> },
  repasses: { label: 'Repasses aos Profissionais', title: 'Repasses aos Profissionais', description: 'Controle de valores devidos e pagos ao corpo clínico.', icon: <Users size={17} /> },
  cash: { label: 'Caixa', title: 'Caixa', description: 'Abertura, movimentação e fechamento do caixa da recepção.', icon: <Wallet size={17} /> },
  'bank-accounts': { label: 'Contas Bancárias', title: 'Contas Bancárias', description: 'Saldos, contas de movimento e contas de recebimento.', icon: <Landmark size={17} /> },
  categories: { label: 'Categorias Financeiras', title: 'Categorias Financeiras', description: 'Classifique receitas e despesas para análises consistentes.', icon: <Tags size={17} /> },
  'cost-centers': { label: 'Centros de Custo', title: 'Centros de Custo', description: 'Entenda onde cada recurso é consumido dentro da clínica.', icon: <Building2 size={17} /> },
  'payment-methods': { label: 'Formas de Pagamento', title: 'Formas de Pagamento', description: 'Configure métodos, taxas e condições aceitas pela clínica.', icon: <CircleDollarSign size={17} /> },
  insurance: { label: 'Convênios e Planos', title: 'Convênios e Planos', description: 'Gerencie operadoras, prazos e lotes de faturamento.', icon: <ClipboardCheck size={17} /> },
  billing: { label: 'Faturamento', title: 'Faturamento', description: 'Prepare, acompanhe e controle o envio de lotes aos convênios.', icon: <FileSpreadsheet size={17} /> },
  reconciliation: { label: 'Conciliação Bancária', title: 'Conciliação Bancária', description: 'Compare o extrato bancário com os lançamentos do sistema.', icon: <RefreshCw size={17} /> },
  delinquency: { label: 'Inadimplência', title: 'Inadimplência', description: 'Priorize cobranças e visualize títulos vencidos.', icon: <AlertCircle size={17} /> },
  reports: { label: 'Relatórios', title: 'Relatórios Financeiros', description: 'Exporte dados e acompanhe indicadores para a gestão.', icon: <BarChart3 size={17} /> },
  settings: { label: 'Configurações Financeiras', title: 'Configurações Financeiras', description: 'Defina parâmetros, identidade da clínica e regras do módulo.', icon: <Settings2 size={17} /> },
};

const financeSections: FinanceSection[] = [
  'dashboard', 'receivable', 'payable', 'cashflow', 'income', 'expenses', 'payments',
  'repasses', 'cash', 'bank-accounts', 'categories', 'cost-centers', 'payment-methods',
  'insurance', 'billing', 'reconciliation', 'delinquency', 'reports', 'settings',
];

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (value?: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().split('T')[0];
const makeId = (prefix: string) => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

const statusStyles: Record<FinancialStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-100',
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  vencido: 'bg-rose-50 text-rose-700 border-rose-100',
  cancelado: 'bg-slate-100 text-slate-500 border-slate-200',
};

const StatusBadge = ({ status }: { status: FinancialStatus }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${statusStyles[status]}`}>
    {status}
  </span>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-16 text-center text-slate-400">
    <FileSpreadsheet className="mx-auto mb-3 text-slate-300" size={30} />
    <p className="text-sm font-bold">{text}</p>
  </div>
);

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const MetricCard = ({ label, value, helper, tone, icon }: { label: string; value: string; helper: string; tone: string; icon: React.ReactNode }) => (
  <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-800 mt-2">{value}</p>
        <p className={`text-xs font-bold mt-1 ${tone}`}>{helper}</p>
      </div>
      <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600">{icon}</div>
    </div>
  </div>
);

const FormField = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</span>
    {children}
  </label>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

const FinancialModule: React.FC<FinancialModuleProps> = ({ section, clinicId, currentUser, patients, doctors, appointments, data, onUpdate }) => {
  const [modal, setModal] = useState<ModalKind>(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('todos');
  const [form, setForm] = useState<Record<string, string>>({});

  const scoped = useMemo(() => ({
    ...data,
    transactions: (data.transactions || []).filter(item => item.clinicId === clinicId),
    categories: (data.categories || []).filter(item => item.clinicId === clinicId),
    costCenters: (data.costCenters || []).filter(item => item.clinicId === clinicId),
    paymentMethods: (data.paymentMethods || []).filter(item => item.clinicId === clinicId),
    bankAccounts: (data.bankAccounts || []).filter(item => item.clinicId === clinicId),
    insurancePlans: (data.insurancePlans || []).filter(item => item.clinicId === clinicId),
    repasses: (data.repasses || []).filter(item => item.clinicId === clinicId),
    cashClosures: (data.cashClosures || []).filter(item => item.clinicId === clinicId),
    reconciliations: (data.reconciliations || []).filter(item => item.clinicId === clinicId),
    billingRecords: (data.billingRecords || []).filter(item => item.clinicId === clinicId),
    settings: (data.settings || []).filter(item => item.clinicId === clinicId),
  }), [data, clinicId]);

  const visibleTransactions = useMemo(() => {
    const ownDoctor = currentUser.role === 'doctor' ? currentUser.doctorId : undefined;
    return scoped.transactions.filter(item => !ownDoctor || item.doctorId === ownDoctor);
  }, [currentUser, scoped.transactions]);

  const update = <K extends keyof FinancialData>(key: K, rows: FinancialData[K]) => onUpdate({ ...data, [key]: rows });
  const openModal = (kind: ModalKind, defaults: Record<string, string> = {}) => {
    setForm(defaults);
    setModal(kind);
  };
  const field = (key: string, fallback = '') => form[key] ?? fallback;
  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const createTransaction = () => {
    const amount = Number(field('amount').replace(',', '.'));
    if (!field('description').trim() || !amount || amount <= 0) {
      alert('Informe uma descrição e um valor válido.');
      return;
    }
    const type = (field('type', section === 'expenses' || section === 'payable' ? 'despesa' : 'receita')) as FinancialEntryType;
    const transaction: FinancialTransaction = {
      id: makeId('ft'),
      clinicId,
      type,
      status: (field('status', 'pendente') as FinancialStatus),
      description: field('description').trim(),
      amount,
      dueDate: field('dueDate', today()),
      paidDate: field('status') === 'pago' ? today() : undefined,
      patientId: field('patientId') || undefined,
      doctorId: field('doctorId') || undefined,
      appointmentId: field('appointmentId') || undefined,
      categoryId: field('categoryId') || undefined,
      costCenterId: field('costCenterId') || undefined,
      paymentMethodId: field('paymentMethodId') || undefined,
      accountId: field('accountId') || undefined,
      insurancePlanId: field('insurancePlanId') || undefined,
      documentNumber: field('documentNumber') || undefined,
      notes: field('notes') || undefined,
      createdAt: today(),
    };
    update('transactions', [transaction, ...data.transactions]);
    setModal(null);
  };

  const markAsPaid = (id: string) => {
    update('transactions', data.transactions.map(item => item.id === id ? { ...item, status: 'pago', paidDate: today() } : item));
  };

  const createSimpleEntity = () => {
    if (!field('name').trim()) return;
    if (modal === 'category') {
      const entity: FinancialCategory = { id: makeId('fc'), clinicId, name: field('name').trim(), type: (field('type', 'ambos') as FinancialCategory['type']), color: field('color', '#2563eb'), active: true };
      update('categories', [entity, ...data.categories]);
    }
    if (modal === 'costCenter') {
      const entity: CostCenter = { id: makeId('cc'), clinicId, name: field('name').trim(), description: field('description'), active: true };
      update('costCenters', [entity, ...data.costCenters]);
    }
    if (modal === 'paymentMethod') {
      const entity: PaymentMethod = { id: makeId('pm'), clinicId, name: field('name').trim(), kind: (field('kind', 'ambos') as PaymentMethod['kind']), feePercent: Number(field('feePercent', '0').replace(',', '.')) || 0, active: true };
      update('paymentMethods', [entity, ...data.paymentMethods]);
    }
    if (modal === 'bankAccount') {
      const entity: BankAccount = { id: makeId('ba'), clinicId, name: field('name').trim(), bank: field('bank'), agency: field('agency'), accountNumber: field('accountNumber'), kind: (field('kind', 'banco') as BankAccount['kind']), openingBalance: Number(field('openingBalance', '0').replace(',', '.')) || 0, active: true };
      update('bankAccounts', [entity, ...data.bankAccounts]);
    }
    if (modal === 'insurance') {
      const entity: InsurancePlan = { id: makeId('ip'), clinicId, name: field('name').trim(), operator: field('operator'), code: field('code'), paymentTermDays: Number(field('paymentTermDays', '30')) || 0, active: true };
      update('insurancePlans', [entity, ...data.insurancePlans]);
    }
    setModal(null);
  };

  const createRepass = () => {
    const gross = Number(field('grossAmount').replace(',', '.'));
    const percentage = Number(field('percentage').replace(',', '.')) || 0;
    if (!field('doctorId') || !gross) return;
    const entity: ProfessionalRepass = {
      id: makeId('rp'), clinicId, doctorId: field('doctorId'),
      patientId: field('patientId') || undefined,
      appointmentId: field('appointmentId') || undefined,
      referenceMonth: field('referenceMonth', today().slice(0, 7)),
      grossAmount: gross, percentage, amount: Number((gross * percentage / 100).toFixed(2)),
      status: 'previsto', dueDate: field('dueDate', today()), notes: field('notes'),
    };
    update('repasses', [entity, ...data.repasses]);
    setModal(null);
  };

  const createCashClosure = () => {
    const counted = Number(field('countedBalance').replace(',', '.'));
    const expected = Number(field('expectedBalance').replace(',', '.'));
    if (!field('accountId') || Number.isNaN(counted)) return;
    const entity: import('../types').CashClosure = {
      id: makeId('cash'), clinicId, accountId: field('accountId'), date: field('date', today()),
      openingBalance: Number(field('openingBalance', '0').replace(',', '.')) || 0, expectedBalance: expected || 0,
      countedBalance: counted, difference: Number((counted - expected).toFixed(2)), responsibleName: field('responsibleName', currentUser.name),
      status: 'fechado', notes: field('notes'),
    };
    update('cashClosures', [entity, ...data.cashClosures]);
    setModal(null);
  };

  const createBilling = () => {
    const total = Number(field('totalAmount').replace(',', '.'));
    if (!total) return;
    const entity: BillingRecord = {
      id: makeId('bill'), clinicId, referenceMonth: field('referenceMonth', today().slice(0, 7)),
      patientId: field('patientId') || undefined, insurancePlanId: field('insurancePlanId') || undefined,
      totalAmount: total, dueDate: field('dueDate', today()), status: 'rascunho', notes: field('notes'),
    };
    update('billingRecords', [entity, ...data.billingRecords]);
    setModal(null);
  };

  const exportCsv = () => {
    const headers = ['tipo', 'status', 'descricao', 'valor', 'vencimento', 'pagamento', 'paciente', 'categoria'];
    const rows = visibleTransactions.map(item => [
      item.type, item.status, item.description, item.amount.toFixed(2), item.dueDate, item.paidDate || '',
      patients.find(patient => patient.id === item.patientId)?.name || '', scoped.categories.find(category => category.id === item.categoryId)?.name || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `relatorio-financeiro-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const metricTotals = useMemo(() => {
    const paidIncome = visibleTransactions.filter(item => item.type === 'receita' && item.status === 'pago').reduce((sum, item) => sum + item.amount, 0);
    const paidExpenses = visibleTransactions.filter(item => item.type === 'despesa' && item.status === 'pago').reduce((sum, item) => sum + item.amount, 0);
    const receivable = visibleTransactions.filter(item => item.type === 'receita' && ['pendente', 'vencido'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    const payable = visibleTransactions.filter(item => item.type === 'despesa' && ['pendente', 'vencido'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    const overdue = visibleTransactions.filter(item => item.status === 'vencido').reduce((sum, item) => sum + item.amount, 0);
    return { paidIncome, paidExpenses, receivable, payable, overdue, balance: paidIncome - paidExpenses };
  }, [visibleTransactions]);

  const sectionTransactions = (type: FinancialEntryType) => visibleTransactions.filter(item => item.type === type).filter(item => {
    const matchesSearch = !search || item.description.toLowerCase().includes(search.toLowerCase());
    const matchesPeriod = period === 'todos' || item.status === period;
    return matchesSearch && matchesPeriod;
  });

  const renderTransactionTable = (type: FinancialEntryType, title: string) => {
    const rows = sectionTransactions(type);
    return (
      <div className="space-y-4">
        <Toolbar search={search} setSearch={setSearch} period={period} setPeriod={setPeriod} onAdd={() => openModal('transaction', { type })} addLabel={`Nova ${type === 'receita' ? 'receita' : 'despesa'}`} />
        <TableShell>
          <table className="w-full text-left min-w-[780px]">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              {['Lançamento', 'Vínculo', 'Vencimento', 'Valor', 'Status', 'Ações'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-bold text-slate-800 text-sm">{item.description}</p><p className="text-[10px] text-slate-400 mt-1 uppercase">{item.documentNumber || `Criado em ${shortDate(item.createdAt)}`}</p></td>
                  <td className="px-5 py-4"><p className="text-xs font-bold text-slate-600">{patients.find(patient => patient.id === item.patientId)?.name || scoped.insurancePlans.find(plan => plan.id === item.insurancePlanId)?.name || 'Operacional'}</p><p className="text-[10px] text-slate-400">{doctors.find(doctor => doctor.id === item.doctorId)?.name || ''}</p>{item.appointmentId && <p className="text-[10px] text-blue-500 font-bold mt-1">Agendamento: {item.appointmentId}</p>}</td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.dueDate)}</td>
                  <td className={`px-5 py-4 text-sm font-black ${type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{type === 'receita' ? '+' : '-'} {money(item.amount)}</td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-4">{item.status !== 'pago' && item.status !== 'cancelado' ? <button onClick={() => markAsPaid(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"><Check size={14} /> Dar baixa</button> : <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{item.paidDate ? `Pago em ${shortDate(item.paidDate)}` : 'Sem ações'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState text={`Nenhuma ${type === 'receita' ? 'receita' : 'despesa'} encontrada.`} />}
        </TableShell>
        <p className="text-xs font-bold text-slate-400">{title}: {rows.length} lançamento(s) no escopo desta clínica.</p>
      </div>
    );
  };

  const renderDashboard = () => {
    const chart = [
      { label: 'Receitas pagas', value: metricTotals.paidIncome, color: 'bg-emerald-500' },
      { label: 'Despesas pagas', value: metricTotals.paidExpenses, color: 'bg-rose-500' },
      { label: 'A receber', value: metricTotals.receivable, color: 'bg-blue-500' },
      { label: 'A pagar', value: metricTotals.payable, color: 'bg-amber-500' },
    ];
    const max = Math.max(...chart.map(item => item.value), 1);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Saldo realizado" value={money(metricTotals.balance)} helper="Receitas menos despesas pagas" tone="text-emerald-600" icon={<Wallet size={21} />} />
          <MetricCard label="Contas a receber" value={money(metricTotals.receivable)} helper={`${visibleTransactions.filter(item => item.type === 'receita' && item.status !== 'pago').length} títulos em aberto`} tone="text-blue-600" icon={<ArrowDownRight size={21} />} />
          <MetricCard label="Contas a pagar" value={money(metricTotals.payable)} helper={`${visibleTransactions.filter(item => item.type === 'despesa' && item.status !== 'pago').length} compromissos`} tone="text-amber-600" icon={<ArrowUpRight size={21} />} />
          <MetricCard label="Inadimplência" value={money(metricTotals.overdue)} helper="Títulos vencidos" tone="text-rose-600" icon={<AlertCircle size={21} />} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-[24px] border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-8"><div><h3 className="text-lg font-black text-slate-800">Resumo financeiro</h3><p className="text-xs text-slate-400 font-bold mt-1">Visão dos lançamentos no escopo da clínica</p></div><span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider">BRL • Atualizado agora</span></div>
            <div className="space-y-5">{chart.map(item => <div key={item.label}><div className="flex justify-between text-xs font-black text-slate-600 mb-2"><span>{item.label}</span><span>{money(item.value)}</span></div><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.max(item.value / max * 100, item.value ? 4 : 0)}%` }} /></div></div>)}</div>
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100"><div><p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Taxa de recebimento</p><p className="text-xl font-black text-slate-800 mt-1">{metricTotals.paidIncome + metricTotals.receivable ? Math.round(metricTotals.paidIncome / (metricTotals.paidIncome + metricTotals.receivable) * 100) : 0}%</p></div><div><p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Lançamentos ativos</p><p className="text-xl font-black text-slate-800 mt-1">{visibleTransactions.filter(item => item.status !== 'cancelado').length}</p></div></div>
          </div>
          <div className="bg-slate-900 rounded-[24px] text-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Governança</p><h3 className="text-lg font-black mt-1">Dados protegidos</h3></div><Lock size={21} className="text-blue-300" /></div>
            <p className="text-sm text-slate-300 leading-relaxed">Este painel exibe somente lançamentos associados à clínica <strong className="text-white">{clinicId}</strong>. O escopo é aplicado antes das métricas e da exportação.</p>
            <div className="mt-6 space-y-3 text-xs font-bold text-slate-300"><p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Receitas e despesas separadas</p><p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Pacientes e profissionais vinculados</p><p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Exportação por tenant</p></div>
            <button onClick={exportCsv} className="w-full mt-8 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-3 text-xs font-black uppercase tracking-wider"><Download size={15} /> Exportar lançamentos</button>
          </div>
        </div>
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6"><div className="flex items-center justify-between mb-4"><div><h3 className="font-black text-slate-800">Próximos vencimentos</h3><p className="text-xs text-slate-400 font-bold mt-1">Ações prioritárias do financeiro</p></div><button onClick={() => openModal('transaction')} className="flex items-center gap-1 text-xs font-black text-blue-600"><Plus size={15} /> Lançar</button></div>{visibleTransactions.filter(item => item.status === 'pendente' || item.status === 'vencido').slice(0, 4).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3 border-t border-slate-100"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${item.status === 'vencido' ? 'bg-rose-500' : 'bg-amber-400'}`} /><div><p className="text-sm font-bold text-slate-700">{item.description}</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Vence em {shortDate(item.dueDate)}</p></div></div><p className={`text-sm font-black ${item.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{money(item.amount)}</p></div>)}</div>
      </div>
    );
  };

  const renderCashflow = () => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().split('T')[0];
      const income = visibleTransactions.filter(item => item.type === 'receita' && item.paidDate === key).reduce((sum, item) => sum + item.amount, 0);
      const expense = visibleTransactions.filter(item => item.type === 'despesa' && item.paidDate === key).reduce((sum, item) => sum + item.amount, 0);
      return { key, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), income, expense };
    });
    return <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><MetricCard label="Entradas no período" value={money(days.reduce((sum, item) => sum + item.income, 0))} helper="Últimos 7 dias" tone="text-emerald-600" icon={<ArrowDownRight size={21} />} /><MetricCard label="Saídas no período" value={money(days.reduce((sum, item) => sum + item.expense, 0))} helper="Últimos 7 dias" tone="text-rose-600" icon={<ArrowUpRight size={21} />} /><MetricCard label="Saldo projetado" value={money(metricTotals.balance + metricTotals.receivable - metricTotals.payable)} helper="Realizado + em aberto" tone="text-blue-600" icon={<Activity size={21} />} /></div><div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6"><h3 className="font-black text-slate-800">Movimentação diária</h3><p className="text-xs font-bold text-slate-400 mt-1">Valores pagos nos últimos sete dias</p><div className="grid grid-cols-7 gap-2 md:gap-5 mt-10 items-end h-56">{days.map(day => { const max = Math.max(...days.map(item => Math.max(item.income, item.expense)), 1); return <div key={day.key} className="h-full flex flex-col justify-end items-center gap-2"><div className="w-full flex justify-center items-end gap-1 h-44"><div className="w-3 md:w-5 rounded-t-md bg-emerald-400" style={{ height: `${Math.max(day.income / max * 100, day.income ? 5 : 0)}%` }} /><div className="w-3 md:w-5 rounded-t-md bg-rose-400" style={{ height: `${Math.max(day.expense / max * 100, day.expense ? 5 : 0)}%` }} /></div><span className="text-[10px] font-black uppercase text-slate-400">{day.label}</span></div> })}</div><div className="flex justify-center gap-5 mt-6 text-[10px] font-black uppercase tracking-wider text-slate-400"><span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Entradas</span><span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Saídas</span></div></div></div>;
  };

  const renderPayments = () => {
    const paid = visibleTransactions.filter(item => item.status === 'pago');
    return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><MetricCard label="Recebido" value={money(paid.filter(item => item.type === 'receita').reduce((sum, item) => sum + item.amount, 0))} helper="Pagamentos de pacientes e convênios" tone="text-emerald-600" icon={<CheckCircle2 size={21} />} /><MetricCard label="Pago a fornecedores" value={money(paid.filter(item => item.type === 'despesa').reduce((sum, item) => sum + item.amount, 0))} helper="Despesas efetivadas" tone="text-rose-600" icon={<CircleDollarSign size={21} />} /><MetricCard label="Total de baixas" value={String(paid.length)} helper="Títulos liquidados" tone="text-blue-600" icon={<ClipboardCheck size={21} />} /></div><TableShell><table className="w-full text-left min-w-[700px]"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Data', 'Descrição', 'Forma', 'Conta', 'Valor'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{paid.map(item => <tr key={item.id}><td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.paidDate)}</td><td className="px-5 py-4 text-sm font-bold text-slate-700">{item.description}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{scoped.paymentMethods.find(method => method.id === item.paymentMethodId)?.name || 'Não informado'}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{scoped.bankAccounts.find(account => account.id === item.accountId)?.name || 'Não informado'}</td><td className={`px-5 py-4 text-sm font-black ${item.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{money(item.amount)}</td></tr>)}</tbody></table>{!paid.length && <EmptyState text="Nenhum pagamento registrado." />}</TableShell></div>;
  };

  const renderRepasses = () => <div className="space-y-4"><Toolbar search={search} setSearch={setSearch} period={period} setPeriod={setPeriod} onAdd={() => openModal('repass', { referenceMonth: today().slice(0, 7), percentage: '60', dueDate: today() })} addLabel="Novo repasse" /><TableShell><table className="w-full text-left min-w-[900px]"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Profissional', 'Paciente / agendamento', 'Competência', 'Bruto', '%', 'Repasse', 'Vencimento', 'Status'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scoped.repasses.filter(item => !search || doctors.find(doctor => doctor.id === item.doctorId)?.name.toLowerCase().includes(search.toLowerCase())).map(item => <tr key={item.id}><td className="px-5 py-4 text-sm font-bold text-slate-700">{doctors.find(doctor => doctor.id === item.doctorId)?.name || 'Profissional removido'}</td><td className="px-5 py-4"><p className="text-xs font-bold text-slate-600">{patients.find(patient => patient.id === item.patientId)?.name || 'Não vinculado'}</p>{item.appointmentId && <p className="text-[10px] text-blue-500 font-bold mt-1">Agendamento: {item.appointmentId}</p>}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{item.referenceMonth}</td><td className="px-5 py-4 text-sm font-bold text-slate-600">{money(item.grossAmount)}</td><td className="px-5 py-4 text-xs font-black text-blue-600">{item.percentage !== undefined ? `${item.percentage}%` : 'Fixo'}</td><td className="px-5 py-4 text-sm font-black text-rose-600">{money(item.amount)}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.dueDate)}</td><td className="px-5 py-4"><span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black uppercase text-amber-700">{item.status}</span></td></tr>)}</tbody></table>{!scoped.repasses.length && <EmptyState text="Nenhum repasse cadastrado." />}</TableShell></div>;

  const renderCash = () => <div className="space-y-4"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-1"><p className="text-[10px] uppercase tracking-widest font-black text-blue-600">Caixa em aberto</p><p className="text-xl font-black text-slate-800 mt-1">{money(scoped.cashClosures.filter(item => item.status === 'aberto').reduce((sum, item) => sum + item.expectedBalance, 0))}</p></div><button onClick={() => openModal('cash', { date: today(), responsibleName: currentUser.name, accountId: scoped.bankAccounts.find(account => account.kind === 'caixa')?.id || '', openingBalance: '0', expectedBalance: '0' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Plus size={16} /> Fechar caixa</button></div><TableShell><table className="w-full text-left min-w-[760px]"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Data', 'Caixa', 'Responsável', 'Esperado', 'Conferido', 'Diferença', 'Status'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scoped.cashClosures.map(item => <tr key={item.id}><td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.date)}</td><td className="px-5 py-4 text-sm font-bold text-slate-700">{scoped.bankAccounts.find(account => account.id === item.accountId)?.name || '—'}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{item.responsibleName}</td><td className="px-5 py-4 text-sm font-black text-slate-700">{money(item.expectedBalance)}</td><td className="px-5 py-4 text-sm font-black text-slate-700">{money(item.countedBalance)}</td><td className={`px-5 py-4 text-sm font-black ${item.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(item.difference)}</td><td className="px-5 py-4"><span className="text-[10px] uppercase font-black text-emerald-700">{item.status}</span></td></tr>)}</tbody></table>{!scoped.cashClosures.length && <EmptyState text="Nenhum fechamento de caixa." />}</TableShell></div>;

  const renderCards = () => {
    if (section === 'bank-accounts') return <EntityCards title="Contas e caixas" description="Saldos de abertura e contas usadas nos lançamentos." addLabel="Nova conta" onAdd={() => openModal('bankAccount')} items={scoped.bankAccounts.map(item => ({ id: item.id, title: item.name, subtitle: item.bank ? `${item.bank} • Ag. ${item.agency || '—'} • ${item.accountNumber || '—'}` : 'Caixa físico', value: money(item.openingBalance), badge: item.kind }))} />;
    if (section === 'categories') return <EntityCards title="Categorias" description="Classificação gerencial das movimentações." addLabel="Nova categoria" onAdd={() => openModal('category')} items={scoped.categories.map(item => ({ id: item.id, title: item.name, subtitle: item.type === 'ambos' ? 'Entradas e saídas' : item.type === 'receita' ? 'Receitas' : 'Despesas', value: item.active ? 'Ativa' : 'Inativa', badge: 'Categoria', color: item.color }))} />;
    if (section === 'cost-centers') return <EntityCards title="Centros de custo" description="Áreas responsáveis pelos gastos e resultados." addLabel="Novo centro" onAdd={() => openModal('costCenter')} items={scoped.costCenters.map(item => ({ id: item.id, title: item.name, subtitle: item.description || 'Sem descrição', value: item.active ? 'Ativo' : 'Inativo', badge: 'Centro' }))} />;
    if (section === 'payment-methods') return <EntityCards title="Formas de pagamento" description="Métodos aceitos e taxas operacionais." addLabel="Nova forma" onAdd={() => openModal('paymentMethod')} items={scoped.paymentMethods.map(item => ({ id: item.id, title: item.name, subtitle: item.kind === 'ambos' ? 'Entrada e saída' : item.kind === 'entrada' ? 'Somente entrada' : 'Somente saída', value: `${item.feePercent || 0}% taxa`, badge: 'Ativa' }))} />;
    if (section === 'insurance') return <EntityCards title="Convênios e planos" description="Operadoras integradas ao ciclo de faturamento." addLabel="Novo convênio" onAdd={() => openModal('insurance')} items={scoped.insurancePlans.map(item => ({ id: item.id, title: item.name, subtitle: `${item.operator}${item.code ? ` • ${item.code}` : ''}`, value: `${item.paymentTermDays} dias`, badge: 'Prazo de pagamento' }))} />;
    return null;
  };

  const renderBilling = () => <div className="space-y-4"><Toolbar search={search} setSearch={setSearch} period={period} setPeriod={setPeriod} onAdd={() => openModal('billing', { referenceMonth: today().slice(0, 7), dueDate: today() })} addLabel="Novo lote" /><TableShell><table className="w-full text-left min-w-[780px]"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Competência', 'Convênio', 'Paciente', 'Valor', 'Vencimento', 'Status'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scoped.billingRecords.map(item => <tr key={item.id}><td className="px-5 py-4 text-sm font-bold text-slate-700">{item.referenceMonth}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{scoped.insurancePlans.find(plan => plan.id === item.insurancePlanId)?.name || 'Particular'}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{patients.find(patient => patient.id === item.patientId)?.name || 'Lote consolidado'}</td><td className="px-5 py-4 text-sm font-black text-emerald-600">{money(item.totalAmount)}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.dueDate)}</td><td className="px-5 py-4"><span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase text-blue-700">{item.status}</span></td></tr>)}</tbody></table>{!scoped.billingRecords.length && <EmptyState text="Nenhum lote de faturamento." />}</TableShell></div>;

  const renderReconciliation = () => <TableShell><table className="w-full text-left min-w-[760px]"><thead><tr className="bg-slate-50 border-b border-slate-100">{['Data', 'Descrição do extrato', 'Conta', 'Valor', 'Status', 'Ação'].map(head => <th key={head} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scoped.reconciliations.map(item => <tr key={item.id}><td className="px-5 py-4 text-xs font-bold text-slate-500">{shortDate(item.date)}</td><td className="px-5 py-4 text-sm font-bold text-slate-700">{item.description}</td><td className="px-5 py-4 text-xs font-bold text-slate-500">{scoped.bankAccounts.find(account => account.id === item.accountId)?.name || '—'}</td><td className={`px-5 py-4 text-sm font-black ${item.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{money(item.amount)}</td><td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'conciliado' ? 'bg-emerald-50 text-emerald-700' : item.status === 'divergente' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span></td><td className="px-5 py-4">{item.status !== 'conciliado' && <button onClick={() => update('reconciliations', data.reconciliations.map(row => row.id === item.id ? { ...row, status: 'conciliado' } : row))} className="text-xs font-black text-blue-600 hover:text-blue-800">Conciliar</button>}</td></tr>)}</tbody></table>{!scoped.reconciliations.length && <EmptyState text="Nenhum item de extrato importado." />}</TableShell>;

  const renderDelinquency = () => <div className="space-y-4"><div className="bg-rose-50 border border-rose-100 rounded-[20px] p-5 flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Atenção da cobrança</p><p className="text-sm font-bold text-slate-700 mt-1">Existem {visibleTransactions.filter(item => item.status === 'vencido').length} título(s) vencido(s), totalizando {money(metricTotals.overdue)}.</p></div><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-white border border-rose-200 px-3 py-2 text-xs font-black text-rose-700"><Download size={15} /> Exportar lista</button></div>{renderTransactionTable('receita', 'Inadimplência')}</div>;

  const renderReports = () => <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[['DRE gerencial', 'Receitas, despesas e resultado por competência', TrendingUp], ['Fluxo de caixa', 'Entradas, saídas e saldo projetado', Activity], ['Contas em aberto', 'Receber, pagar e títulos vencidos', ClipboardCheck], ['Repasses', 'Produção e valores devidos por profissional', Users], ['Faturamento', 'Lotes e recebimentos de convênios', FileSpreadsheet], ['Conciliação', 'Itens conciliados e divergências', RefreshCw]].map(([title, desc, Icon]) => <button key={String(title)} onClick={exportCsv} className="text-left bg-white rounded-[22px] border border-slate-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"><div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Icon size={20} /></div><h3 className="font-black text-slate-800 mt-4">{title}</h3><p className="text-xs font-medium text-slate-400 mt-1 leading-relaxed">{desc}</p><span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-black text-blue-600 mt-4">Exportar CSV <ChevronRight size={13} /></span></button>)}</div><div className="bg-slate-900 rounded-[24px] p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-5"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Exportação segura</p><h3 className="text-lg font-black mt-1">Baixe os dados da clínica</h3><p className="text-xs text-slate-400 mt-1">O arquivo contém somente os lançamentos do tenant atual.</p></div><button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-xs font-black uppercase tracking-wider"><Download size={16} /> Gerar relatório</button></div></div>;

  const renderSettings = () => {
    const settings = scoped.settings[0] || { clinicId, clinicName: 'Clínica', currency: 'BRL', allowNegativeCash: false, sendPaymentNotifications: true };
    const patchSettings = (patch: Partial<typeof settings>) => update('settings', data.settings.some(item => item.clinicId === clinicId) ? data.settings.map(item => item.clinicId === clinicId ? { ...item, ...patch } : item) : [...data.settings, { ...settings, ...patch }]);
    return <div className="max-w-3xl space-y-6"><div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6"><div className="flex items-center gap-3 mb-6"><div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Settings2 size={21} /></div><div><h3 className="font-black text-slate-800">Parâmetros da clínica</h3><p className="text-xs font-bold text-slate-400 mt-1">Aplicados aos lançamentos deste tenant.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Nome da clínica"><input className={inputClass} value={settings.clinicName} onChange={event => patchSettings({ clinicName: event.target.value })} /></FormField><FormField label="CNPJ"><input className={inputClass} value={settings.document || ''} onChange={event => patchSettings({ document: event.target.value })} /></FormField><FormField label="Moeda"><select className={inputClass} value={settings.currency} onChange={event => patchSettings({ currency: event.target.value })}><option value="BRL">Real brasileiro (BRL)</option><option value="USD">Dólar (USD)</option></select></FormField><FormField label="Conta padrão"><select className={inputClass} value={settings.defaultAccountId || ''} onChange={event => patchSettings({ defaultAccountId: event.target.value })}><option value="">Selecionar conta</option>{scoped.bankAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FormField></div></div><div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 space-y-4"><h3 className="font-black text-slate-800">Regras operacionais</h3><label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50"><span><b className="block text-sm text-slate-700">Permitir saldo negativo no caixa</b><small className="text-xs text-slate-400">Recomendado manter desativado.</small></span><input type="checkbox" checked={settings.allowNegativeCash} onChange={event => patchSettings({ allowNegativeCash: event.target.checked })} className="w-5 h-5 accent-blue-600" /></label><label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50"><span><b className="block text-sm text-slate-700">Notificações de pagamento</b><small className="text-xs text-slate-400">Mantém o recurso pronto para integração de e-mail.</small></span><input type="checkbox" checked={settings.sendPaymentNotifications} onChange={event => patchSettings({ sendPaymentNotifications: event.target.checked })} className="w-5 h-5 accent-blue-600" /></label></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-[10px] uppercase tracking-widest font-black text-blue-600">Tenant financeiro</p><p className="text-sm font-bold text-slate-700 mt-2">Identificador: <span className="font-mono">{clinicId}</span></p><p className="text-xs text-slate-500 mt-1">Todos os cadastros desta área carregam este identificador e são filtrados antes de serem exibidos.</p></div></div>;
  };

  const renderSection = () => {
    if (section === 'dashboard') return renderDashboard();
    if (section === 'cashflow') return renderCashflow();
    if (section === 'income') return renderTransactionTable('receita', 'Receitas');
    if (section === 'expenses') return renderTransactionTable('despesa', 'Despesas');
    if (section === 'receivable') return renderTransactionTable('receita', 'Contas a receber');
    if (section === 'payable') return renderTransactionTable('despesa', 'Contas a pagar');
    if (section === 'payments') return renderPayments();
    if (section === 'repasses') return renderRepasses();
    if (section === 'cash') return renderCash();
    if (['bank-accounts', 'categories', 'cost-centers', 'payment-methods', 'insurance'].includes(section)) return renderCards();
    if (section === 'billing') return renderBilling();
    if (section === 'reconciliation') return renderReconciliation();
    if (section === 'delinquency') return renderDelinquency();
    if (section === 'reports') return renderReports();
    if (section === 'settings') return renderSettings();
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2"><Wallet size={14} /> Financeiro <span className="text-slate-300">/</span> {sectionMeta[section].label}</div><h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800">{sectionMeta[section].title}</h1><p className="text-sm text-slate-500 font-medium mt-1">{sectionMeta[section].description}</p></div>
        <div className="flex items-center gap-2"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500"><Building2 size={14} className="text-blue-600" /> {scoped.settings[0]?.clinicName || 'Clínica'} </span>{section !== 'settings' && <button onClick={() => openModal('transaction', { type: section === 'expenses' || section === 'payable' ? 'despesa' : 'receita' })} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Plus size={16} /> Lançamento</button>}</div>
      </div>
      {renderSection()}
      {modal && <FinanceModal modal={modal} form={form} setField={setField} close={() => setModal(null)} save={modal === 'transaction' ? createTransaction : modal === 'repass' ? createRepass : modal === 'cash' ? createCashClosure : modal === 'billing' ? createBilling : createSimpleEntity} patients={patients} doctors={doctors} appointments={appointments} categories={scoped.categories} costCenters={scoped.costCenters} paymentMethods={scoped.paymentMethods} accounts={scoped.bankAccounts} insurancePlans={scoped.insurancePlans} />}
    </div>
  );
};

const Toolbar = ({ search, setSearch, period, setPeriod, onAdd, addLabel }: { search: string; setSearch: (value: string) => void; period: string; setPeriod: (value: string) => void; onAdd: () => void; addLabel: string }) => (
  <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between"><div className="flex flex-1 gap-2"><div className="relative flex-1 max-w-md"><Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-9`} placeholder="Buscar lançamento..." value={search} onChange={event => setSearch(event.target.value)} /></div><select className={`${inputClass} w-auto`} value={period} onChange={event => setPeriod(event.target.value)}><option value="todos">Todos os status</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option><option value="vencido">Vencidos</option></select></div><button onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700"><Plus size={16} /> {addLabel}</button></div>
);

const EntityCards = ({ title, description, addLabel, onAdd, items }: { title: string; description: string; addLabel: string; onAdd: () => void; items: { id: string; title: string; subtitle: string; value: string; badge: string; color?: string }[] }) => (
  <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-800">{title}</h3><p className="text-xs font-bold text-slate-400 mt-1">{description}</p></div><button onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700"><Plus size={16} /> {addLabel}</button></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(item => <div key={item.id} className="bg-white rounded-[22px] border border-slate-200 shadow-sm p-5"><div className="flex items-start justify-between"><div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center" style={item.color ? { color: item.color } : undefined}><Tags size={18} /></div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.badge}</span></div><h4 className="font-black text-slate-800 mt-4">{item.title}</h4><p className="text-xs font-medium text-slate-400 mt-1 min-h-8">{item.subtitle}</p><div className="border-t border-slate-100 mt-4 pt-3 text-sm font-black text-blue-600">{item.value}</div></div>)}</div>{!items.length && <div className="bg-white rounded-[22px] border border-slate-200"><EmptyState text="Nenhum cadastro encontrado." /></div>}</div>
);

const FinanceModal = ({ modal, form, setField, close, save, patients, doctors, appointments, categories, costCenters, paymentMethods, accounts, insurancePlans }: { modal: Exclude<ModalKind, null>; form: Record<string, string>; setField: (key: string, value: string) => void; close: () => void; save: () => void; patients: Patient[]; doctors: Doctor[]; appointments: FinancialModuleProps['appointments']; categories: FinancialCategory[]; costCenters: CostCenter[]; paymentMethods: PaymentMethod[]; accounts: BankAccount[]; insurancePlans: InsurancePlan[] }) => {
  const isTransaction = modal === 'transaction';
  const title = modal === 'transaction' ? 'Novo lançamento' : modal === 'repass' ? 'Novo repasse profissional' : modal === 'cash' ? 'Fechamento de caixa' : modal === 'billing' ? 'Novo lote de faturamento' : modal === 'category' ? 'Nova categoria' : modal === 'costCenter' ? 'Novo centro de custo' : modal === 'paymentMethod' ? 'Nova forma de pagamento' : modal === 'bankAccount' ? 'Nova conta bancária' : 'Novo convênio ou plano';
  const field = (key: string, fallback = '') => form[key] ?? fallback;
  return <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={close}><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl" onMouseDown={event => event.stopPropagation()}><div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10"><div><p className="text-[10px] uppercase tracking-widest font-black text-blue-600">Financeiro</p><h2 className="text-xl font-black text-slate-800 mt-1">{title}</h2></div><button onClick={close} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={20} /></button></div><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    {isTransaction && <><FormField label="Tipo"><select className={inputClass} value={field('type', 'receita')} onChange={event => setField('type', event.target.value)}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></FormField><FormField label="Status"><select className={inputClass} value={field('status', 'pendente')} onChange={event => setField('status', event.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="vencido">Vencido</option></select></FormField><FormField label="Descrição" className="md:col-span-2"><input autoFocus className={inputClass} value={field('description')} onChange={event => setField('description', event.target.value)} placeholder="Ex.: Consulta, fornecedor ou despesa fixa" /></FormField><FormField label="Valor (R$)"><input className={inputClass} type="number" min="0" step="0.01" value={field('amount')} onChange={event => setField('amount', event.target.value)} /></FormField><FormField label="Vencimento"><input className={inputClass} type="date" value={field('dueDate', today())} onChange={event => setField('dueDate', event.target.value)} /></FormField><FormField label="Paciente"><select className={inputClass} value={field('patientId')} onChange={event => setField('patientId', event.target.value)}><option value="">Não vincular</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></FormField><FormField label="Profissional"><select className={inputClass} value={field('doctorId')} onChange={event => setField('doctorId', event.target.value)}><option value="">Não vincular</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></FormField><FormField label="Agendamento"><select className={inputClass} value={field('appointmentId')} onChange={event => setField('appointmentId', event.target.value)}><option value="">Não vincular</option>{appointments.map(appointment => <option key={appointment.id} value={appointment.id}>{shortDate(appointment.date)} • {appointment.time}</option>)}</select></FormField><FormField label="Categoria"><select className={inputClass} value={field('categoryId')} onChange={event => setField('categoryId', event.target.value)}><option value="">Selecionar</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField><FormField label="Centro de custo"><select className={inputClass} value={field('costCenterId')} onChange={event => setField('costCenterId', event.target.value)}><option value="">Selecionar</option>{costCenters.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}</select></FormField><FormField label="Forma de pagamento"><select className={inputClass} value={field('paymentMethodId')} onChange={event => setField('paymentMethodId', event.target.value)}><option value="">Selecionar</option>{paymentMethods.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}</select></FormField><FormField label="Conta"><select className={inputClass} value={field('accountId')} onChange={event => setField('accountId', event.target.value)}><option value="">Selecionar</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FormField><FormField label="Observações" className="md:col-span-2"><textarea className={`${inputClass} min-h-20`} value={field('notes')} onChange={event => setField('notes', event.target.value)} /></FormField></>}
    {modal === 'category' && <><FormField label="Nome" className="md:col-span-2"><input autoFocus className={inputClass} value={field('name')} onChange={event => setField('name', event.target.value)} /></FormField><FormField label="Tipo"><select className={inputClass} value={field('type', 'ambos')} onChange={event => setField('type', event.target.value)}><option value="ambos">Entradas e saídas</option><option value="receita">Receita</option><option value="despesa">Despesa</option></select></FormField><FormField label="Cor"><input className={`${inputClass} h-11`} type="color" value={field('color', '#2563eb')} onChange={event => setField('color', event.target.value)} /></FormField></>}
    {modal === 'costCenter' && <><FormField label="Nome" className="md:col-span-2"><input autoFocus className={inputClass} value={field('name')} onChange={event => setField('name', event.target.value)} /></FormField><FormField label="Descrição" className="md:col-span-2"><textarea className={`${inputClass} min-h-20`} value={field('description')} onChange={event => setField('description', event.target.value)} /></FormField></>}
    {modal === 'paymentMethod' && <><FormField label="Nome" className="md:col-span-2"><input autoFocus className={inputClass} value={field('name')} onChange={event => setField('name', event.target.value)} /></FormField><FormField label="Aplicação"><select className={inputClass} value={field('kind', 'ambos')} onChange={event => setField('kind', event.target.value)}><option value="ambos">Entrada e saída</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select></FormField><FormField label="Taxa (%)"><input className={inputClass} type="number" step="0.01" value={field('feePercent', '0')} onChange={event => setField('feePercent', event.target.value)} /></FormField></>}
    {modal === 'bankAccount' && <><FormField label="Nome da conta"><input autoFocus className={inputClass} value={field('name')} onChange={event => setField('name', event.target.value)} /></FormField><FormField label="Tipo"><select className={inputClass} value={field('kind', 'banco')} onChange={event => setField('kind', event.target.value)}><option value="banco">Conta bancária</option><option value="caixa">Caixa físico</option></select></FormField><FormField label="Banco"><input className={inputClass} value={field('bank')} onChange={event => setField('bank', event.target.value)} /></FormField><FormField label="Agência"><input className={inputClass} value={field('agency')} onChange={event => setField('agency', event.target.value)} /></FormField><FormField label="Número da conta"><input className={inputClass} value={field('accountNumber')} onChange={event => setField('accountNumber', event.target.value)} /></FormField><FormField label="Saldo inicial"><input className={inputClass} type="number" step="0.01" value={field('openingBalance', '0')} onChange={event => setField('openingBalance', event.target.value)} /></FormField></>}
    {modal === 'insurance' && <><FormField label="Nome do plano"><input autoFocus className={inputClass} value={field('name')} onChange={event => setField('name', event.target.value)} /></FormField><FormField label="Operadora"><input className={inputClass} value={field('operator')} onChange={event => setField('operator', event.target.value)} /></FormField><FormField label="Código"><input className={inputClass} value={field('code')} onChange={event => setField('code', event.target.value)} /></FormField><FormField label="Prazo de pagamento (dias)"><input className={inputClass} type="number" value={field('paymentTermDays', '30')} onChange={event => setField('paymentTermDays', event.target.value)} /></FormField></>}
    {modal === 'repass' && <><FormField label="Profissional"><select autoFocus className={inputClass} value={field('doctorId')} onChange={event => setField('doctorId', event.target.value)}><option value="">Selecionar</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></FormField><FormField label="Paciente (opcional)"><select className={inputClass} value={field('patientId')} onChange={event => setField('patientId', event.target.value)}><option value="">Não vincular</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></FormField><FormField label="Agendamento (opcional)"><select className={inputClass} value={field('appointmentId')} onChange={event => setField('appointmentId', event.target.value)}><option value="">Não vincular</option>{appointments.map(appointment => <option key={appointment.id} value={appointment.id}>{shortDate(appointment.date)} • {appointment.time} • {appointment.id}</option>)}</select></FormField><FormField label="Competência"><input className={inputClass} type="month" value={field('referenceMonth')} onChange={event => setField('referenceMonth', event.target.value)} /></FormField><FormField label="Produção bruta"><input className={inputClass} type="number" step="0.01" value={field('grossAmount')} onChange={event => setField('grossAmount', event.target.value)} /></FormField><FormField label="Percentual do profissional"><input className={inputClass} type="number" step="0.01" value={field('percentage', '60')} onChange={event => setField('percentage', event.target.value)} /></FormField><FormField label="Vencimento"><input className={inputClass} type="date" value={field('dueDate', today())} onChange={event => setField('dueDate', event.target.value)} /></FormField><FormField label="Observações"><input className={inputClass} value={field('notes')} onChange={event => setField('notes', event.target.value)} /></FormField></>}
    {modal === 'cash' && <><FormField label="Caixa"><select autoFocus className={inputClass} value={field('accountId')} onChange={event => setField('accountId', event.target.value)}><option value="">Selecionar</option>{accounts.filter(account => account.kind === 'caixa').map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FormField><FormField label="Data"><input className={inputClass} type="date" value={field('date', today())} onChange={event => setField('date', event.target.value)} /></FormField><FormField label="Saldo de abertura"><input className={inputClass} type="number" step="0.01" value={field('openingBalance', '0')} onChange={event => setField('openingBalance', event.target.value)} /></FormField><FormField label="Saldo esperado"><input className={inputClass} type="number" step="0.01" value={field('expectedBalance', '0')} onChange={event => setField('expectedBalance', event.target.value)} /></FormField><FormField label="Saldo conferido"><input className={inputClass} type="number" step="0.01" value={field('countedBalance', '0')} onChange={event => setField('countedBalance', event.target.value)} /></FormField><FormField label="Responsável"><input className={inputClass} value={field('responsibleName')} onChange={event => setField('responsibleName', event.target.value)} /></FormField></>}
    {modal === 'billing' && <><FormField label="Competência"><input autoFocus className={inputClass} type="month" value={field('referenceMonth')} onChange={event => setField('referenceMonth', event.target.value)} /></FormField><FormField label="Convênio"><select className={inputClass} value={field('insurancePlanId')} onChange={event => setField('insurancePlanId', event.target.value)}><option value="">Particular / consolidado</option>{insurancePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></FormField><FormField label="Paciente"><select className={inputClass} value={field('patientId')} onChange={event => setField('patientId', event.target.value)}><option value="">Lote consolidado</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></FormField><FormField label="Valor total"><input className={inputClass} type="number" step="0.01" value={field('totalAmount')} onChange={event => setField('totalAmount', event.target.value)} /></FormField><FormField label="Vencimento"><input className={inputClass} type="date" value={field('dueDate', today())} onChange={event => setField('dueDate', event.target.value)} /></FormField><FormField label="Observações" className="md:col-span-2"><textarea className={`${inputClass} min-h-20`} value={field('notes')} onChange={event => setField('notes', event.target.value)} /></FormField></>}
  </div><div className="px-6 pb-6 flex justify-end gap-3"><button onClick={close} className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100">Cancelar</button><button onClick={save} className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700">Salvar cadastro</button></div></div></div>;
};

export default FinancialModule;