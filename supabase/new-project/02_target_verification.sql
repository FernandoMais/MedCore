-- READ-ONLY verification for the NEW target after supabase_new_project.sql and
-- an authorized data-only import. Run against the target project.
-- No patient/staff names, identifiers, CPF, emails, financial values, files,
-- notes, Auth UUIDs, or nonce material are returned.
begin transaction read only;

-- Expected target relations: missing entries are visible without querying data.
with expected_relations(relation_name) as (
  values
    ('users'), ('doctors'), ('patients'), ('appointments'), ('medications'),
    ('evolucao_paciente'), ('sigilous_notes'),
    ('financial_transactions'), ('financial_categories'), ('financial_cost_centers'),
    ('financial_payment_methods'), ('financial_bank_accounts'), ('financial_insurance_plans'),
    ('financial_repasses'), ('financial_cash_closures'), ('financial_reconciliations'),
    ('financial_billing_records'), ('financial_settings'),
    ('patient_access_enrollments'), ('patient_access_rate_limits'),
    ('patient_portal_doctors')
)
select e.relation_name,
       case when c.oid is null then 'MISSING' else 'present' end as status,
       case when c.relkind = 'v' then 'view' when c.relkind = 'p' then 'partitioned table'
            when c.relkind = 'r' then 'table' else coalesce(c.relkind::text, 'absent') end as relation_kind
from expected_relations e
left join pg_class c
  on c.relname = e.relation_name
 and c.relnamespace = (select oid from pg_namespace where nspname = 'public')
order by e.relation_name;

-- Any target public relation outside the reviewed inventory requires review.
with expected_relations(relation_name) as (
  values
    ('users'), ('doctors'), ('patients'), ('appointments'), ('medications'),
    ('evolucao_paciente'), ('sigilous_notes'),
    ('financial_transactions'), ('financial_categories'), ('financial_cost_centers'),
    ('financial_payment_methods'), ('financial_bank_accounts'), ('financial_insurance_plans'),
    ('financial_repasses'), ('financial_cash_closures'), ('financial_reconciliations'),
    ('financial_billing_records'), ('financial_settings'),
    ('patient_access_enrollments'), ('patient_access_rate_limits'),
    ('patient_portal_doctors')
)
select c.relname as unknown_public_relation,
       c.relkind as relation_kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join expected_relations e on e.relation_name = c.relname
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and e.relation_name is null
  and c.relname not in (
    'spatial_ref_sys', 'geometry_columns', 'geography_columns', 'raster_columns', 'raster_overviews'
  )
order by c.relname;

-- Exact row counts by table. Notices contain table names and totals only.
do $counts$
declare
  table_name text;
  row_count bigint;
  expected_tables constant text[] := array[
    'users', 'doctors', 'patients', 'appointments', 'medications',
    'evolucao_paciente', 'sigilous_notes',
    'financial_transactions', 'financial_categories', 'financial_cost_centers',
    'financial_payment_methods', 'financial_bank_accounts', 'financial_insurance_plans',
    'financial_repasses', 'financial_cash_closures', 'financial_reconciliations',
    'financial_billing_records', 'financial_settings',
    'patient_access_enrollments', 'patient_access_rate_limits'
  ];
begin
  foreach table_name in array expected_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'TARGET ROW COUNT public.% = MISSING', table_name;
    else
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice 'TARGET ROW COUNT public.% = %', table_name, row_count;
    end if;
  end loop;
end
$counts$;

