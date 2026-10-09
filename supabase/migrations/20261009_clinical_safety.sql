-- Additive migration: existing clinical records are preserved.
begin;

alter table public.evolucao_paciente add column if not exists appointment_id text;
create unique index if not exists evolution_one_per_appointment
  on public.evolucao_paciente (appointment_id) where appointment_id is not null;

create or replace function public.clinical_can_read_private(p_author text, p_clinic text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.users u
    where u."authUserId" = auth.uid() and u."clinicId" = p_clinic
      and (u.role = 'admin' or
        (u.role = 'doctor' and (u.id = p_author or u.doctor_id = p_author)))
  )
$$;
revoke all on function public.clinical_can_read_private(text,text) from public, anon;
grant execute on function public.clinical_can_read_private(text,text) to authenticated;

-- A browser cannot make a psychologist's record public by changing its label.
create or replace function public.clinical_evolution_is_private(
  p_author text, p_patient text, p_specialty text, p_password text
) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
  select coalesce(p_password,'') <> ''
    or translate(lower(coalesce(p_specialty,'')),'áéíóúâêîôûãõç','aeiouaeiouaoc') like '%psicol%'
    or lower(coalesce(p_specialty,'')) like '%psiquiatr%'
    or exists (
      select 1 from public.doctors d
      left join public.users u on u.doctor_id=d.id and u."clinicId"=d."clinicId"
      where (d.id=p_author or u.id=p_author)
        and d."clinicId"=(select p."clinicId" from public.patients p where p.id=p_patient)
        and (
          translate(lower(coalesce(d.specialty,'')),'áéíóúâêîôûãõç','aeiouaeiouaoc') like '%psicol%'
          or lower(coalesce(d.specialty,'')) like '%psiquiatr%'
        )
    );
$$;
revoke all on function public.clinical_evolution_is_private(text,text,text,text) from public,anon;
grant execute on function public.clinical_evolution_is_private(text,text,text,text) to authenticated;

-- Freeze sensitive classification on new records, including legacy/direct
-- inserts, so a later change to the clinician's profile cannot expose them.
create or replace function public.clinical_stamp_evolution_privacy()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare trusted_specialty text;
begin
  select d.specialty into trusted_specialty from public.users u
    join public.doctors d on d.id=u.doctor_id and d."clinicId"=u."clinicId"
    where u."authUserId"=auth.uid() and u.role in ('admin','doctor')
      and (u.id=new.medico_id or u.doctor_id=new.medico_id)
      and u."clinicId"=(select p."clinicId" from public.patients p where p.id=new.paciente_id)
    limit 1;
  if (
    translate(lower(coalesce(trusted_specialty,'')),'áéíóúâêîôûãõç','aeiouaeiouaoc') like '%psicol%'
    or lower(coalesce(trusted_specialty,'')) like '%psiquiatr%'
  ) and not (
    translate(lower(coalesce(new.especialidade,'')),'áéíóúâêîôûãõç','aeiouaeiouaoc') like '%psicol%'
    or lower(coalesce(new.especialidade,'')) like '%psiquiatr%'
  ) then
    new.especialidade := trusted_specialty;
  end if;
  return new;
end;
$$;
revoke all on function public.clinical_stamp_evolution_privacy() from public,anon;
drop trigger if exists clinical_stamp_evolution_privacy on public.evolucao_paciente;
create trigger clinical_stamp_evolution_privacy before insert on public.evolucao_paciente
for each row execute function public.clinical_stamp_evolution_privacy();

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('sigilous_notes','evolucao_paciente')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "private notes author or clinic admin read"
on public.sigilous_notes for select to authenticated
using (exists (select 1 from public.patients p
  where p.id = patient_id and public.clinical_can_read_private("authorId",p."clinicId")));

create policy "private notes authenticated author insert"
on public.sigilous_notes for insert to authenticated
with check (exists (select 1 from public.patients p join public.users u
  on u."clinicId" = p."clinicId"
  where p.id = patient_id and u."authUserId" = auth.uid()
    and u.id = "authorId" and u.role in ('admin','doctor')
    and u.name = "authorName"));

-- Notes are append-only for browser sessions; service operators retain access.
revoke update, delete on public.sigilous_notes from authenticated;
grant select, insert on public.sigilous_notes to authenticated;

create policy "clinical evolution scoped read"
on public.evolucao_paciente for select to authenticated
using (exists (select 1 from public.patients p
  where p.id = paciente_id and public.patient_access_is_staff(p."clinicId")
    and ((
      not public.clinical_evolution_is_private(medico_id,paciente_id,especialidade,senha_acesso)
    ) or public.clinical_can_read_private(medico_id,p."clinicId"))));

-- Preserve compatibility for older clients while the new version is published.
create policy "clinical evolution authenticated clinician insert"
on public.evolucao_paciente for insert to authenticated
with check (exists (select 1 from public.patients p join public.users u
  on u."clinicId" = p."clinicId"
  where p.id = paciente_id and u."authUserId" = auth.uid()
    and u.role in ('admin','doctor')
    and (u.id = medico_id or u.doctor_id = medico_id)));
