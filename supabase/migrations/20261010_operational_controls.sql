begin;
alter table public.users add column if not exists active boolean not null default true;
alter table public.doctors add column if not exists active boolean not null default true;
alter table public.patients add column if not exists archived boolean not null default false;
alter table public.medications add column if not exists "clinicId" text;

create table if not exists public.operational_audit (
  id uuid primary key default gen_random_uuid(), clinic_id text not null,
  actor_uid uuid, actor_name text, action text not null, resource text,
  record_id text, patient_id text, occurred_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists operational_audit_clinic_time on public.operational_audit(clinic_id,occurred_at desc);
create table if not exists public.operational_vault_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_hex text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')
);
alter table public.operational_vault_keys add column if not exists admin_key_hex text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
alter table public.operational_vault_keys add column if not exists general_key_hex text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
alter table public.operational_audit enable row level security;
alter table public.operational_vault_keys enable row level security;
revoke all on public.operational_audit,public.operational_vault_keys from public,anon,authenticated;
grant all on public.operational_audit,public.operational_vault_keys to service_role;

create or replace function public.current_user_clinic_id() returns text language sql stable security definer
set search_path=pg_catalog,public as $$
 select "clinicId" from public.users where "authUserId"=auth.uid() and active
 and role in ('admin','doctor','collaborator') limit 1
$$;
create or replace function public.patient_access_is_staff(p_clinic_id text) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.users where "authUserId"=auth.uid() and active
 and "clinicId"=p_clinic_id and role in ('admin','doctor','collaborator'))
$$;
create or replace function public.patient_access_is_clinic_admin(p_clinic_id text) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.users where "authUserId"=auth.uid() and active and "clinicId"=p_clinic_id and role='admin')
$$;
create or replace function public.bind_current_user() returns text language plpgsql security definer
set search_path=pg_catalog,public as $$
declare c text; begin
 c:=public.current_user_clinic_id();
 if c is null then raise exception using errcode='42501',message='Acesso da equipe não está ativo.'; end if;
 return c; end $$;
create or replace function public.clinical_can_read_private(p_author text,p_clinic text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.users u where u."authUserId"=auth.uid() and u.active
 and u."clinicId"=p_clinic and (u.role='admin' or (u.role='doctor' and (u.id=p_author or u.doctor_id=p_author))))
$$;

create or replace function public.operational_actor() returns public.users
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare a public.users; begin
 select * into a from public.users where "authUserId"=auth.uid() and active
 and role in ('admin','doctor','collaborator');
 if a.id is null then raise exception using errcode='42501',message='Sessão da equipe não autorizada ou desativada.'; end if;
 return a; end $$;
revoke all on function public.operational_actor() from public,anon;
revoke all on function public.operational_actor() from authenticated;