-- Target columns absent from the reviewed schema. This is an audit result, not
-- a migration: do not use this file to mutate security objects or data.
with expected_columns(table_name, column_name) as (
  values
    ('users','id'), ('users','username'), ('users','password'), ('users','name'),
    ('users','role'), ('users','doctor_id'), ('users','clinicId'), ('users','authUserId'),
    ('doctors','id'), ('doctors','name'), ('doctors','crm'), ('doctors','specialty'),
    ('doctors','email'), ('doctors','phone'), ('doctors','avatar'), ('doctors','availableTimes'), ('doctors','clinicId'),
    ('patients','id'), ('patients','name'), ('patients','birthDate'), ('patients','gender'),
    ('patients','cpf'), ('patients','email'), ('patients','phone'), ('patients','address'),
    ('patients','streetName'), ('patients','streetNumber'), ('patients','neighborhood'), ('patients','city'),
    ('patients','zipCode'), ('patients','healthInsurance'), ('patients','bloodType'), ('patients','allergies'),
    ('patients','history'), ('patients','preExistingConditions'), ('patients','createdAt'),
    ('patients','primaryDoctorId'), ('patients','files'), ('patients','clinicId'), ('patients','authUserId'),
    ('patients','paymentValue'), ('patients','paymentSender'), ('patients','selfRegistered'),
    ('patients','portalEnrollmentPending'),
    ('appointments','id'), ('appointments','patientId'), ('appointments','doctorId'), ('appointments','date'),
    ('appointments','time'), ('appointments','type'), ('appointments','status'), ('appointments','room'),
    ('appointments','serviceValue'), ('appointments','repassRule'), ('appointments','clinicId'),
    ('medications','id'), ('medications','name'), ('medications','dosage'), ('medications','posology'),
    ('medications','period'), ('medications','purpose'), ('medications','manufacturer'),
    ('evolucao_paciente','id'), ('evolucao_paciente','paciente_id'), ('evolucao_paciente','medico_id'),
    ('evolucao_paciente','medico_nome'), ('evolucao_paciente','especialidade'), ('evolucao_paciente','anotacoes'),
    ('evolucao_paciente','senha_acesso'), ('evolucao_paciente','data_criacao'),
    ('sigilous_notes','id'), ('sigilous_notes','patientId'), ('sigilous_notes','patient_id'),
    ('sigilous_notes','authorId'), ('sigilous_notes','authorName'), ('sigilous_notes','authorSpecialty'),
    ('sigilous_notes','note'), ('sigilous_notes','createdAt'),
    ('financial_transactions','id'), ('financial_transactions','clinicId'), ('financial_transactions','type'),
    ('financial_transactions','status'), ('financial_transactions','description'), ('financial_transactions','amount'),
    ('financial_transactions','dueDate'), ('financial_transactions','paidDate'), ('financial_transactions','patientId'),
    ('financial_transactions','doctorId'), ('financial_transactions','appointmentId'), ('financial_transactions','categoryId'),
    ('financial_transactions','costCenterId'), ('financial_transactions','paymentMethodId'), ('financial_transactions','accountId'),
    ('financial_transactions','insurancePlanId'), ('financial_transactions','documentNumber'),
    ('financial_transactions','notes'), ('financial_transactions','createdAt'),
    ('financial_categories','id'), ('financial_categories','clinicId'), ('financial_categories','name'),
    ('financial_categories','type'), ('financial_categories','color'), ('financial_categories','active'),
    ('financial_cost_centers','id'), ('financial_cost_centers','clinicId'), ('financial_cost_centers','name'),
    ('financial_cost_centers','description'), ('financial_cost_centers','active'),
    ('financial_payment_methods','id'), ('financial_payment_methods','clinicId'), ('financial_payment_methods','name'),
    ('financial_payment_methods','kind'), ('financial_payment_methods','feePercent'), ('financial_payment_methods','active'),
    ('financial_bank_accounts','id'), ('financial_bank_accounts','clinicId'), ('financial_bank_accounts','name'),
    ('financial_bank_accounts','bank'), ('financial_bank_accounts','agency'), ('financial_bank_accounts','accountNumber'),
    ('financial_bank_accounts','kind'), ('financial_bank_accounts','openingBalance'), ('financial_bank_accounts','active'),
    ('financial_insurance_plans','id'), ('financial_insurance_plans','clinicId'), ('financial_insurance_plans','name'),
    ('financial_insurance_plans','operator'), ('financial_insurance_plans','code'),
    ('financial_insurance_plans','paymentTermDays'), ('financial_insurance_plans','active'),
    ('financial_repasses','id'), ('financial_repasses','clinicId'), ('financial_repasses','doctorId'),
    ('financial_repasses','patientId'), ('financial_repasses','appointmentId'), ('financial_repasses','referenceMonth'),
    ('financial_repasses','grossAmount'), ('financial_repasses','percentage'), ('financial_repasses','amount'),
    ('financial_repasses','status'), ('financial_repasses','dueDate'), ('financial_repasses','paidDate'),
    ('financial_repasses','notes'),
    ('financial_cash_closures','id'), ('financial_cash_closures','clinicId'), ('financial_cash_closures','accountId'),
    ('financial_cash_closures','date'), ('financial_cash_closures','openingBalance'),
    ('financial_cash_closures','expectedBalance'), ('financial_cash_closures','countedBalance'),
    ('financial_cash_closures','difference'), ('financial_cash_closures','responsibleName'),
    ('financial_cash_closures','status'), ('financial_cash_closures','notes'),
    ('financial_reconciliations','id'), ('financial_reconciliations','clinicId'),
    ('financial_reconciliations','accountId'), ('financial_reconciliations','date'),
    ('financial_reconciliations','description'), ('financial_reconciliations','amount'),
    ('financial_reconciliations','type'), ('financial_reconciliations','status'),
    ('financial_reconciliations','transactionId'),
    ('financial_billing_records','id'), ('financial_billing_records','clinicId'),
    ('financial_billing_records','referenceMonth'), ('financial_billing_records','patientId'),
    ('financial_billing_records','insurancePlanId'), ('financial_billing_records','totalAmount'),
    ('financial_billing_records','submittedAt'), ('financial_billing_records','dueDate'),
    ('financial_billing_records','status'), ('financial_billing_records','notes'),
    ('financial_settings','clinicId'), ('financial_settings','clinicName'), ('financial_settings','document'),
    ('financial_settings','currency'), ('financial_settings','defaultPaymentMethodId'),
    ('financial_settings','defaultAccountId'), ('financial_settings','allowNegativeCash'),
    ('financial_settings','sendPaymentNotifications'),
    ('patient_access_enrollments','patient_id'), ('patient_access_enrollments','clinic_id'),
    ('patient_access_enrollments','auth_user_id'), ('patient_access_enrollments','nonce_hash'),
    ('patient_access_enrollments','created_at'),
    ('patient_access_rate_limits','bucket_hash'), ('patient_access_rate_limits','window_started_at'),
    ('patient_access_rate_limits','attempts')
)
select e.table_name, e.column_name, 'MISSING TARGET COLUMN' as status
from expected_columns e
left join information_schema.columns a
  on a.table_schema = 'public' and a.table_name = e.table_name and a.column_name = e.column_name
