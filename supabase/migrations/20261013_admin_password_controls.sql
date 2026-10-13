begin;
create table if not exists public.operational_password_epochs(
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 changed_at timestamptz not null
);
alter table public.operational_password_epochs enable row level security;
revoke all on public.operational_password_epochs from public,anon,authenticated;
grant all on public.operational_password_epochs to service_role;

-- Check the original session creation time, not JWT iat: refreshing an old
-- token must not bypass an administrator's password reset.
create or replace function public.operational_session_valid() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from auth.sessions s
  left join public.operational_password_epochs e on e.auth_user_id=s.user_id
  where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
   and (e.changed_at is null or s.created_at>=e.changed_at))
$$;
revoke all on function public.operational_session_valid() from public,anon;
grant execute on function public.operational_session_valid() to authenticated,service_role;

create or replace function public.current_user_clinic_id() returns text language sql stable security definer
set search_path=pg_catalog,public as $$
 select "clinicId" from public.users where "authUserId"=auth.uid() and active
 and role in ('admin','doctor','collaborator') and public.operational_session_valid() limit 1
$$;
create or replace function public.patient_access_is_staff(p_clinic_id text) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select public.operational_session_valid() and exists(select 1 from public.users
  where "authUserId"=auth.uid() and active and "clinicId"=p_clinic_id
   and role in ('admin','doctor','collaborator'))
$$;
create or replace function public.patient_access_is_clinic_admin(p_clinic_id text) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select public.operational_session_valid() and exists(select 1 from public.users
  where "authUserId"=auth.uid() and active and "clinicId"=p_clinic_id and role='admin')
$$;
create or replace function public.clinical_can_read_private(p_author text,p_clinic text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.operational_session_valid() and exists(select 1 from public.users u
  where u."authUserId"=auth.uid() and u.active and u."clinicId"=p_clinic
   and (u.role='admin' or (u.role='doctor' and (u.id=p_author or u.doctor_id=p_author))))
$$;
create or replace function public.operational_actor() returns public.users
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare a public.users; begin
 if not public.operational_session_valid() then
  raise exception using errcode='42501',message='Sessão encerrada. Entre novamente.';
 end if;
 select * into a from public.users where "authUserId"=auth.uid() and active
 and role in ('admin','doctor','collaborator');
 if a.id is null then raise exception using errcode='42501',message='Sessão da equipe não autorizada ou desativada.'; end if;
 return a;
end $$;
do $$
declare t text; begin
 foreach t in array array['users','patients','doctors','medications','appointments',
  'evolucao_paciente','sigilous_notes','financial_transactions','financial_repasses',
  'financial_categories','financial_cost_centers','financial_payment_methods','financial_bank_accounts',
  'financial_insurance_plans','financial_cash_closures','financial_reconciliations',
  'financial_billing_records','financial_settings','patient_access_enrollments'] loop
  execute format('drop policy if exists operational_active_session on public.%I',t);
  execute format('create policy operational_active_session on public.%I as restrictive for all to authenticated using (public.operational_session_valid()) with check (public.operational_session_valid())',t);
 end loop;
end $$;
-- These operations are internal to the authenticated Edge function.
-- Passwords never enter SQL, application profiles or the audit trail.
create or replace function public.operational_password_authorize(
 p_actor_uid uuid,p_kind text,p_id text,p_operation_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.users; target_uid uuid; resource_name text; operation_id uuid;
 previous public.operational_audit;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception using errcode='42501',message='Operação interna não autorizada.';
 end if;
 select * into a from public.users where "authUserId"=p_actor_uid and active and role='admin';
 if a.id is null then raise exception using errcode='42501',message='Administrador ativo necessário.'; end if;
 if p_kind='staff' then
  resource_name:='users';
  select "authUserId" into target_uid from public.users
   where id=p_id and "clinicId"=a."clinicId" and active;
 elsif p_kind='patient' then
  resource_name:='patients';
  select "authUserId" into target_uid from public.patients
   where id=p_id and "clinicId"=a."clinicId" and not archived;
 else raise exception using errcode='22023',message='Tipo de conta inválido.';
 end if;
 if target_uid is null then
  raise exception using errcode='22023',message='Conta ativa vinculada não encontrada. Envie o convite primeiro.';
 end if;
 -- An identity shared with another clinic or account type must be reviewed.
 if exists(select 1 from public.users where "authUserId"=target_uid
   and ("clinicId"<>a."clinicId" or p_kind='patient'))
 or exists(select 1 from public.patients where "authUserId"=target_uid
   and ("clinicId"<>a."clinicId" or p_kind='staff')) then
  raise exception using errcode='42501',message='Vínculo da conta precisa de revisão.';
 end if;
 perform pg_advisory_xact_lock(hashtext('password-change:'||p_actor_uid::text));
 if p_operation_id is not null then
  select * into previous from public.operational_audit where id=p_operation_id
   and actor_uid=p_actor_uid and action='password_change_requested'
   and resource=resource_name and record_id=p_id and clinic_id=a."clinicId"
   and occurred_at>clock_timestamp()-interval '2 minutes';
  if previous.id is null or previous.metadata->>'authUserId'<>target_uid::text
   or exists(select 1 from public.operational_audit where metadata->>'operationId'=p_operation_id::text) then
   raise exception using errcode='42501',message='Autorização expirada ou concluída.';
  end if;
  operation_id:=previous.id;
 else
  if (select count(*) from public.operational_audit where actor_uid=p_actor_uid
   and action='password_change_requested' and occurred_at>clock_timestamp()-interval '15 minutes')>=10 then
   raise exception using errcode='P0001',message='Limite de alterações atingido. Aguarde 15 minutos.';
  end if;
  insert into public.operational_audit(clinic_id,actor_uid,actor_name,action,resource,record_id,patient_id,metadata)
   values(a."clinicId",p_actor_uid,a.name,'password_change_requested',resource_name,p_id,
    case when p_kind='patient' then p_id else null end,jsonb_build_object('authUserId',target_uid))
   returning id into operation_id;
 end if;
 return jsonb_build_object('operationId',operation_id,'authUserId',target_uid);
end $$;

create or replace function public.operational_password_result(p_operation_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.operational_audit;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception using errcode='42501',message='Operação interna não autorizada.';
 end if;
 select * into original from public.operational_audit where id=p_operation_id and action='password_change_requested';
 if original.id is null then raise exception 'Operação não encontrada.'; end if;
 perform pg_advisory_xact_lock(hashtext('password-change:'||original.actor_uid::text));
 if exists(select 1 from public.operational_audit where metadata->>'operationId'=p_operation_id::text) then return; end if;
 if p_success then
  insert into public.operational_password_epochs(auth_user_id,changed_at)
   values((original.metadata->>'authUserId')::uuid,clock_timestamp())
   on conflict(auth_user_id) do update set changed_at=excluded.changed_at;
 end if;
 insert into public.operational_audit(clinic_id,actor_uid,actor_name,action,resource,record_id,patient_id,metadata)
 values(original.clinic_id,original.actor_uid,original.actor_name,
  case when p_success then 'password_changed' else 'password_change_failed' end,
  original.resource,original.record_id,original.patient_id,jsonb_build_object('operationId',p_operation_id));
end $$;
revoke all on function public.operational_password_authorize(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.operational_password_result(uuid,boolean) from public,anon,authenticated;
grant execute on function public.operational_password_authorize(uuid,text,text,uuid) to service_role;
grant execute on function public.operational_password_result(uuid,boolean) to service_role;
notify pgrst,'reload schema';
commit;