create or replace function public.operational_log(p_action text,p_resource text,p_record text,p_patient text,p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; begin
 a:=public.operational_actor();
 insert into public.operational_audit(clinic_id,actor_uid,actor_name,action,resource,record_id,patient_id,metadata)
 values(a."clinicId",auth.uid(),a.name,p_action,p_resource,p_record,p_patient,p_metadata);
end $$;
revoke all on function public.operational_log(text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.operational_guard_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null then
  if exists(select 1 from public.users where "authUserId"=auth.uid()) then
   perform public.operational_actor();
   if current_setting('app.operational_write',true) is distinct from 'yes' then
    raise exception using errcode='42501',message='Use a gravação versionada; cópias antigas não podem gravar diretamente.';
   end if;
  elsif not (tg_table_name='appointments' and tg_op='INSERT') then
   raise exception using errcode='42501',message='Operação não autorizada.';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.operational_guard_mutation() from public,anon;

create or replace function public.operational_audit_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; c text; p text; who text; begin
 if tg_op='DELETE' then r:=to_jsonb(old); else r:=to_jsonb(new); end if;
 p:=coalesce(r->>'patientId',r->>'paciente_id');
 if tg_table_name='patients' then p:=r->>'id'; end if;
 c:=r->>'clinicId';
 if c is null and p is not null then select "clinicId" into c from public.patients where id=p; end if;
 if c is null then return null; end if;
 select name into who from public.users where "authUserId"=auth.uid() limit 1;
 insert into public.operational_audit(clinic_id,actor_uid,actor_name,action,resource,record_id,patient_id,metadata)
 values(c,auth.uid(),coalesce(who,case when auth.uid() is null then 'Serviço autorizado' else 'Paciente' end),
 lower(tg_op),tg_table_name,coalesce(r->>'id',c),p,jsonb_build_object('operation',tg_op));
 return null;
end $$;
revoke all on function public.operational_audit_mutation() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['patients','doctors','appointments','medications','users','sigilous_notes','evolucao_paciente',
 'financial_transactions','financial_categories','financial_cost_centers','financial_payment_methods','financial_bank_accounts',
 'financial_insurance_plans','financial_repasses','financial_cash_closures','financial_reconciliations','financial_billing_records','financial_settings'] loop
  execute format('drop trigger if exists operational_guard on public.%I',t);
  execute format('create trigger operational_guard before insert or update or delete on public.%I for each row execute function public.operational_guard_mutation()',t);
  execute format('drop trigger if exists operational_audit on public.%I',t);
  execute format('create trigger operational_audit after insert or update or delete on public.%I for each row execute function public.operational_audit_mutation()',t);
  execute format('revoke insert,update,delete on public.%I from authenticated',t);
  if t='appointments' then
   execute 'grant insert on public.appointments to authenticated';
  end if;
 end loop;
 -- Staff clinical reads must use audited RPCs. Patient portal RLS remains in force.
 foreach t in array array['patients','appointments','sigilous_notes','evolucao_paciente'] loop
  execute format('drop policy if exists operational_audited_reads on public.%I',t);
  execute format('create policy operational_audited_reads on public.%I as restrictive for select to authenticated using (public.current_user_clinic_id() is null)',t);
 end loop;
end $$;

create unique index if not exists operational_one_active_receipt on public.financial_transactions("clinicId","appointmentId")
where type='receita' and "appointmentId" is not null and status<>'cancelado';
create unique index if not exists operational_one_repass on public.financial_repasses("clinicId","appointmentId","doctorId")
where "appointmentId" is not null;

create or replace function public.operational_snapshot(p_backup boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; t text; rows jsonb; data jsonb:='{}'; versions jsonb:='{}'; k text; r jsonb; col_hash text; begin
 a:=public.operational_actor();
 if p_backup and a.role<>'admin' then raise exception using errcode='42501',message='Backup exige administrador.'; end if;
 foreach t in array array['patients','doctors','appointments','medications','users','sigilous_notes','evolucao_paciente',
 'financial_transactions','financial_categories','financial_cost_centers','financial_payment_methods','financial_bank_accounts',
 'financial_insurance_plans','financial_repasses','financial_cash_closures','financial_reconciliations','financial_billing_records','financial_settings'] loop
  if t='sigilous_notes' then
   select coalesce(jsonb_agg(to_jsonb(n)),'[]') into rows from public.sigilous_notes n join public.patients p on p.id=n."patientId"
    where p."clinicId"=a."clinicId" and (a.role='admin' or (a.role='doctor' and n."authorId"=a.id));
  elsif t='evolucao_paciente' then
   select coalesce(jsonb_agg(to_jsonb(e)),'[]') into rows from public.evolucao_paciente e join public.patients p on p.id=e.paciente_id
    where p."clinicId"=a."clinicId" and (not public.clinical_evolution_is_private(e.medico_id,e.paciente_id,e.especialidade,e.senha_acesso)
    or public.clinical_can_read_private(e.medico_id,a."clinicId"));
  elsif t='users' then
   select coalesce(jsonb_agg(to_jsonb(u)-'password'-'senhaAcesso'),'[]') into rows from public.users u where u."clinicId"=a."clinicId";
  elsif t='medications' then
   select coalesce(jsonb_agg(to_jsonb(m)),'[]') into rows from public.medications m where m."clinicId" is null or m."clinicId"=a."clinicId";
  elsif t='patients' and a.role<>'admin' and not p_backup then
   select coalesce(jsonb_agg((to_jsonb(p)-'history'-'files')||jsonb_build_object('history','','files',
    coalesce((select jsonb_agg(f) from jsonb_array_elements(coalesce(p.files,'[]')) f where a.role='doctor' and f->>'authorId'=a.id),'[]'::jsonb))),'[]')
   into rows from public.patients p where p."clinicId"=a."clinicId" and not p.archived;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where x."clinicId"=$1 %s',
     t,case when t='patients' and not p_backup then 'and not archived' else '' end) into rows using a."clinicId";
  end if;
  data:=data||jsonb_build_object(t,rows);
  versions:=versions||jsonb_build_object(t,'{}'::jsonb);
  for r in select value from jsonb_array_elements(rows) loop
   k:=coalesce(r->>'id',r->>'clinicId');
   if t='patients' then
    select md5(to_jsonb(p)::text) into col_hash from public.patients p where id=k;
    versions:=jsonb_set(versions,array[t,k],to_jsonb(col_hash));
   else
    versions:=jsonb_set(versions,array[t,k],to_jsonb(md5(r::text)));
   end if;
  end loop;
 end loop;
 insert into public.operational_audit(clinic_id,actor_uid,actor_name,action,resource,record_id,patient_id)
 select a."clinicId",auth.uid(),a.name,case when p_backup then 'backup_export' else 'read_snapshot' end,'patients',p.id,p.id
 from public.patients p where p."clinicId"=a."clinicId" and (p_backup or not p.archived);
 if p_backup then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from public.operational_audit x where clinic_id=a."clinicId";
  data:=data||jsonb_build_object('operational_audit',rows);
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from public.patient_access_enrollments x where clinic_id=a."clinicId";
  data:=data||jsonb_build_object('patient_access_enrollments',rows);
 end if;
 return jsonb_build_object('schemaVersion',1,'clinicId',a."clinicId",'createdAt',clock_timestamp(),'tables',data,'versions',versions);
end $$;
revoke all on function public.operational_snapshot(boolean) from public,anon;
grant execute on function public.operational_snapshot(boolean) to authenticated;

create or replace function public.operational_history(p_patient_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; e jsonb; n jsonb; begin
 a:=public.operational_actor();
 if not exists(select 1 from public.patients where id=p_patient_id and "clinicId"=a."clinicId") then raise exception using errcode='42501',message='Paciente não autorizado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by data_criacao desc),'[]') into e from public.evolucao_paciente x where paciente_id=p_patient_id
 and (not public.clinical_evolution_is_private(medico_id,paciente_id,especialidade,senha_acesso) or public.clinical_can_read_private(medico_id,a."clinicId"));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into n from public.sigilous_notes x where "patientId"=p_patient_id
 and (a.role='admin' or (a.role='doctor' and "authorId"=a.id));
 perform public.operational_log('read_history','patients',p_patient_id,p_patient_id);
 return jsonb_build_object('evolutions',e,'notes',n);
end $$;
revoke all on function public.operational_history(text) from public,anon;
grant execute on function public.operational_history(text) to authenticated;

create or replace function public.operational_sync(p_changes jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; ch jsonb; t text; k text; keycol text; oldrow jsonb; newrow jsonb; col text; exposed jsonb;
 cols text; vals text; setters text; result jsonb:='[]'; ap public.appointments; begin
 a:=public.operational_actor();
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>500 then raise exception 'Lote inválido.'; end if;
 perform set_config('app.operational_write','yes',true);
 -- Sorted locks prevent two batches taking row locks in opposite order.
 for ch in select value from jsonb_array_elements(p_changes) order by value->>'table',value->>'id' loop
  t:=ch->>'table'; k:=ch->>'id'; keycol:=case when t='financial_settings' then 'clinicId' else 'id' end;
  if not t=any(array['patients','doctors','appointments','medications','financial_transactions','financial_categories',
   'financial_cost_centers','financial_payment_methods','financial_bank_accounts','financial_insurance_plans','financial_repasses',
   'financial_cash_closures','financial_reconciliations','financial_billing_records','financial_settings']) then raise exception using errcode='42501',message='Tabela não autorizada.'; end if;
  if k is null or length(k)>160 then raise exception 'Identificador inválido.'; end if;
  if t='doctors' and a.role<>'admin' then raise exception using errcode='42501',message='Gestão de médicos exige administrador.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(t||':'||k,0));
  execute format('select to_jsonb(x) from public.%I x where x.%I=$1 for update',t,keycol) into oldrow using k;
  if oldrow is not null and oldrow->>'clinicId' is distinct from a."clinicId" then raise exception using errcode='42501',message='Registro fora da clínica ou catálogo global somente leitura.'; end if;
  if a.role='doctor' and t='appointments' and oldrow is not null and oldrow->>'doctorId' is distinct from a.doctor_id then
   raise exception using errcode='42501',message='Agendamento de outro médico não pode ser alterado.';
  end if;
  if a.role='doctor' and t like 'financial_%' and (ch->'row'='null'::jsonb or oldrow is not null) then
   raise exception using errcode='42501',message='Alteração ou exclusão financeira exige administração ou recepção.';
  end if;
  if (oldrow is null and ch->>'expected' is not null) or
     (oldrow is not null and md5(oldrow::text) is distinct from ch->>'expected') then
   raise exception using errcode='PT409',message='Conflito: outro acesso alterou este registro. Recarregue e revise antes de gravar.';
  end if;
  if ch->'row'='null'::jsonb then
   if oldrow is null then continue; end if;
   if t='patients' then
    if a.role='doctor' then raise exception using errcode='42501',message='Arquivamento de pacientes exige administração ou recepção.'; end if;
    if exists(select 1 from public.appointments where "patientId"=k and status in ('Agendado','Confirmado','Em atendimento')) then
     raise exception 'Paciente com atendimento em aberto não pode ser arquivado.';
    end if;
    update public.patients set archived=true where id=k;
   else
    if t='doctors' and (exists(select 1 from public.appointments where "doctorId"=k)
     or exists(select 1 from public.users where doctor_id=k)) then raise exception 'Profissional com histórico ou acesso deve ser desativado, não excluído.'; end if;
    if t='appointments' and (oldrow->>'status'='Finalizado' or exists(select 1 from public.evolucao_paciente where appointment_id=k)) then raise exception 'Atendimento clínico não pode ser excluído.'; end if;
    if t='financial_transactions' and oldrow->>'status'='pago' then raise exception 'Recebimento pago exige estorno rastreável, não exclusão.'; end if;
    execute format('delete from public.%I where %I=$1',t,keycol) using k;
   end if;
   result:=result||jsonb_build_array(jsonb_build_object('table',t,'id',k,'deleted',true));
   continue;
  end if;
  newrow:=coalesce(oldrow,'{}'::jsonb)||(ch->'row')||jsonb_build_object(keycol,k,'clinicId',a."clinicId");
  if t='patients' and ch->'row' ?| array['authUserId','pendingAuthUserId','portalEnrollmentPending','patientPasswordSet','patientPassword','history'] then raise exception 'Campos clínicos ou de identidade exigem rotina específica.'; end if;
  if t='patients' and a.role<>'admin' and ch->'row' ? 'files' then
   if a.role<>'doctor' then raise exception using errcode='42501',message='Anexos clínicos exigem profissional clínico.'; end if;
   newrow:=jsonb_set(newrow,'{files}',coalesce(oldrow->'files','[]')||
    coalesce((select jsonb_agg(f||jsonb_build_object('authorId',a.id,'restricted',true))
    from jsonb_array_elements(ch->'row'->'files') f where not exists
    (select 1 from jsonb_array_elements(coalesce(oldrow->'files','[]')) oldf where oldf->>'id'=f->>'id')),'[]'::jsonb));
  end if;
  if t='appointments' then
   if not exists(select 1 from public.patients where id=newrow->>'patientId' and "clinicId"=a."clinicId" and not archived)
    or not exists(select 1 from public.doctors where id=newrow->>'doctorId' and "clinicId"=a."clinicId") then raise exception 'Vínculos do agendamento inválidos.'; end if;
   if newrow->>'status'='Finalizado' and coalesce(oldrow->>'status','')<>'Finalizado' then raise exception 'Finalize pela sala de atendimento para gravar a evolução.'; end if;
   if a.role='doctor' and (newrow->>'doctorId' is distinct from a.doctor_id
    or (oldrow is not null and oldrow->>'doctorId' is distinct from a.doctor_id)) then raise exception using errcode='42501',message='Agendamento de outro médico não pode ser alterado.'; end if;
  end if;
  if a.role='doctor' and t like 'financial_%' then
   if t not in ('financial_transactions','financial_repasses') or oldrow is not null then raise exception using errcode='42501',message='Operação financeira não autorizada para este perfil.'; end if;
   select * into ap from public.appointments where id=newrow->>'appointmentId' and "clinicId"=a."clinicId" and "doctorId"=a.doctor_id;
   if ap.id is null or newrow->>'patientId' is distinct from ap."patientId" or newrow->>'doctorId' is distinct from ap."doctorId"
   then raise exception using errcode='42501',message='Vínculo financeiro inválido.'; end if;
   if t='financial_transactions' and (k<>'ft-appt-'||ap.id or newrow->>'type'<>'receita' or newrow->>'status'<>'pendente'
    or (newrow->>'amount')::numeric is distinct from ap."serviceValue") then raise exception using errcode='42501',message='Cobrança automática inválida.'; end if;
   if t='financial_repasses' and (k<>'rp-appt-'||ap.id or newrow->>'status'<>'previsto'
    or (newrow->>'amount')::numeric is distinct from round(case when ap."repassRule"->>'type'='percentage'
     then ap."serviceValue"*(ap."repassRule"->>'value')::numeric/100 else (ap."repassRule"->>'value')::numeric end,2))
   then raise exception using errcode='42501',message='Repasse automático inválido.'; end if;
  end if;
  cols:=''; vals:=''; setters:='';
  for col in select jsonb_object_keys(ch->'row') union select keycol union select 'clinicId' loop
   if not exists(select 1 from pg_attribute where attrelid=('public.'||t)::regclass and attname=col and attnum>0 and not attisdropped and attgenerated='') then raise exception 'Campo não autorizado.'; end if;
   cols:=cols||case when cols='' then '' else ',' end||quote_ident(col);
   vals:=vals||case when vals='' then '' else ',' end||format('(jsonb_populate_record(null::public.%I,$1)).%I',t,col);
   if col<>keycol then setters:=setters||case when setters='' then '' else ',' end||format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',col,t,col); end if;
  end loop;
  if oldrow is null then
   execute format('insert into public.%I(%s) select %s returning to_jsonb(%I.*)',t,cols,vals,t) into newrow using newrow;
  else
   execute format('update public.%I set %s where %I=$2 returning to_jsonb(%I.*)',t,setters,keycol,t) into newrow using newrow,k;
  end if;
  exposed:=newrow;
  if t='patients' and a.role<>'admin' then
   exposed:=(newrow-'history'-'files')||jsonb_build_object('history','','files',
    coalesce((select jsonb_agg(f) from jsonb_array_elements(coalesce(newrow->'files','[]')) f where a.role='doctor' and f->>'authorId'=a.id),'[]'::jsonb));
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('table',t,'id',k,'row',exposed,'version',md5(newrow::text)));
 end loop;
 return result;
end $$;
revoke all on function public.operational_sync(jsonb) from public,anon;
grant execute on function public.operational_sync(jsonb) to authenticated;

create or replace function public.operational_finish_consultation(p_appointment_id text,p_expected text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; ap public.appointments; saved jsonb; tx jsonb; rp jsonb; fv jsonb; rule_amount numeric; begin
 a:=public.operational_actor(); perform set_config('app.operational_write','yes',true);
 select * into ap from public.appointments where id=p_appointment_id and "clinicId"=a."clinicId" for update;
 if ap.id is null then raise exception using errcode='42501',message='Atendimento não autorizado.'; end if;
 if not exists(select 1 from public.evolucao_paciente where appointment_id=ap.id) and
   md5(to_jsonb(ap)::text) is distinct from p_expected then raise exception using errcode='PT409',message='O agendamento mudou em outro computador. Revise paciente e atendimento antes de finalizar.'; end if;
 saved:=public.finish_clinical_consultation(ap.id,p_input->>'complaint',coalesce(p_input->>'diagnosis',''),
 coalesce(p_input->>'conduct',''),coalesce(p_input->>'prescription',''),coalesce(p_input->>'especialidade','Clínica Geral'),coalesce(p_input->>'senha_acesso',''));
 if coalesce(ap."serviceValue",0)>0 then
  insert into public.financial_transactions(id,"clinicId",type,status,description,amount,"dueDate","patientId","doctorId","appointmentId","createdAt")
  values('ft-appt-'||ap.id,a."clinicId",'receita','pendente','Atendimento '||ap.id,ap."serviceValue",ap.date,ap."patientId",ap."doctorId",ap.id,clock_timestamp()::text)
  on conflict do nothing;
  rule_amount:=case when ap."repassRule"->>'type'='percentage'
   then ap."serviceValue"*coalesce((ap."repassRule"->>'value')::numeric,0)/100
   else coalesce((ap."repassRule"->>'value')::numeric,0) end;
  if rule_amount>0 then
   insert into public.financial_repasses(id,"clinicId","doctorId","patientId","appointmentId","referenceMonth","grossAmount",amount,status,"dueDate")
   values('rp-appt-'||ap.id,a."clinicId",ap."doctorId",ap."patientId",ap.id,left(ap.date,7),ap."serviceValue",round(rule_amount,2),'previsto',ap.date)
   on conflict do nothing;
  end if;
 end if;
 select * into ap from public.appointments where id=p_appointment_id;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'),coalesce(jsonb_object_agg(id,md5(to_jsonb(x)::text)),'{}') into tx,fv
 from public.financial_transactions x where "clinicId"=a."clinicId";
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rp from public.financial_repasses x where "clinicId"=a."clinicId";
 return saved||jsonb_build_object('version',md5(to_jsonb(ap)::text),'transactions',tx,'repasses',rp,'transactionVersions',fv,
 'repassVersions',(select coalesce(jsonb_object_agg(id,md5(to_jsonb(x)::text)),'{}') from public.financial_repasses x where "clinicId"=a."clinicId"));
end $$;
revoke all on function public.finish_clinical_consultation(text,text,text,text,text,text,text) from authenticated;
revoke all on function public.operational_finish_consultation(text,text,jsonb) from public,anon;
grant execute on function public.operational_finish_consultation(text,text,jsonb) to authenticated;

create or replace function public.operational_note(p_id text,p_patient_id text,p_text text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; n public.sigilous_notes; begin
 a:=public.operational_actor();
 if a.role not in ('admin','doctor') or length(trim(p_text))=0 or length(p_text)>100000 then raise exception using errcode='42501',message='Nota não autorizada ou inválida.'; end if;
 if not exists(select 1 from public.patients where id=p_patient_id and "clinicId"=a."clinicId") then raise exception using errcode='42501',message='Paciente não autorizado.'; end if;
 perform set_config('app.operational_write','yes',true);
 insert into public.sigilous_notes(id,"patientId","authorId","authorName",note,"createdAt")
 values(p_id,p_patient_id,a.id,a.name,p_text,clock_timestamp()::text) on conflict do nothing;
 select * into n from public.sigilous_notes where id=p_id and "authorId"=a.id and "patientId"=p_patient_id;
 if n.id is null or n.note<>p_text then raise exception 'Identificador da nota em conflito.'; end if;
 return to_jsonb(n);
end $$;
revoke all on function public.operational_note(text,text,text) from public,anon;
grant execute on function public.operational_note(text,text,text) to authenticated;

create or replace function public.operational_vault_key() returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare k text; a public.users; begin
 a:=public.operational_actor();
 if a.role not in ('admin','doctor') then raise exception using errcode='42501',message='Cofre clínico exige profissional clínico ou administrador.'; end if;
 insert into public.operational_vault_keys(user_id) values(auth.uid()) on conflict do nothing;
 select key_hex into k from public.operational_vault_keys where user_id=auth.uid();
 return k;
end $$;
revoke all on function public.operational_vault_key() from public,anon;
grant execute on function public.operational_vault_key() to authenticated;

create or replace function public.operational_admin_vault_key() returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; k text; begin
 a:=public.operational_actor(); if a.role<>'admin' then raise exception using errcode='42501',message='Cofre administrativo restrito.'; end if;
 insert into public.operational_vault_keys(user_id) values(auth.uid()) on conflict do nothing;
 select admin_key_hex into k from public.operational_vault_keys where user_id=auth.uid();return k;
end $$;
create or replace function public.operational_general_vault_key() returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare k text; begin
 perform public.operational_actor();
 insert into public.operational_vault_keys(user_id) values(auth.uid()) on conflict do nothing;
 select general_key_hex into k from public.operational_vault_keys where user_id=auth.uid();return k;
end $$;
revoke all on function public.operational_admin_vault_key(),public.operational_general_vault_key() from public,anon;
grant execute on function public.operational_admin_vault_key(),public.operational_general_vault_key() to authenticated;

create or replace function public.operational_staff_change(p_id text,p_active boolean,p_role text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; u public.users; begin
 a:=public.operational_actor();
 if a.role<>'admin' then raise exception using errcode='42501',message='Exige administrador.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a."clinicId"||':staff',0));
 a:=public.operational_actor();
 select * into u from public.users where id=p_id and "clinicId"=a."clinicId" for update;
 if u.id is null or p_role not in ('admin','doctor','collaborator') then raise exception 'Perfil inválido.'; end if;
 if u.id=a.id and not p_active then raise exception 'Não é permitido desativar o próprio acesso.'; end if;
 if u.role='admin' and u.active and (not p_active or p_role<>'admin')
 and (select count(*) from public.users u join auth.users au on au.id=u."authUserId"
 where u."clinicId"=a."clinicId" and u.role='admin' and u.active and au.email_confirmed_at is not null)<=1 then raise exception 'A clínica precisa manter um administrador ativo e confirmado.'; end if;
 if p_role='doctor' and u.doctor_id is null then raise exception 'Vincule um cadastro de médico antes de atribuir esse perfil.'; end if;
 perform set_config('app.operational_write','yes',true);
 perform set_config('app.operational_staff_write','yes',true);
 update public.users set active=p_active,role=p_role where id=p_id returning * into u;
 if u.doctor_id is not null then
  update public.doctors set active=exists(select 1 from public.users where doctor_id=u.doctor_id and active and role in ('doctor','admin')) where id=u.doctor_id;
 end if;
 return to_jsonb(u)-'password'-'senhaAcesso';
end $$;
revoke all on function public.operational_staff_change(text,boolean,text) from public,anon;
grant execute on function public.operational_staff_change(text,boolean,text) to authenticated;

create or replace function public.guard_staff_user_binding_fields() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' and current_setting('app.operational_staff_write',true) is distinct from 'yes' then
  if (tg_op='INSERT' and new."authUserId" is not null) or
   (tg_op='UPDATE' and (new."authUserId" is distinct from old."authUserId" or new."clinicId" is distinct from old."clinicId" or new.role is distinct from old.role))
  then raise exception 'Vínculos de acesso só podem ser alterados por operação administrativa autenticada.'; end if;
  if new."clinicId" is distinct from public.current_user_clinic_id() then raise exception 'Clínica não autorizada.'; end if;
 end if;
 return new;
end $$;

create or replace function public.operational_audit_list(p_patient_id text default null,p_before timestamptz default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; r jsonb; begin
 a:=public.operational_actor(); if a.role<>'admin' then raise exception using errcode='42501',message='Auditoria exige administrador.'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into r from
 (select * from public.operational_audit where clinic_id=a."clinicId" and (p_patient_id is null or patient_id=p_patient_id)
 and (p_before is null or occurred_at<p_before) order by occurred_at desc,id desc limit 200) x;
 return r; end $$;
revoke all on function public.operational_audit_list(text,timestamptz) from public,anon;
grant execute on function public.operational_audit_list(text,timestamptz) to authenticated;

create or replace function public.operational_validate_restore(p_backup jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; t text; rows jsonb; cols text; stage_name text; n bigint; counts jsonb:='{}'; begin
 a:=public.operational_actor();
 if a.role<>'admin' or p_backup->>'clinicId' is distinct from a."clinicId" or p_backup->>'schemaVersion'<>'1' then
 raise exception using errcode='42501',message='Backup de outra clínica ou versão não autorizada.'; end if;
 foreach t in array array['patients','doctors','appointments','medications','users','sigilous_notes','evolucao_paciente',
 'financial_transactions','financial_categories','financial_cost_centers','financial_payment_methods','financial_bank_accounts',
 'financial_insurance_plans','financial_repasses','financial_cash_closures','financial_reconciliations','financial_billing_records','financial_settings',
 'patient_access_enrollments','operational_audit'] loop
  rows:=p_backup->'tables'->t;
  if jsonb_typeof(rows) is distinct from 'array' then raise exception 'Backup incompleto: falta uma coleção obrigatória.'; end if;
  if exists(select 1 from jsonb_array_elements(rows) r where
   case when t in ('patient_access_enrollments','operational_audit') then r->>'clinic_id' is distinct from a."clinicId"
   when t in ('sigilous_notes','evolucao_paciente') then false
   when t='medications' then r->>'clinicId' is not null and r->>'clinicId'<>a."clinicId"
   else r->>'clinicId' is distinct from a."clinicId" end) then raise exception 'Backup contém dados de outra clínica.'; end if;
  stage_name:='restore_'||t;
  execute format('create temporary table %I (like public.%I including defaults including generated including constraints including indexes) on commit drop',stage_name,t);
  select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute
   where attrelid=('public.'||t)::regclass and attnum>0 and not attisdropped and attgenerated=''
   and not attname=any(array['password','senhaAcesso']);
  execute format('insert into pg_temp.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',stage_name,cols,cols,t) using rows;
  execute format('select count(*) from pg_temp.%I',stage_name) into n;
  if n<>jsonb_array_length(rows) then raise exception 'Contagem da restauração divergiu.'; end if;
  counts:=counts||jsonb_build_object(t,n);
 end loop;
 if exists(select 1 from pg_temp.restore_appointments x
  where not exists(select 1 from pg_temp.restore_patients p where p.id=x."patientId")
   or not exists(select 1 from pg_temp.restore_doctors d where d.id=x."doctorId"))
 or exists(select 1 from pg_temp.restore_evolucao_paciente e where not exists(select 1 from pg_temp.restore_patients p where p.id=e.paciente_id))
 or exists(select 1 from pg_temp.restore_sigilous_notes n where not exists(select 1 from pg_temp.restore_patients p where p.id=n."patientId"))
 then raise exception 'Backup tem referências clínicas incompletas.'; end if;
 perform public.operational_log('restore_test','backup',null,null,counts);
 return jsonb_build_object('validated',true,'counts',counts,'mode','isolated_typed_tables','productionRowsChanged',false);
end $$;
revoke all on function public.operational_validate_restore(jsonb) from public,anon;
grant execute on function public.operational_validate_restore(jsonb) to authenticated;

-- Non-destructive recovery: existing data is never overwritten by an old copy.
-- Account credentials remain managed by Supabase Auth, never imported from JSON.
create or replace function public.operational_restore_merge(p_backup jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; t text; rows jsonb; r jsonb; oldrow jsonb; keycol text; k text; cols text; inserted bigint:=0; begin
 a:=public.operational_actor(); perform public.operational_validate_restore(p_backup);
 perform pg_advisory_xact_lock(hashtextextended(a."clinicId"||':restore',0));
 perform set_config('app.operational_write','yes',true);
 foreach t in array array['doctors','medications','patients','appointments','sigilous_notes','evolucao_paciente',
 'financial_categories','financial_cost_centers','financial_payment_methods','financial_bank_accounts','financial_insurance_plans',
 'financial_transactions','financial_repasses','financial_cash_closures','financial_reconciliations','financial_billing_records','financial_settings'] loop
  rows:=p_backup->'tables'->t; keycol:=case when t='financial_settings' then 'clinicId' else 'id' end;
  select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid=('public.'||t)::regclass
   and attnum>0 and not attisdropped and attgenerated='';
  for r in select value from jsonb_array_elements(rows) loop
   k:=r->>keycol; execute format('select to_jsonb(x) from public.%I x where %I=$1 for update',t,keycol) into oldrow using k;
   if oldrow is not null then
    if oldrow<>r then raise exception using errcode='PT409',message='Restauração suspensa: existem registros diferentes. Nenhum dado atual será sobrescrito.'; end if;
   else
    if t='medications' and r->>'clinicId' is null then raise exception 'Catálogo global exige restauração administrativa do provedor.'; end if;
    if t='patients' and r->>'authUserId' is not null then
     if not exists(select 1 from auth.users where id=(r->>'authUserId')::uuid and lower(email)=lower(r->>'email'))
      or exists(select 1 from public.users where "authUserId"=(r->>'authUserId')::uuid)
      or exists(select 1 from public.patients where "authUserId"=(r->>'authUserId')::uuid and "clinicId"<>a."clinicId")
     then raise exception 'Vínculo de paciente não existe ou precisa ser revisado no provedor de autenticação.'; end if;
    end if;
    perform set_config('app.operational_restore_write','yes',true);
    execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1)',t,cols,cols,t) using r;
    perform set_config('app.operational_restore_write','no',true);
    inserted:=inserted+1;
   end if;
  end loop;
 end loop;
 -- Rebuild patient access proof only for verified, same-project identities.
 for r in select value from jsonb_array_elements(p_backup->'tables'->'patient_access_enrollments') loop
  if not exists(select 1 from public.patient_access_enrollments where patient_id=r->>'patient_id') then
   if not exists(select 1 from public.patients where id=r->>'patient_id' and "clinicId"=a."clinicId"
    and "authUserId"=(r->>'auth_user_id')::uuid) then raise exception 'Vínculo de acesso do backup não corresponde ao paciente.'; end if;
   perform set_config('app.operational_restore_write','yes',true);
   select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid='public.patient_access_enrollments'::regclass and attnum>0 and not attisdropped and attgenerated='';
   execute format('insert into public.patient_access_enrollments(%s) select %s from jsonb_populate_record(null::public.patient_access_enrollments,$1)',cols,cols) using r;
   perform set_config('app.operational_restore_write','no',true);
  end if;
 end loop;
 perform public.operational_log('restore_merge','backup',null,null,jsonb_build_object('inserted',inserted,'overwritten',0));
 return jsonb_build_object('restored',true,'inserted',inserted,'overwritten',0);
end $$;
revoke all on function public.operational_restore_merge(jsonb) from public,anon;
grant execute on function public.operational_restore_merge(jsonb) to authenticated;

-- Narrow exception for the admin-only, validated, insert-only recovery above.
-- Existing identities remain immutable, including during a restore.
create or replace function public.guard_patient_access_identity_fields() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then
  if tg_op='INSERT' and (new."authUserId" is not null or new."portalEnrollmentPending")
   and not (current_setting('app.operational_restore_write',true)='yes'
     and public.patient_access_is_clinic_admin(new."clinicId")) then raise exception 'Identidade exige operação confiável.'; end if;
  if tg_op='UPDATE' then
   if new."authUserId" is distinct from old."authUserId" or new."clinicId" is distinct from old."clinicId"
    or new."portalEnrollmentPending" is distinct from old."portalEnrollmentPending" then raise exception 'Vínculos de identidade são imutáveis.'; end if;
   if (old."authUserId" is not null or exists(select 1 from public.patient_access_enrollments where patient_id=old.id))
    and (new.cpf is distinct from old.cpf or new.email is distinct from old.email) then raise exception 'CPF e e-mail vinculados não podem ser alterados.'; end if;
  end if;
 end if;
 return new;
end $$;

create or replace function public.guard_patient_access_enrollment_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then
  if current_setting('app.operational_restore_write',true) is distinct from 'yes' or tg_op<>'INSERT'
   or not public.patient_access_is_clinic_admin(new.clinic_id) then raise exception 'Prova de acesso exige operação confiável.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

-- Native patient portal keeps its restricted identity/booking API; it must not
-- receive clinician-only historical text or another person's credentials.
revoke select on public.users from authenticated;
grant select(id,username,name,role,doctor_id,"clinicId","authUserId",active) on public.users to authenticated;
revoke select on public.patients from authenticated;
grant select(id,name,"birthDate",gender,cpf,email,phone,address,"healthInsurance","bloodType",allergies,"preExistingConditions",
 "primaryDoctorId","clinicId","authUserId","portalEnrollmentPending") on public.patients to authenticated;
notify pgrst,'reload schema';
commit;