where a.column_name is null
order by e.table_name, e.column_name;

-- RLS state and anonymous-facing table privileges; no application rows queried.
with application_tables(table_name) as (
  values
    ('users'), ('doctors'), ('patients'), ('appointments'), ('medications'),
    ('evolucao_paciente'), ('sigilous_notes'),
    ('financial_transactions'), ('financial_categories'), ('financial_cost_centers'),
    ('financial_payment_methods'), ('financial_bank_accounts'), ('financial_insurance_plans'),
    ('financial_repasses'), ('financial_cash_closures'), ('financial_reconciliations'),
    ('financial_billing_records'), ('financial_settings'),
    ('patient_access_enrollments'), ('patient_access_rate_limits')
)
select t.table_name,
       coalesce(c.relrowsecurity, false) as rls_enabled,
       case when c.oid is null then null
            else has_table_privilege('anon', format('public.%I', t.table_name), 'SELECT') end as anon_has_table_select,
       case when c.oid is null then null
            else has_table_privilege('authenticated', format('public.%I', t.table_name), 'SELECT') end as authenticated_has_table_select,
       case when c.oid is null then null
            else has_table_privilege('service_role', format('public.%I', t.table_name), 'SELECT') end as service_role_has_table_select
from application_tables t
left join pg_class c
  on c.relname = t.table_name
 and c.relnamespace = (select oid from pg_namespace where nspname = 'public')
order by t.table_name;

