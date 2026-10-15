begin;

-- External links only: no payment-provider API credentials or webhooks.
create table if not exists public.manual_fee_profiles (
 doctor_id text primary key references public.doctors(id),
 clinic_id text not null,
 price numeric(12,2) not null check(price>0),
 doctor_percent numeric(5,2) not null check(doctor_percent between 0 and 100),
 payment_url text not null check(payment_url ~ '^https://[^/@[:space:]]+([/?#]|$)'),
 bank text not null default '', agency text not null default '',
 account text not null default '', pix_key text not null default '',
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.manual_receipts (
 appointment_id text primary key references public.appointments(id),
 clinic_id text not null, amount numeric(12,2) not null check(amount>0),
 paid_date date not null, reference text not null,
 actor_uid uuid not null, created_at timestamptz not null default clock_timestamp(),
 unique(clinic_id,reference)
);
create table if not exists public.manual_payouts (
 appointment_id text primary key references public.appointments(id),
 clinic_id text not null, amount numeric(12,2) not null check(amount>0),
 paid_date date not null, actor_uid uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.manual_payment_mail (
 appointment_id text primary key references public.appointments(id),
 last_attempt timestamptz, sent_at timestamptz, attempts integer not null default 0
);
alter table public.appointments add column if not exists "paymentUrl" text;
do $$ declare t text; begin
 foreach t in array array['manual_fee_profiles','manual_receipts','manual_payouts','manual_payment_mail'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check
 (role in ('admin','doctor','collaborator','patient','secretaria','tesouraria'));
-- Preserve password-reset session checks while allowing the two staff roles.
do $$ declare n text; src text; begin
 foreach n in array array['current_user_clinic_id()','patient_access_is_staff(text)','operational_actor()','operational_staff_change(text,boolean,text)'] loop
  if to_regprocedure('public.'||n) is not null then
   select pg_get_functiondef(to_regprocedure('public.'||n)) into src;
   src:=replace(src,'''admin'', ''doctor'', ''collaborator''','''admin'', ''doctor'', ''collaborator'', ''secretaria'', ''tesouraria''');
   src:=replace(src,'''admin'',''doctor'',''collaborator''','''admin'',''doctor'',''collaborator'',''secretaria'',''tesouraria''');
   execute src;
  end if;
 end loop;
 select pg_get_functiondef('public.operational_guard_mutation()'::regprocedure) into src;
 src:=replace(src,'elsif not (tg_table_name=''appointments'' and tg_op=''INSERT'')',
 'elsif not ((tg_table_name=''appointments'' and tg_op=''INSERT'') or (current_setting(''app.manual_billing_write'',true)=''yes'' and tg_table_name=''financial_transactions'' and tg_op=''INSERT''))');
 execute src;
end $$;

create or replace function public.manual_billing_manager() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.users where "authUserId"=auth.uid() and active
 and role in ('admin','collaborator','secretaria','tesouraria'))
 and public.operational_session_valid()
$$;
revoke all on function public.manual_billing_manager() from public,anon;
grant execute on function public.manual_billing_manager() to authenticated;

create or replace function public.manual_billing_save_profile(p_profile jsonb,p_expected text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; oldrow public.manual_fee_profiles; d text:=p_profile->>'doctorId'; url text:=btrim(p_profile->>'paymentUrl'); begin
 a:=public.operational_actor();
 if not public.manual_billing_manager() then raise exception using errcode='42501',message='Cadastro financeiro exige administração, secretaria ou tesouraria.'; end if;
 if not exists(select 1 from public.doctors where id=d and "clinicId"=a."clinicId" and active) then raise exception 'Profissional não autorizado.'; end if;
 if url is null or length(url)>2048 or url !~ '^https://[A-Za-z0-9.-]+(:443)?([/?#][^[:space:]]*)?$'
 or url ~* '^https://(localhost|127[.]|10[.]|192[.]168[.]|169[.]254[.]|0[.])'
 then raise exception 'Informe um link público HTTPS válido, sem usuário ou senha.'; end if;
 if (p_profile->>'price')::numeric is null or (p_profile->>'price')::numeric<=0
 or (p_profile->>'doctorPercent')::numeric is null
 or (p_profile->>'doctorPercent')::numeric not between 0 and 100
 then raise exception 'Valor e percentual inválidos.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fee:'||d,0));
 select * into oldrow from public.manual_fee_profiles where doctor_id=d for update;
 if (oldrow.doctor_id is null and p_expected is not null) or
 (oldrow.doctor_id is not null and md5(to_jsonb(oldrow)::text) is distinct from p_expected)
 then raise exception using errcode='PT409',message='Outro acesso alterou os valores. Recarregue antes de salvar.'; end if;
 if oldrow.doctor_id is not null and oldrow.price is distinct from round((p_profile->>'price')::numeric,2)
 and oldrow.payment_url=url then raise exception 'Ao mudar o preço, cadastre um novo link. O link antigo deve continuar com o valor dos agendamentos anteriores.'; end if;
 insert into public.manual_fee_profiles(doctor_id,clinic_id,price,doctor_percent,payment_url,bank,agency,account,pix_key)
 values(d,a."clinicId",round((p_profile->>'price')::numeric,2),round((p_profile->>'doctorPercent')::numeric,2),url,
 left(coalesce(p_profile->>'bank',''),160),left(coalesce(p_profile->>'agency',''),40),
 left(coalesce(p_profile->>'account',''),80),left(coalesce(p_profile->>'pixKey',''),200))
 on conflict(doctor_id) do update set price=excluded.price,doctor_percent=excluded.doctor_percent,
 payment_url=excluded.payment_url,bank=excluded.bank,agency=excluded.agency,account=excluded.account,pix_key=excluded.pix_key,updated_at=clock_timestamp();
 perform public.operational_log('update','manual_fee_profiles',d,null,jsonb_build_object('price',p_profile->'price','doctorPercent',p_profile->'doctorPercent'));
end $$;

-- Capture trusted prices at booking, never prices supplied by a patient/browser.
create or replace function public.manual_billing_appointment_terms() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.manual_fee_profiles; begin
 if current_setting('app.manual_restore',true)='yes' then return new; end if;
 if tg_op='UPDATE' then
  if new."serviceValue" is distinct from old."serviceValue" or new."repassRule" is distinct from old."repassRule"
   or new."paymentUrl" is distinct from old."paymentUrl" then
   raise exception 'O preço, o percentual e o link históricos do agendamento não podem ser alterados.';
  end if;
  if old."paymentUrl" is not null and (new."doctorId" is distinct from old."doctorId" or new.type is distinct from old.type) then
   raise exception 'Para trocar o profissional ou o tipo de consulta, cancele e faça outro agendamento.';
  end if;
  return new;
 end if;
 select * into f from public.manual_fee_profiles where doctor_id=new."doctorId" and clinic_id=new."clinicId";
 if f.doctor_id is not null then
  if new.type <> 'Consulta' then
   raise exception 'O link cadastrado é para consulta. Cadastre outro tipo de atendimento com a administração.';
  end if;
  new."serviceValue":=f.price;
  new."repassRule":=jsonb_build_object('type','percentage','value',f.doctor_percent);
  new."paymentUrl":=f.payment_url;
 end if;
 return new;
end $$;
drop trigger if exists manual_billing_terms on public.appointments;
create trigger manual_billing_terms before insert or update on public.appointments
for each row execute function public.manual_billing_appointment_terms();

create or replace function public.manual_booking_terms_match(p_doctor text,p_clinic text,p_price numeric,p_rule jsonb,p_url text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select case when exists(select 1 from public.manual_fee_profiles where doctor_id=p_doctor and clinic_id=p_clinic)
 then exists(select 1 from public.manual_fee_profiles where doctor_id=p_doctor and clinic_id=p_clinic
 and price=p_price and p_rule=jsonb_build_object('type','percentage','value',doctor_percent) and payment_url=p_url)
 else p_price is null and p_rule is null and p_url is null end
$$;
revoke all on function public.manual_booking_terms_match(text,text,numeric,jsonb,text) from public,anon;
grant execute on function public.manual_booking_terms_match(text,text,numeric,jsonb,text) to authenticated;
do $$ declare rule text; begin
 select with_check into rule from pg_policies where schemaname='public' and tablename='appointments'
 and policyname='patient access own appointment insert';
 if position('manual_booking_terms_match' in rule)=0 then
  rule:=replace(rule,'("serviceValue" IS NULL) AND ("repassRule" IS NULL)',
    'public.manual_booking_terms_match("doctorId","clinicId","serviceValue","repassRule","paymentUrl")');
  if position('manual_booking_terms_match' in rule)=0 then raise exception 'Revise a política de agendamento antes de habilitar valores.'; end if;
  execute 'alter policy "patient access own appointment insert" on public.appointments with check ('||rule||')';
 end if;
end $$;

create or replace function public.manual_billing_create_receivable() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if current_setting('app.manual_restore',true)='yes' then return null; end if;
 if new."paymentUrl" is not null and new."serviceValue">0 then
  perform set_config('app.operational_write','yes',true);
  perform set_config('app.manual_billing_write','yes',true);
  insert into public.financial_transactions(id,"clinicId",type,status,description,amount,"dueDate","patientId","doctorId","appointmentId","createdAt")
  values('ft-appt-'||new.id,new."clinicId",'receita','pendente','Consulta agendada',new."serviceValue",new.date,new."patientId",new."doctorId",new.id,clock_timestamp()::text)
  on conflict do nothing;
 end if;
 return null;
end $$;
drop trigger if exists manual_billing_receivable on public.appointments;
create trigger manual_billing_receivable after insert on public.appointments
for each row execute function public.manual_billing_create_receivable();

create or replace function public.manual_billing_transaction_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.appointments; begin
 if current_setting('app.manual_restore',true)='yes' then return new; end if;
 select * into a from public.appointments where id=new."appointmentId" and "paymentUrl" is not null;
 if a.id is null then return new; end if;
 if new.type='receita' and (new.amount is distinct from a."serviceValue" or new."clinicId" is distinct from a."clinicId"
 or new."doctorId" is distinct from a."doctorId" or new."patientId" is distinct from a."patientId")
 then raise exception 'Os valores e vínculos da cobrança devem corresponder ao agendamento.'; end if;
 if new.type='receita' and new.status='pago' and not exists(select 1 from public.manual_receipts where appointment_id=a.id) then
  raise exception 'Confira o recebimento pela área Cobranças e repasses, informando a transação.'; end if;
 if tg_op='UPDATE' and old.status='pago' and new.status<>old.status then
  raise exception 'O recebimento já foi conferido. Estornos exigem conciliação financeira, não alteração do status.'; end if;
 return new;
end $$;
drop trigger if exists manual_billing_transaction on public.financial_transactions;
create trigger manual_billing_transaction before insert or update on public.financial_transactions
for each row execute function public.manual_billing_transaction_guard();

create or replace function public.manual_billing_version(p_id text) returns text
language sql stable security definer set search_path=pg_catalog,public as $$
 select md5(to_jsonb(a)::text||coalesce((select to_jsonb(r)::text from public.manual_receipts r where r.appointment_id=a.id),'')
 ||coalesce((select to_jsonb(p)::text from public.manual_payouts p where p.appointment_id=a.id),'')
 ||coalesce((select string_agg(to_jsonb(t)::text,'' order by t.id) from public.financial_transactions t where t."appointmentId"=a.id and t.type='receita'),''))
 from public.appointments a where a.id=p_id
$$;
revoke all on function public.manual_billing_version(text) from public,anon,authenticated;

create or replace function public.manual_billing_snapshot() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.users; profiles jsonb; rows jsonb; begin
 actor:=public.operational_actor();
 select coalesce(jsonb_agg(jsonb_build_object('doctorId',f.doctor_id,'price',f.price,'doctorPercent',f.doctor_percent,
 'paymentUrl',f.payment_url,'bank',f.bank,'agency',f.agency,'account',f.account,'pixKey',f.pix_key,'version',md5(to_jsonb(f)::text))),'[]')
 into profiles from public.manual_fee_profiles f where clinic_id=actor."clinicId"
 and (public.manual_billing_manager() or f.doctor_id=actor.doctor_id);
 select coalesce(jsonb_agg(jsonb_build_object(
 'appointmentId',a.id,'doctorId',a."doctorId",'patientId',a."patientId",'patientName',p.name,'doctorName',d.name,
 'date',a.date,'status',a.status,'price',a."serviceValue",'doctorPercent',case when a."repassRule"->>'type'='percentage'
 then coalesce((a."repassRule"->>'value')::numeric,0) else 0 end,'paymentUrl',a."paymentUrl",
 'paymentStatus',case when r.appointment_id is not null then 'pago' else coalesce(t.status,'pendente') end,
 'paymentDate',coalesce(r.paid_date::text,t."paidDate"),'receiptReference',coalesce(r.reference,t."documentNumber"),
 'repassAmount',round(case when a."repassRule"->>'type'='percentage' then a."serviceValue"*coalesce((a."repassRule"->>'value')::numeric,0)/100
 else coalesce((a."repassRule"->>'value')::numeric,0) end,2),
 'repassStatus',case when po.appointment_id is not null then 'pago' else coalesce(rp.status,'previsto') end,
 'repassPaidDate',coalesce(po.paid_date::text,rp."paidDate"),'version',public.manual_billing_version(a.id)
 ) order by a.date desc,a.time desc),'[]') into rows
 from public.appointments a join public.patients p on p.id=a."patientId" join public.doctors d on d.id=a."doctorId"
 left join public.manual_receipts r on r.appointment_id=a.id
 left join public.manual_payouts po on po.appointment_id=a.id
 left join public.financial_transactions t on t."appointmentId"=a.id and t.type='receita'
 left join public.financial_repasses rp on rp."appointmentId"=a.id
 where a."clinicId"=actor."clinicId" and a."serviceValue">0
 and (public.manual_billing_manager() or (a."doctorId"=actor.doctor_id and a.status='Finalizado'));
 return jsonb_build_object('profiles',profiles,'rows',rows,'canManage',public.manual_billing_manager());
end $$;

create or replace function public.manual_billing_confirm(
 p_appointment text,p_amount numeric,p_date text,p_reference text,p_expected text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.users; a public.appointments; begin
 actor:=public.operational_actor();
 if not public.manual_billing_manager() then raise exception using errcode='42501',message='Conferência de pagamentos exige equipe financeira.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_appointment,0));
 select * into a from public.appointments where id=p_appointment and "clinicId"=actor."clinicId" for update;
 if a.id is null then raise exception using errcode='42501',message='Agendamento não autorizado.'; end if;
 if public.manual_billing_version(a.id) is distinct from p_expected then raise exception using errcode='PT409',message='Outro acesso alterou o pagamento. Recarregue e confira.'; end if;
 if a.status in ('Cancelado','Faltou') or p_amount is distinct from a."serviceValue" or p_amount<=0
 or p_date is null or p_date::date>current_date or p_date::date<date '2000-01-01'
 or length(btrim(coalesce(p_reference,''))) not between 3 and 160 then raise exception 'Confira o valor integral, a data e o identificador da transação.'; end if;
 if exists(select 1 from public.manual_receipts where appointment_id=a.id)
 or exists(select 1 from public.financial_transactions where "appointmentId"=a.id and type='receita' and status='pago')
 then raise exception 'Este recebimento já foi conferido.'; end if;
 insert into public.manual_receipts(appointment_id,clinic_id,amount,paid_date,reference,actor_uid)
 values(a.id,actor."clinicId",p_amount,p_date::date,btrim(p_reference),auth.uid());
 perform set_config('app.operational_write','yes',true);
 insert into public.financial_transactions(id,"clinicId",type,status,description,amount,"dueDate","patientId","doctorId","appointmentId","createdAt")
 values('ft-appt-'||a.id,actor."clinicId",'receita','pendente','Consulta',p_amount,a.date,a."patientId",a."doctorId",a.id,clock_timestamp()::text)
 on conflict do nothing;
 update public.financial_transactions set status='pago',"paidDate"=p_date,"documentNumber"=btrim(p_reference)
 where "appointmentId"=a.id and type='receita' and "clinicId"=actor."clinicId";
 perform public.operational_log('confirm_payment','appointments',a.id,a."patientId",jsonb_build_object('amount',p_amount,'paidDate',p_date));
end $$;

create or replace function public.manual_billing_payout(p_appointment text,p_date text,p_expected text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.users; a public.appointments; amount numeric; f public.manual_fee_profiles; begin
 actor:=public.operational_actor();
 if not public.manual_billing_manager() then raise exception using errcode='42501',message='Registro de repasse exige equipe financeira.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_appointment,0));
 select * into a from public.appointments where id=p_appointment and "clinicId"=actor."clinicId" for update;
 if a.id is null then raise exception using errcode='42501',message='Agendamento não autorizado.'; end if;
 if public.manual_billing_version(a.id) is distinct from p_expected then raise exception using errcode='PT409',message='Outro acesso alterou o repasse. Recarregue e confira.'; end if;
 if a.status<>'Finalizado' or not exists(select 1 from public.financial_transactions where "appointmentId"=a.id and type='receita' and status='pago')
 then raise exception 'O repasse exige consulta finalizada e recebimento conferido.'; end if;
 if p_date is null or p_date::date>current_date or p_date::date<date '2000-01-01' then raise exception 'Data de repasse inválida.'; end if;
 select * into f from public.manual_fee_profiles where doctor_id=a."doctorId" and clinic_id=actor."clinicId";
 if btrim(coalesce(f.pix_key,''))='' and (btrim(coalesce(f.bank,''))='' or btrim(coalesce(f.account,''))='')
 then raise exception 'Cadastre a chave Pix ou os dados bancários do médico antes de registrar o repasse.'; end if;
 if exists(select 1 from public.financial_repasses where "appointmentId"=a.id and status='pago') then raise exception 'Repasse já registrado.'; end if;
 amount:=round(case when a."repassRule"->>'type'='percentage' then a."serviceValue"*coalesce((a."repassRule"->>'value')::numeric,0)/100
 else coalesce((a."repassRule"->>'value')::numeric,0) end,2);
 if amount<=0 then raise exception 'Este atendimento não possui valor de repasse.'; end if;
 insert into public.manual_payouts(appointment_id,clinic_id,amount,paid_date,actor_uid) values(a.id,actor."clinicId",amount,p_date::date,auth.uid());
 perform set_config('app.operational_write','yes',true);
 update public.financial_repasses set status='pago',"paidDate"=p_date where "appointmentId"=a.id and "clinicId"=actor."clinicId";
 perform public.operational_log('record_payout','appointments',a.id,a."patientId",jsonb_build_object('amount',amount,'paidDate',p_date));
end $$;

-- Reduce the legacy full-clinic snapshots for doctors, including the response
-- returned immediately after finalizing a consultation.
do $$ begin
 if to_regprocedure('public.manual_base_snapshot(boolean)') is null then
  alter function public.operational_snapshot(boolean) rename to manual_base_snapshot;
 end if;
 if to_regprocedure('public.manual_base_finish(text,text,jsonb)') is null then
  alter function public.operational_finish_consultation(text,text,jsonb) rename to manual_base_finish;
 end if;
end $$;
revoke all on function public.manual_base_snapshot(boolean),public.manual_base_finish(text,text,jsonb) from public,anon,authenticated;
create or replace function public.operational_snapshot(p_backup boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; s jsonb; t text; rows jsonb; hashes jsonb; begin
 a:=public.operational_actor(); s:=public.manual_base_snapshot(p_backup);
 if a.role='doctor' then
  select coalesce(jsonb_agg(v),'[]'),coalesce(jsonb_object_agg(v->>'id',(s->'versions'->'appointments')->>(v->>'id')),'{}')
  into rows,hashes from jsonb_array_elements(s->'tables'->'appointments') v where v->>'doctorId'=a.doctor_id;
  s:=jsonb_set(s,array['tables','appointments'],rows);s:=jsonb_set(s,array['versions','appointments'],hashes);
  for t in select jsonb_object_keys(s->'tables') loop
   if t like 'financial_%' then
    select coalesce(jsonb_agg(v),'[]'),coalesce(jsonb_object_agg(v->>'id',(s->'versions'->t)->>(v->>'id')),'{}') into rows,hashes
    from jsonb_array_elements(s->'tables'->t) v where t in ('financial_transactions','financial_repasses')
    and v->>'doctorId'=a.doctor_id and exists(select 1 from public.appointments ap where ap.id=v->>'appointmentId' and ap."clinicId"=a."clinicId" and ap.status='Finalizado');
    s:=jsonb_set(s,array['tables',t],rows); s:=jsonb_set(s,array['versions',t],hashes);
   end if;
  end loop;
 end if;
 if p_backup then
  for t in select unnest(array['manual_fee_profiles','manual_receipts','manual_payouts']) loop
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where clinic_id=$1',t) into rows using a."clinicId";
   s:=jsonb_set(s,array['tables',t],rows);
  end loop;
 end if;
 return s;
end $$;
create or replace function public.operational_finish_consultation(p_appointment_id text,p_expected text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; s jsonb; rows jsonb; hashes jsonb; t text; source_name text; begin
 a:=public.operational_actor(); s:=public.manual_base_finish(p_appointment_id,p_expected,p_input);
 if a.role='doctor' then
  foreach t in array array['transactions','repasses'] loop
   source_name:=case when t='transactions' then 'financial_transactions' else 'financial_repasses' end;
   select coalesce(jsonb_agg(v),'[]'),coalesce(jsonb_object_agg(v->>'id',(s->(case when t='transactions' then 'transactionVersions' else 'repassVersions' end))->>(v->>'id')),'{}')
   into rows,hashes from jsonb_array_elements(s->t) v where v->>'doctorId'=a.doctor_id
   and exists(select 1 from public.appointments ap where ap.id=v->>'appointmentId' and ap."clinicId"=a."clinicId" and ap.status='Finalizado');
   s:=jsonb_set(s,array[t],rows);
   s:=jsonb_set(s,array[case when t='transactions' then 'transactionVersions' else 'repassVersions' end],hashes);
  end loop;
 end if;
 return s;
end $$;
grant execute on function public.operational_snapshot(boolean),public.operational_finish_consultation(text,text,jsonb) to authenticated;
revoke all on function public.operational_snapshot(boolean),public.operational_finish_consultation(text,text,jsonb) from public,anon;

-- The public doctor directory exposes prices, never banking details.
create or replace view public.patient_portal_doctors as
 select d.id,d.name,d.crm,d.specialty,d."clinicId",d."availableTimes",f.price as "consultationPrice"
 from public.doctors d left join public.manual_fee_profiles f on f.doctor_id=d.id and f.clinic_id=d."clinicId"
 where d.active and d."clinicId"=public.patient_access_clinic_id()
 and exists(select 1 from public.patients p where p."authUserId"=auth.uid() and p."clinicId"=d."clinicId" and not p.archived);
grant select on public.patient_portal_doctors to authenticated;
revoke all on public.patient_portal_doctors from anon;

do $$ declare t text; condition text; begin
 foreach t in array array['financial_transactions','financial_categories','financial_cost_centers','financial_payment_methods',
 'financial_bank_accounts','financial_insurance_plans','financial_repasses','financial_cash_closures',
 'financial_reconciliations','financial_billing_records','financial_settings'] loop
  condition:='public.manual_billing_manager()';
  if t in ('financial_transactions','financial_repasses') then
   condition:=condition||' or exists(select 1 from public.users u join public.appointments a on a."doctorId"=u.doctor_id where u."authUserId"=auth.uid() and u.active and u.role=''doctor'' and a.id="appointmentId" and a."clinicId"=u."clinicId" and a.status=''Finalizado'')';
  end if;
  execute format('drop policy if exists manual_finance_boundary on public.%I',t);
  execute format('create policy manual_finance_boundary on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,condition,condition);
 end loop;
 drop policy if exists manual_doctor_agenda_boundary on public.appointments;
 create policy manual_doctor_agenda_boundary on public.appointments as restrictive for select to authenticated
 using (not exists(select 1 from public.users u where u."authUserId"=auth.uid() and u.active and u.role='doctor')
 or exists(select 1 from public.users u where u."authUserId"=auth.uid() and u.active and u.role='doctor'
 and u.doctor_id=appointments."doctorId" and u."clinicId"=appointments."clinicId"));
end $$;

-- Service-only mail authorization: validates a native JWT before this RPC.
create or replace function public.manual_billing_mail_claim(p_uid uuid,p_appointment text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare ap public.appointments; p public.patients; last_mail public.manual_payment_mail; begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='Serviço interno.'; end if;
 select * into ap from public.appointments where id=p_appointment for update;
 select * into p from public.patients where id=ap."patientId" and not archived;
 if ap.id is null or p.id is null or ap."paymentUrl" is null or ap.status in ('Cancelado','Faltou')
 or not (coalesce(p."authUserId"=p_uid,false) or exists(select 1 from public.users where "authUserId"=p_uid and active
 and "clinicId"=ap."clinicId" and role in ('admin','collaborator','secretaria','tesouraria')))
 then raise exception using errcode='42501',message='Envio não autorizado ou link não cadastrado.'; end if;
 if exists(select 1 from public.financial_transactions where "appointmentId"=ap.id and type='receita' and status='pago') then
  raise exception 'O pagamento já foi conferido. Não é necessário enviar cobrança.';
 end if;
 insert into public.manual_payment_mail(appointment_id) values(ap.id) on conflict do nothing;
 select * into last_mail from public.manual_payment_mail where appointment_id=ap.id for update;
 if last_mail.last_attempt>clock_timestamp()-interval '2 minutes' then raise exception 'Aguarde dois minutos antes de reenviar.'; end if;
 update public.manual_payment_mail set last_attempt=clock_timestamp(),attempts=attempts+1 where appointment_id=ap.id;
 return jsonb_build_object('email',p.email,'paymentUrl',ap."paymentUrl",'amount',ap."serviceValue",'date',ap.date,'time',ap.time);
end $$;
revoke all on function public.manual_billing_mail_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.manual_billing_mail_claim(uuid,text) to service_role;
do $$ declare f text; begin
 foreach f in array array['manual_billing_save_profile(jsonb,text)','manual_billing_snapshot()',
 'manual_billing_confirm(text,numeric,text,text,text)','manual_billing_payout(text,text,text)'] loop
  execute 'revoke all on function public.'||f||' from public,anon';
  execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
end $$;
notify pgrst,'reload schema';
-- Include the new private financial collections in the existing encrypted
-- export/typed restore, preserving compatibility with older backups.
do $$ declare src text; n text; begin
 foreach n in array array['operational_validate_restore(jsonb)','operational_restore_merge(jsonb)'] loop
  select pg_get_functiondef(to_regprocedure('public.'||n)) into src;
  if position('manual_fee_profiles' in src)=0 then
   if n like 'operational_validate%' then
    src:=replace(src,'''patient_access_enrollments'',''operational_audit'']',
      '''patient_access_enrollments'',''operational_audit'',''manual_fee_profiles'',''manual_receipts'',''manual_payouts'']');
    src:=replace(src,'if jsonb_typeof(rows) is distinct from ''array''',
      'if t in (''manual_fee_profiles'',''manual_receipts'',''manual_payouts'') and rows is null then rows:=''[]''::jsonb; end if; if jsonb_typeof(rows) is distinct from ''array''');
    src:=replace(src,'t in (''patient_access_enrollments'',''operational_audit'')',
      't in (''patient_access_enrollments'',''operational_audit'',''manual_fee_profiles'',''manual_receipts'',''manual_payouts'')');
   else
    src:=replace(src,'''financial_transactions'',''financial_repasses'',''financial_cash_closures'',''financial_reconciliations'',''financial_billing_records'',''financial_settings'']',
      '''financial_transactions'',''financial_repasses'',''financial_cash_closures'',''financial_reconciliations'',''financial_billing_records'',''financial_settings'',''manual_fee_profiles'',''manual_receipts'',''manual_payouts'']');
    src:=replace(src,'perform set_config(''app.operational_write'',''yes'',true);',
      'perform set_config(''app.operational_write'',''yes'',true); perform set_config(''app.manual_restore'',''yes'',true);');
    src:=replace(src,'keycol:=case when t=''financial_settings'' then ''clinicId'' else ''id'' end;',
      'keycol:=case when t=''financial_settings'' then ''clinicId'' when t=''manual_fee_profiles'' then ''doctor_id'' when t in (''manual_receipts'',''manual_payouts'') then ''appointment_id'' else ''id'' end;');
   end if;
   execute src;
  end if;
 end loop;
end $$;
commit;
