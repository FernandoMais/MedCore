import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Check, CheckCircle2, ClipboardList, Download, ExternalLink,
  Loader2, Printer, RefreshCw, Send, X,
} from 'lucide-react';
import { AppointmentStatus, Doctor, User, UserRole } from '../types';
import {
  BillingRow, FeeProfile, confirmReceipt, loadManualBilling, markPayout, sendPaymentLink,
} from '../services/manualPayments';

interface ManualPaymentsProps {
  currentUser: User;
  doctors: Doctor[];
  onChanged?: () => Promise<void> | void;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => new Date().toLocaleDateString('en-CA');
const dateLabel = (value?: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';
const safeHttpsUrl = (value?: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
};

const csvCell = (value: unknown) => {
  let safe = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] || char));

const ManualPayments: React.FC<ManualPaymentsProps> = ({ currentUser, doctors, onChanged }) => {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [profiles, setProfiles] = useState<FeeProfile[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [modalRow, setModalRow] = useState<BillingRow | null>(null);
  const [receipt, setReceipt] = useState({ amount: '', date: today(), reference: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [sendingId, setSendingId] = useState('');

  const isDoctor = currentUser.role === UserRole.DOCTOR || currentUser.role === 'doctor';
  const reload = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await loadManualBilling();
      setRows(result.rows || []);
      setProfiles(result.profiles || []);
      setCanManage(result.canManage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o relatório de cobranças.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const visibleRows = useMemo(() => rows.filter(row => {
    const allowedDoctor = !isDoctor || (!!currentUser.doctorId && row.doctorId === currentUser.doctorId && row.status === AppointmentStatus.FINISHED);
    const matchesDoctor = !doctorFilter || row.doctorId === doctorFilter;
    const matchesFrom = !from || row.date >= from;
    const matchesTo = !to || row.date <= to;
    const isPaid = row.paymentStatus.toLowerCase() === 'pago';
    const matchesPayment = paymentFilter === 'todos' || (paymentFilter === 'pago' ? isPaid : !isPaid);
    return allowedDoctor && matchesDoctor && matchesFrom && matchesTo && matchesPayment;
  }), [rows, isDoctor, currentUser.doctorId, doctorFilter, from, to, paymentFilter]);

  const totals = useMemo(() => visibleRows.reduce((sum, row) => ({
    gross: sum.gross + row.price,
    professional: sum.professional + row.repassAmount,
    clinic: sum.clinic + row.price - row.repassAmount,
    pending: sum.pending + (row.paymentStatus.toLowerCase() === 'pago' ? 0 : row.price),
    paid: sum.paid + (row.paymentStatus.toLowerCase() === 'pago' ? row.price : 0),
  }), { gross: 0, professional: 0, clinic: 0, pending: 0, paid: 0 }), [visibleRows]);
  const profileByDoctor = useMemo(() => new Map(profiles.map(profile => [profile.doctorId, profile])), [profiles]);
  const selectedDoctorId = isDoctor ? currentUser.doctorId : doctorFilter;
  const selectedProfile = selectedDoctorId ? profileByDoctor.get(selectedDoctorId) : undefined;
  const selectedDoctor = doctors.find(doctor => doctor.id === selectedDoctorId);
  const canViewPayoutDetails = canManage || isDoctor;

  const refreshAfterMutation = async () => {
    await reload(true);
    await onChanged?.();
  };

  const openReceipt = (row: BillingRow) => {
    setModalRow(row);
    setReceipt({ amount: row.price.toFixed(2), date: today(), reference: '' });
    setNotice('');
  };

  const handleReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modalRow || saving) return;
    const amount = Number(receipt.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount !== modalRow.price || !receipt.date || !receipt.reference.trim()) {
      setNotice('Informe o valor exato da cobrança, a data do recebimento e a referência.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      await confirmReceipt({
        appointmentId: modalRow.appointmentId,
        amount,
        date: receipt.date,
        reference: receipt.reference.trim(),
        expected: modalRow.version,
      });
      setModalRow(null);
      await refreshAfterMutation();
    } catch (mutationError) {
      setNotice(mutationError instanceof Error ? mutationError.message : 'Não foi possível confirmar o recebimento.');
    } finally {
      setSaving(false);
    }
  };

  const handlePayout = async (row: BillingRow) => {
    if (saving || row.status !== AppointmentStatus.FINISHED || row.paymentStatus.toLowerCase() !== 'pago' || row.repassStatus.toLowerCase() === 'pago') return;
    setSaving(true);
    setError('');
    try {
      await markPayout({ appointmentId: row.appointmentId, date: today(), expected: row.version });
      await refreshAfterMutation();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível registrar o repasse.');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (row: BillingRow) => {
    if (sendingId || !safeHttpsUrl(row.paymentUrl) || row.status === AppointmentStatus.CANCELLED || row.status === AppointmentStatus.ABSENT) return;
    setSendingId(row.appointmentId);
    setNotice('');
    try {
      const result = await sendPaymentLink(row.appointmentId);
      setNotice(result.sent
        ? `Solicitação de envio do link aceita para ${row.patientName}; isso não comprova entrega na caixa de entrada.`
        : result.error || 'Não foi possível solicitar o envio do link.');
    } catch (sendError) {
      setNotice(sendError instanceof Error ? sendError.message : 'Não foi possível enviar o link.');
    } finally {
      setSendingId('');
    }
  };

  const exportCsv = () => {
    const headers = ['Data', 'Paciente', 'Profissional', 'Atendimento', 'Status clínico', 'Cobrança', 'Valor bruto', 'Repasse profissional', 'Complemento clínica', 'Data recebimento', 'Referência', 'Status repasse', 'Data repasse', 'Banco para repasse', 'Agência para repasse', 'Conta para repasse', 'Pix para repasse'];
    const data = visibleRows.map(row => [
      row.date, row.patientName, row.doctorName, row.appointmentId, row.status, row.paymentStatus,
      row.price.toFixed(2), row.repassAmount.toFixed(2), (row.price - row.repassAmount).toFixed(2),
      row.paymentDate || '', row.receiptReference || '', row.repassStatus, row.repassPaidDate || '',
      ...(canViewPayoutDetails ? [
        profileByDoctor.get(row.doctorId)?.bank || '',
        profileByDoctor.get(row.doctorId)?.agency || '',
        profileByDoctor.get(row.doctorId)?.account || '',
        profileByDoctor.get(row.doctorId)?.pixKey || '',
      ] : ['', '', '', '']),
    ]);
    const csv = [headers, ...data].map(row => row.map(csvCell).join(';')).join('\r\n');
    const blobUrl = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `relatorio-cobrancas-${today()}.csv`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const printReport = () => {
    const frame = document.createElement('iframe');
    frame.title = 'Relatório de cobranças para impressão';
    frame.style.position = 'fixed';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { frame.remove(); setError('Não foi possível preparar a impressão.'); return; }
    const payoutHeaders = canViewPayoutDetails ? '<th>Banco</th><th>Agência</th><th>Conta</th><th>Pix</th>' : '';
    const tableRows = visibleRows.map(row => {
      const profile = canViewPayoutDetails ? profileByDoctor.get(row.doctorId) : undefined;
      const payoutCells = canViewPayoutDetails
        ? `<td>${escapeHtml(profile?.bank)}</td><td>${escapeHtml(profile?.agency)}</td><td>${escapeHtml(profile?.account)}</td><td>${escapeHtml(profile?.pixKey)}</td>`
        : '';
      return `<tr><td>${escapeHtml(dateLabel(row.date))}</td><td>${escapeHtml(row.patientName)}</td><td>${escapeHtml(row.doctorName)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.paymentStatus)}</td><td>${escapeHtml(money(row.price))}</td><td>${escapeHtml(money(row.repassAmount))}</td><td>${escapeHtml(row.repassStatus)}</td>${payoutCells}</tr>`;
    }).join('');
    doc.open();
    doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório manual de cobranças</title><style>body{font:12px Arial,sans-serif;color:#1e293b;padding:24px}h1{font-size:20px}p{color:#475569}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#eff6ff} @media print{body{padding:0}}</style></head><body><h1>Relatório manual de cobranças</h1><p>Gerado em ${escapeHtml(dateLabel(today()))} · ${visibleRows.length} atendimento(s)</p><table><thead><tr><th>Data</th><th>Paciente</th><th>Profissional</th><th>Status clínico</th><th>Cobrança</th><th>Valor bruto</th><th>Repasse</th><th>Status repasse</th>${payoutHeaders}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };

  const manage = canManage && !isDoctor;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Financeiro · operação manual</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-800">Cobranças e repasses</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Registro operacional separado do atendimento clínico. A confirmação de pagamento é manual; não há conexão com processador. O aceite do envio de e-mail não comprova entrega na caixa de entrada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void reload(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button type="button" onClick={exportCsv} disabled={!visibleRows.length} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50"><Download size={14} /> CSV</button>
          <button type="button" onClick={printReport} disabled={!visibleRows.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Printer size={14} /> Imprimir</button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><button onClick={() => void reload(true)} className="text-xs font-black uppercase underline">Tentar novamente</button></div>}
      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={16} /></button></div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Valor bruto', totals.gross, 'text-slate-800'],
          ['Recebido', totals.paid, 'text-emerald-700'],
          ['Repasse profissional', totals.professional, 'text-blue-700'],
          ['Complemento clínica', totals.clinic, 'text-indigo-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-400">{label}</p>
            <p className={`mt-2 text-xl font-black ${tone}`}>{money(Number(value))}</p>
            {label === 'Valor bruto' && <p className="mt-1 text-[11px] font-bold text-amber-600">Em aberto: {money(totals.pending)}</p>}
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <label className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Profissional
          <select value={doctorFilter} onChange={event => setDoctorFilter(event.target.value)} disabled={isDoctor} className={`${inputClass} mt-2`}><option value="">Todos</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">De<input type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-2`} /></label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Até<input type="date" value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-2`} /></label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recebimento
          <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value as typeof paymentFilter)} className={`${inputClass} mt-2`}><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="pago">Recebido</option></select>
        </label>
      </section>

      {selectedDoctorId && selectedDoctor && canViewPayoutDetails && (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Dados privados para repasse</p><h2 className="mt-1 text-sm font-black text-slate-800">{selectedDoctor.name}</h2></div>
            <p className="text-[10px] font-bold text-slate-400">Exibidos somente ao profissional vinculado ou equipe autorizada</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Banco', selectedProfile?.bank],
              ['Agência', selectedProfile?.agency],
              ['Conta', selectedProfile?.account],
              ['Chave Pix', selectedProfile?.pixKey],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-blue-100 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-bold text-slate-700">{value || 'Não informado'}</p></div>)}
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6" aria-label="Carregando cobranças">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead><tr className="border-b border-slate-100 bg-slate-50">{['Atendimento', 'Paciente / profissional', 'Cobrança', 'Valores', 'Repasse', ...(manage ? ['Ações'] : [])].map(title => <th key={title} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map(row => {
                  const isPaid = row.paymentStatus.toLowerCase() === 'pago';
                  const isRepassPaid = row.repassStatus.toLowerCase() === 'pago';
                  const finished = row.status === AppointmentStatus.FINISHED;
                  const blockedPaymentAction = row.status === AppointmentStatus.CANCELLED || row.status === AppointmentStatus.ABSENT;
                  const paymentUrl = safeHttpsUrl(row.paymentUrl);
                  return <tr key={row.appointmentId} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4"><p className="text-sm font-black text-slate-700">{dateLabel(row.date)}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{row.appointmentId}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${finished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.status}</span></td>
                    <td className="px-5 py-4"><p className="text-sm font-black text-slate-800">{row.patientName}</p><p className="mt-1 text-xs font-bold text-blue-700">{row.doctorName}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.paymentStatus}</span><p className="mt-2 text-[11px] font-medium text-slate-400">{isPaid ? `${dateLabel(row.paymentDate)} · ${row.receiptReference || 'sem referência'}` : 'Aguardando confirmação manual'}</p></td>
                    <td className="px-5 py-4"><p className="text-sm font-black text-slate-800">{money(row.price)}</p><p className="mt-1 text-[10px] font-bold text-slate-400">Profissional {money(row.repassAmount)}</p><p className="text-[10px] font-bold text-slate-400">Clínica {money(row.price - row.repassAmount)}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${isRepassPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.repassStatus}</span>{row.repassPaidDate && <p className="mt-2 text-[10px] font-bold text-slate-400">{dateLabel(row.repassPaidDate)}</p>}</td>
                    {manage && <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
                      {!isPaid && !blockedPaymentAction && <button onClick={() => openReceipt(row)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100"><Check size={14} /> Confirmar</button>}
                      {!isPaid && !blockedPaymentAction && paymentUrl && <button onClick={() => void handleSend(row)} disabled={!!sendingId} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50">{sendingId === row.appointmentId ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Reenviar</button>}
                      {finished && isPaid && !isRepassPaid && <button onClick={() => void handlePayout(row)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100"><CheckCircle2 size={14} /> Registrar repasse</button>}
                      {paymentUrl && !blockedPaymentAction && <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-400 hover:text-blue-700" title="Abrir link HTTPS"><ExternalLink size={14} /> Link</a>}
                    </div></td>}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ClipboardList size={22} /></div>
            <h3 className="mt-4 text-sm font-black text-slate-700">Nenhum atendimento neste recorte</h3>
            <p className="mt-1 text-xs font-medium text-slate-400">Ajuste os filtros ou atualize os dados para consultar o relatório.</p>
          </div>
        )}
      </div>
      {!manage && isDoctor && <p className="text-xs font-medium text-slate-400">Visão restrita aos seus atendimentos finalizados. O atendimento clínico não representa quitação financeira.</p>}

      {modalRow && manage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="presentation">
          <form onSubmit={handleReceipt} className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Baixa manual</p><h2 className="mt-1 text-xl font-black text-slate-800">Confirmar recebimento</h2></div><button type="button" aria-label="Fechar" onClick={() => setModalRow(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black text-slate-700">{modalRow.patientName}</p><p className="mt-1 text-xs font-bold text-slate-500">{money(modalRow.price)} · {dateLabel(modalRow.date)}</p></div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor recebido (R$)<input className={`${inputClass} mt-2`} type="number" min="0.01" step="0.01" value={receipt.amount} onChange={event => setReceipt(current => ({ ...current, amount: event.target.value }))} required /></label>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Data do recebimento<input className={`${inputClass} mt-2`} type="date" max={today()} value={receipt.date} onChange={event => setReceipt(current => ({ ...current, date: event.target.value }))} required /></label>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Referência / comprovante<input className={`${inputClass} mt-2`} value={receipt.reference} onChange={event => setReceipt(current => ({ ...current, reference: event.target.value }))} maxLength={160} placeholder="Identificação do comprovante" required /></label>
            {notice && <p role="alert" className="text-xs font-bold text-rose-700">{notice}</p>}
            <p className="text-[11px] font-medium text-slate-400">Esta ação registra confirmação informada pela equipe; não verifica transação externa.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setModalRow(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase text-slate-500">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Confirmar valor</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManualPayments;