-- Column-level users grants must expose profile metadata only, never passwords.
select
  has_column_privilege('anon', 'public.users', 'password', 'SELECT') as anon_can_select_legacy_password,
  has_column_privilege('authenticated', 'public.users', 'password', 'SELECT') as authenticated_can_select_legacy_password,
  has_column_privilege('authenticated', 'public.users', 'id', 'SELECT') as authenticated_can_select_profile_id,
  has_column_privilege('authenticated', 'public.users', 'username', 'SELECT') as authenticated_can_select_username,
  has_column_privilege('authenticated', 'public.users', 'name', 'SELECT') as authenticated_can_select_name,
  has_column_privilege('authenticated', 'public.users', 'role', 'SELECT') as authenticated_can_select_role,
  has_column_privilege('authenticated', 'public.users', 'doctor_id', 'SELECT') as authenticated_can_select_doctor_id,
  has_column_privilege('authenticated', 'public.users', 'clinicId', 'SELECT') as authenticated_can_select_clinic_id,
  has_column_privilege('authenticated', 'public.users', 'authUserId', 'SELECT') as authenticated_can_select_auth_binding;

select
  has_table_privilege('anon', 'public.patient_access_enrollments', 'SELECT') as anon_can_read_pending_enrollments,
  has_table_privilege('authenticated', 'public.patient_access_enrollments', 'SELECT') as authenticated_can_read_pending_enrollments,
  has_table_privilege('service_role', 'public.patient_access_enrollments', 'SELECT') as service_role_can_read_pending_enrollments,
  has_table_privilege('anon', 'public.patient_access_rate_limits', 'SELECT') as anon_can_read_rate_limits,
  has_table_privilege('authenticated', 'public.patient_access_rate_limits', 'SELECT') as authenticated_can_read_rate_limits,
  has_table_privilege('service_role', 'public.patient_access_rate_limits', 'SELECT') as service_role_can_read_rate_limits,
  has_function_privilege('service_role', 'public.consume_patient_access_attempt(text,integer,integer)', 'EXECUTE') as service_role_can_consume_rate_limit,
  has_function_privilege('authenticated', 'public.consume_patient_access_attempt(text,integer,integer)', 'EXECUTE') as authenticated_can_consume_rate_limit;

-- Security policies, roles, commands, and expressions are metadata only.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users', 'doctors', 'patients', 'appointments', 'medications',
    'evolucao_paciente', 'sigilous_notes',
    'financial_transactions', 'financial_categories', 'financial_cost_centers',
    'financial_payment_methods', 'financial_bank_accounts', 'financial_insurance_plans',
    'financial_repasses', 'financial_cash_closures', 'financial_reconciliations',
    'financial_billing_records', 'financial_settings',
    'patient_access_enrollments', 'patient_access_rate_limits'
  )
order by tablename, policyname;

-- Explicit flags for public/anon policies on protected tables.
select t.tablename,
       count(p.policyname) filter (
         where p.policyname is not null
           and ('anon' = any(p.roles) or 'public' = any(p.roles))
       ) as open_or_anon_policy_count
from (
  values
    ('users'), ('doctors'), ('patients'), ('appointments'), ('medications'),
    ('evolucao_paciente'), ('sigilous_notes'),
    ('financial_transactions'), ('financial_categories'), ('financial_cost_centers'),
    ('financial_payment_methods'), ('financial_bank_accounts'), ('financial_insurance_plans'),
    ('financial_repasses'), ('financial_cash_closures'), ('financial_reconciliations'),
    ('financial_billing_records'), ('financial_settings'),
    ('patient_access_enrollments'), ('patient_access_rate_limits')
) as t(tablename)
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename
group by t.tablename
order by t.tablename;

-- Verify staff helper is staff-only and bind_current_user cannot auto-bind by
-- username/email or update the staff identity link.
select
  to_regprocedure('public.current_user_clinic_id()') is not null as staff_clinic_helper_exists,
  to_regprocedure('public.patient_access_clinic_id()') is not null as patient_clinic_helper_exists,
  to_regprocedure('public.bind_current_user()') is not null as safe_bind_function_exists,
  case when to_regprocedure('public.current_user_clinic_id()') is null then false else
    position('u.role in' in lower(pg_get_functiondef(to_regprocedure('public.current_user_clinic_id()')))) > 0
  end as staff_clinic_helper_filters_staff_roles,
  case when to_regprocedure('public.bind_current_user()') is null then false else
    position('update public.users' in lower(pg_get_functiondef(to_regprocedure('public.bind_current_user()')))) = 0
    and position('split_part' in lower(pg_get_functiondef(to_regprocedure('public.bind_current_user()')))) = 0
  end as bind_never_auto_binds,
  to_regclass('auth.users') is not null as supabase_auth_users_table_exists;

