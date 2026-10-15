import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Save } from 'lucide-react';
import { Doctor } from '../types';
import { FeeProfile, loadManualBilling, saveFeeProfile } from '../services/manualPayments';

interface DoctorFeeProfileProps {
  doctor: Doctor;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';
const emptyProfile = (doctorId: string): FeeProfile => ({
  doctorId, price: 0, doctorPercent: 0, paymentUrl: '', bank: '', agency: '', account: '', pixKey: '',
});

const isSafeHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

const DoctorFeeProfile: React.FC<DoctorFeeProfileProps> = ({ doctor }) => {
  const [profile, setProfile] = useState<FeeProfile>(() => emptyProfile(doctor.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSaved(false);
    loadManualBilling()
      .then(({ profiles }) => {
        if (!active) return;
        setProfile(profiles.find(item => item.doctorId === doctor.id) || emptyProfile(doctor.id));
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os dados financeiros deste profissional.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [doctor.id]);

  const update = (field: keyof FeeProfile, value: string | number) => {
    setSaved(false);
    setProfile(current => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    const price = Number(profile.price);
    const percent = Number(profile.doctorPercent);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Informe um preço de consulta maior que zero.');
      return;
    }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError('O percentual do profissional deve estar entre 0% e 100%.');
      return;
    }
    const paymentUrl = profile.paymentUrl.trim();
    if (paymentUrl && !isSafeHttpsUrl(paymentUrl)) {
      setError('O link de pagamento deve ser HTTPS e não pode conter credenciais.');
      return;
    }
    setSaving(true);
    try {
      await saveFeeProfile({ ...profile, doctorId: doctor.id, price, doctorPercent: percent, paymentUrl });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o perfil financeiro.');
    } finally {
      setSaving(false);
    }
  };

  const complement = Number.isFinite(Number(profile.doctorPercent))
    ? Math.max(0, 100 - Number(profile.doctorPercent))
    : 0;

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Cobrança manual</p>
          <h3 className="mt-1 text-lg font-black text-slate-800">Preço e repasse</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Link reutilizável informado pela clínica. Sem integração automática de pagamento.</p>
        </div>
        {profile.paymentUrl && isSafeHttpsUrl(profile.paymentUrl) && (
          <a href={profile.paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
            Abrir link <ExternalLink size={14} />
          </a>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Carregando perfil financeiro">
          <div className="h-10 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-xs text-slate-500">Percentuais calculados sobre o valor bruto. Taxas do meio de pagamento não são descontadas automaticamente. Ao alterar o preço, crie outro link e preserve o valor do link anterior.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Preço da consulta (R$)
              <input className={`${inputClass} mt-2`} type="number" min="0.01" step="0.01" value={profile.price || ''} onChange={event => update('price', event.target.value === '' ? 0 : Number(event.target.value))} placeholder="Ex.: 240,00" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Percentual do profissional
              <div className="relative mt-2">
                <input className={`${inputClass} pr-9`} type="number" min="0" max="100" step="0.1" value={profile.doctorPercent || ''} onChange={event => update('doctorPercent', event.target.value === '' ? 0 : Number(event.target.value))} placeholder="0 a 100" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-xs">
            <div><p className="font-bold text-slate-400">Profissional</p><p className="mt-1 font-black text-slate-800">{(Number(profile.price || 0) * Number(profile.doctorPercent || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
            <div><p className="font-bold text-slate-400">Complemento da clínica · {complement}%</p><p className="mt-1 font-black text-slate-800">{(Number(profile.price || 0) * complement / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Link de pagamento HTTPS (opcional)
            <input className={`${inputClass} mt-2`} type="url" inputMode="url" value={profile.paymentUrl} onChange={event => update('paymentUrl', event.target.value)} placeholder="https://…" />
          </label>
          <div className="border-t border-blue-100 pt-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Dados para repasse · opcionais no cadastro</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input aria-label="Banco" className={inputClass} value={profile.bank} onChange={event => update('bank', event.target.value)} placeholder="Banco" />
              <input aria-label="Agência" className={inputClass} value={profile.agency} onChange={event => update('agency', event.target.value)} placeholder="Agência" />
              <input aria-label="Conta" className={inputClass} value={profile.account} onChange={event => update('account', event.target.value)} placeholder="Conta" />
              <input aria-label="Chave Pix" className={inputClass} value={profile.pixKey} onChange={event => update('pixKey', event.target.value)} placeholder="Chave Pix" />
            </div>
          </div>
          {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertCircle size={15} />{error}</p>}
          {saved && <p role="status" className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} />Perfil financeiro salvo.</p>}
          <div className="flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default DoctorFeeProfile;