revoke update, delete on public.evolucao_paciente from authenticated;
grant select, insert on public.evolucao_paciente to authenticated;

create or replace function public.finish_clinical_consultation(
  p_appointment_id text,
  p_complaint text,
  p_diagnosis text default '',
  p_conduct text default '',
  p_prescription text default '',
  p_specialty text default 'Clínica Geral',
  p_access_password text default ''
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  actor public.users%rowtype;
  appt public.appointments%rowtype;
  evolution public.evolucao_paciente%rowtype;
  annotations text;
  effective_specialty text;
begin
  select * into actor from public.users where "authUserId" = auth.uid();
  if actor.id is null or actor.role not in ('admin','doctor') then
    raise exception 'Somente um profissional autenticado pode finalizar atendimentos.' using errcode='42501';
  end if;
  if length(trim(coalesce(p_complaint,''))) = 0 then
    raise exception 'A evolução é obrigatória.';
  end if;
  select * into appt from public.appointments
    where id=p_appointment_id and "clinicId"=actor."clinicId" for update;
  if appt.id is null or not exists (
    select 1 from public.patients where id=appt."patientId" and "clinicId"=actor."clinicId"
  ) then raise exception 'Atendimento não localizado na clínica autorizada.' using errcode='42501'; end if;
  if actor.role <> 'admin' and appt."doctorId" is distinct from actor.doctor_id then
    raise exception 'Atendimento atribuído a outro profissional.' using errcode='42501';
  end if;
  select specialty into effective_specialty from public.doctors where id=appt."doctorId";
  if translate(lower(coalesce(effective_specialty,'')),'áéíóúâêîôûãõç','aeiouaeiouaoc') not like '%psicol%'
    and lower(coalesce(effective_specialty,'')) not like '%psiquiatr%' then
    effective_specialty := coalesce(nullif(p_specialty,''),'Clínica Geral');
  end if;
  annotations := 'QUEIXA/EVOLUÇÃO: ' || p_complaint || E'\n'
    || case when coalesce(p_diagnosis,'') <> '' then 'DIAGNÓSTICO (CID): ' || p_diagnosis || E'\n' else '' end
    || case when coalesce(p_conduct,'') <> '' then 'CONDUTA/PROCEDIMENTOS: ' || p_conduct || E'\n' else '' end
    || case when coalesce(p_prescription,'') <> '' then 'RECEITUÁRIO:' || E'\n' || p_prescription || E'\n' else '' end;
  select * into evolution from public.evolucao_paciente where appointment_id=appt.id;
  if evolution.id is not null then
    if evolution.anotacoes is distinct from annotations
      or evolution.especialidade is distinct from effective_specialty
      or coalesce(evolution.senha_acesso,'') is distinct from coalesce(p_access_password,'')
    then raise exception 'Este atendimento já foi gravado com outro conteúdo. Consulte o prontuário antes de corrigir.'; end if;
    return jsonb_build_object('appointment',to_jsonb(appt),'evolution',to_jsonb(evolution));
  end if;
  if appt.status in ('Finalizado','Cancelado','Faltou') then
    raise exception 'Este atendimento está encerrado ou cancelado. Nenhum novo registro foi criado.';
  end if;
  insert into public.evolucao_paciente
    (appointment_id,paciente_id,medico_id,medico_nome,especialidade,anotacoes,senha_acesso)
    values (appt.id,appt."patientId",coalesce(actor.doctor_id,actor.id),actor.name,
      effective_specialty,annotations,coalesce(p_access_password,''))
    returning * into evolution;
  update public.appointments set status='Finalizado' where id=appt.id returning * into appt;
  -- Canonical evolution stays in its own RLS-protected table. Never copy
  -- confidential content into the clinic-wide patient.history field.
  return jsonb_build_object('appointment',to_jsonb(appt),'evolution',to_jsonb(evolution));
end
$$;
revoke all on function public.finish_clinical_consultation(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.finish_clinical_consultation(text,text,text,text,text,text,text) to authenticated;

create or replace function public.clinical_protect_finalized_appointment()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if auth.uid() is not null and old.status='Finalizado'
    and (new.status,new."patientId",new."doctorId",new."date",new."time",new.type)
      is distinct from (old.status,old."patientId",old."doctorId",old."date",old."time",old.type) then
    raise exception using errcode='42501',
      message='Atendimento finalizado não pode ser reaberto ou ter sua identidade alterada pela agenda.';
  end if;
  return new;
end;
$$;
revoke all on function public.clinical_protect_finalized_appointment() from public,anon;
drop trigger if exists clinical_protect_finalized_appointment on public.appointments;
create trigger clinical_protect_finalized_appointment before update on public.appointments
for each row execute function public.clinical_protect_finalized_appointment();
notify pgrst, 'reload schema';
commit;