-- Enrollment storage must stay server-managed and contain hash-shaped values,
-- not plaintext nonce data. Only invalid-hash counts are returned.
do $enrollment$
declare invalid_hash_count bigint;
begin
  if to_regclass('public.patient_access_enrollments') is not null then
    execute 'select count(*) from public.patient_access_enrollments where nonce_hash !~ ''^[0-9a-f]{64}$'''
      into invalid_hash_count;
    raise notice 'TARGET ENROLLMENTS rows with invalid nonce_hash format: %', invalid_hash_count;
  else
    raise notice 'TARGET ENROLLMENTS table missing';
  end if;
end
$enrollment$;

-- Relationship audit: each row reports orphan counts only, without exposing IDs.
do $relationships$
declare
  source_table text;
  source_column text;
  destination_table text;
  orphan_count bigint;
  relation_row text[];
  expected_relations constant text[] := array[
    ['appointments','patientId','patients'],
    ['appointments','doctorId','doctors'],
    ['patients','primaryDoctorId','doctors'],
    ['evolucao_paciente','paciente_id','patients'],
    ['sigilous_notes','patientId','patients'],
    ['financial_transactions','patientId','patients'],
    ['financial_transactions','doctorId','doctors'],
    ['financial_transactions','appointmentId','appointments'],
    ['financial_transactions','categoryId','financial_categories'],
    ['financial_transactions','costCenterId','financial_cost_centers'],
    ['financial_transactions','paymentMethodId','financial_payment_methods'],
    ['financial_transactions','accountId','financial_bank_accounts'],
    ['financial_transactions','insurancePlanId','financial_insurance_plans'],
    ['financial_repasses','doctorId','doctors'],
    ['financial_repasses','patientId','patients'],
    ['financial_repasses','appointmentId','appointments'],
    ['financial_cash_closures','accountId','financial_bank_accounts'],
    ['financial_reconciliations','accountId','financial_bank_accounts'],
    ['financial_reconciliations','transactionId','financial_transactions'],
    ['financial_billing_records','patientId','patients'],
    ['financial_billing_records','insurancePlanId','financial_insurance_plans'],
    ['financial_settings','defaultPaymentMethodId','financial_payment_methods'],
    ['financial_settings','defaultAccountId','financial_bank_accounts']
  ];
begin
  foreach relation_row slice 1 in array expected_relations loop
    source_table := relation_row[1];
    source_column := relation_row[2];
    destination_table := relation_row[3];
    if to_regclass(format('public.%I', source_table)) is not null
       and to_regclass(format('public.%I', destination_table)) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = source_table and column_name = source_column
       ) then
      execute format(
        'select count(*) from public.%I s where s.%I is not null and not exists (select 1 from public.%I d where d.id = s.%I)',
        source_table, source_column, destination_table, source_column
      ) into orphan_count;
      raise notice 'TARGET RELATION %.% -> %.id orphan rows: %',
        source_table, source_column, destination_table, orphan_count;
    else
      raise notice 'TARGET RELATION %.% -> %.id skipped: table/column absent',
        source_table, source_column, destination_table;
    end if;
  end loop;

  execute 'select count(*) from public.appointments a join public.patients p on p.id = a."patientId" where a."clinicId" is distinct from p."clinicId"'
    into orphan_count;
  raise notice 'TARGET RELATION appointment/patient clinic mismatch rows: %', orphan_count;
  execute 'select count(*) from public.appointments a join public.doctors d on d.id = a."doctorId" where a."clinicId" is distinct from d."clinicId"'
    into orphan_count;
  raise notice 'TARGET RELATION appointment/doctor clinic mismatch rows: %', orphan_count;
  execute 'select count(*) from public.sigilous_notes where patient_id is distinct from "patientId"'
    into orphan_count;
  raise notice 'TARGET RELATION confidential-note patient key mismatch rows: %', orphan_count;

  execute 'select count(distinct u."authUserId") from public.users u join public.patients p on p."authUserId" = u."authUserId" where u."authUserId" is not null'
    into orphan_count;
  raise notice 'TARGET AUTH identities shared between staff and patients: %', orphan_count;

  if to_regclass('auth.users') is not null then
    execute 'select count(*) from public.users u where u."authUserId" is not null and not exists (select 1 from auth.users a where a.id = u."authUserId")'
      into orphan_count;
    raise notice 'TARGET AUTH staff profile links without matching Auth identity: %', orphan_count;
    execute 'select count(*) from public.patients p where p."authUserId" is not null and not exists (select 1 from auth.users a where a.id = p."authUserId")'
      into orphan_count;
    raise notice 'TARGET AUTH patient profile links without matching Auth identity: %', orphan_count;
  else
    raise notice 'TARGET AUTH identity-link checks skipped: Supabase Auth schema missing';
  end if;
end
$relationships$;

-- Cross-clinic links must be zero even where the referenced ID exists.
do $tenant_relations$
declare mismatch_count bigint;
begin
  execute 'select count(*) from public.financial_transactions s join public.patients d on d.id = s."patientId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT financial transaction/patient mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_transactions s join public.doctors d on d.id = s."doctorId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT financial transaction/doctor mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_transactions s join public.appointments d on d.id = s."appointmentId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT financial transaction/appointment mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_repasses s join public.patients d on d.id = s."patientId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT repass/patient mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_repasses s join public.doctors d on d.id = s."doctorId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT repass/doctor mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_repasses s join public.appointments d on d.id = s."appointmentId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT repass/appointment mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_billing_records s join public.patients d on d.id = s."patientId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT billing/patient mismatches: %', mismatch_count;
  execute 'select count(*) from public.financial_billing_records s join public.financial_insurance_plans d on d.id = s."insurancePlanId" where s."clinicId" is distinct from d."clinicId"'
    into mismatch_count;
  raise notice 'TARGET TENANT billing/insurance-plan mismatches: %', mismatch_count;
end
$tenant_relations$;

-- Tenant assignment checks report only counts, never tenant IDs.
do $tenant_counts$
declare
  table_name text;
  missing_count bigint;
  tenant_tables constant text[] := array[
    'users', 'patients', 'doctors', 'appointments',
    'financial_transactions', 'financial_categories', 'financial_cost_centers',
    'financial_payment_methods', 'financial_bank_accounts', 'financial_insurance_plans',
    'financial_repasses', 'financial_cash_closures', 'financial_reconciliations',
    'financial_billing_records', 'financial_settings'
  ];
begin
  foreach table_name in array tenant_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'select count(*) from public.%I where "clinicId" is null or btrim("clinicId"::text) = ''''',
        table_name
      ) into missing_count;
      raise notice 'TARGET TENANT public.% rows missing/blank clinicId: %', table_name, missing_count;
    end if;
  end loop;
end
$tenant_counts$;

-- File refs remain inside patients.files JSON; this checks only counts/type
-- distributions, never names, URLs, or object keys. Storage object buckets
-- themselves must be inventoried separately.
select jsonb_typeof(files) as files_json_type, count(*) as patient_rows
from public.patients
group by jsonb_typeof(files)
order by files_json_type;
select
  count(*) as file_entries,
  count(*) filter (where lower(btrim(coalesce(file_entry ->> 'url', ''))) like 'http://%'
                     or lower(btrim(coalesce(file_entry ->> 'url', ''))) like 'https://%') as external_http_entries,
  count(*) filter (where btrim(coalesce(file_entry ->> 'url', '')) <> ''
                     and lower(btrim(coalesce(file_entry ->> 'url', ''))) not like 'http://%'
                     and lower(btrim(coalesce(file_entry ->> 'url', ''))) not like 'https://%') as non_url_or_storage_style_entries,
  count(*) filter (where btrim(coalesce(file_entry ->> 'url', '')) = '') as entries_without_url
from public.patients p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.files) = 'array' then p.files else '[]'::jsonb end
) as files_expanded(file_entry);

commit;