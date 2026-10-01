-- READ-ONLY source preflight. Run against the SOURCE project only.
-- Returns schema metadata and aggregate counts only; it never selects or prints
-- patient, staff, financial, Auth UUID, CPF, file URL, or note values.
-- Missing legacy/optional tables and columns are reported/skipped, not treated
-- as fatal. Review every unknown table/column before planning a data-only import.
-- Never restore a raw full old schema dump over the safe target. Manual import
-- must be data-only and wait for exact source/target column/ownership review.
-- Auth exports, storage objects/config, functions, jobs, and secrets have
-- separate migration paths. Pending enrollment nonce hashes depend on the
-- source service-role key; rehash for the target key in trusted tooling and
-- never log or print raw nonces/hashes.
begin transaction read only;

-- Public relations and whether each name belongs to the current application
-- inventory. Unknown public relations require a human ownership/data review.
with expected_tables(table_name) as (
  values
    ('users'), ('doctors'), ('patients'), ('appointments'), ('medications'),
    ('evolucao_paciente'), ('sigilous_notes'),
    ('financial_transactions'), ('financial_categories'),
    ('financial_cost_centers'), ('financial_payment_methods'),
    ('financial_bank_accounts'), ('financial_insurance_plans'),
    ('financial_repasses'), ('financial_cash_closures'),
    ('financial_reconciliations'), ('financial_billing_records'),
    ('financial_settings'), ('patient_access_enrollments'),
    ('patient_access_rate_limits'), ('patient_portal_doctors')
)
select
  c.relname as public_relation,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'f' then 'foreign table'
    else c.relkind::text
  end as relation_kind,
  case
    when e.table_name is not null then 'known application relation'
    when c.relname in ('spatial_ref_sys', 'geometry_columns', 'geography_columns', 'raster_columns', 'raster_overviews')
      then 'platform/extension-managed relation'
    else 'UNKNOWN - REVIEW'
  end as inventory_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join expected_tables e on e.table_name = c.relname
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by inventory_status desc, c.relname;

-- Complete public column inventory; metadata only.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- Known source columns compared with current target columns. This deliberately
-- reports missing columns instead of raising: an older source can legitimately
-- lack optional additions; assess the exact mapping before import.
with expected_columns(table_name, column_name) as (
  values
    ('users','id'), ('users','username'), ('users','password'), ('users','name'),
    ('users','role'), ('users','doctor_id'), ('users','clinicId'), ('users','authUserId'),
    ('doctors','id'), ('doctors','name'), ('doctors','crm'), ('doctors','specialty'),
    ('doctors','email'), ('doctors','phone'), ('doctors','avatar'),
    ('doctors','availableTimes'), ('doctors','clinicId'),
    ('patients','id'), ('patients','name'), ('patients','birthDate'), ('patients','gender'),
    ('patients','cpf'), ('patients','email'), ('patients','phone'), ('patients','address'),
    ('patients','streetName'), ('patients','streetNumber'), ('patients','neighborhood'),
    ('patients','city'), ('patients','zipCode'), ('patients','healthInsurance'),
    ('patients','bloodType'), ('patients','allergies'), ('patients','history'),
    ('patients','preExistingConditions'), ('patients','createdAt'),
    ('patients','primaryDoctorId'), ('patients','files'), ('patients','clinicId'),
    ('patients','authUserId'), ('patients','paymentValue'), ('patients','paymentSender'),
    ('patients','selfRegistered'), ('patients','portalEnrollmentPending'),
    ('patients','patientPassword'),
    ('appointments','id'), ('appointments','patientId'), ('appointments','doctorId'),
    ('appointments','date'), ('appointments','time'), ('appointments','type'),
    ('appointments','status'), ('appointments','room'), ('appointments','serviceValue'),
    ('appointments','repassRule'), ('appointments','clinicId'),
    ('medications','id'), ('medications','name'), ('medications','dosage'),
    ('medications','posology'), ('medications','period'), ('medications','purpose'),
    ('medications','manufacturer'),
    ('evolucao_paciente','id'), ('evolucao_paciente','paciente_id'),
    ('evolucao_paciente','medico_id'), ('evolucao_paciente','medico_nome'),
    ('evolucao_paciente','especialidade'), ('evolucao_paciente','anotacoes'),
    ('evolucao_paciente','senha_acesso'), ('evolucao_paciente','data_criacao'),
    ('sigilous_notes','id'), ('sigilous_notes','patientId'), ('sigilous_notes','patient_id'),
    ('sigilous_notes','authorId'), ('sigilous_notes','authorName'),
    ('sigilous_notes','authorSpecialty'), ('sigilous_notes','note'), ('sigilous_notes','createdAt'),
    ('financial_transactions','id'), ('financial_transactions','clinicId'),
    ('financial_transactions','type'), ('financial_transactions','status'),
    ('financial_transactions','description'), ('financial_transactions','amount'),
    ('financial_transactions','dueDate'), ('financial_transactions','paidDate'),
    ('financial_transactions','patientId'), ('financial_transactions','doctorId'),
    ('financial_transactions','appointmentId'), ('financial_transactions','categoryId'),
    ('financial_transactions','costCenterId'), ('financial_transactions','paymentMethodId'),
    ('financial_transactions','accountId'), ('financial_transactions','insurancePlanId'),
    ('financial_transactions','documentNumber'), ('financial_transactions','notes'),
    ('financial_transactions','createdAt'),
    ('financial_categories','id'), ('financial_categories','clinicId'),
    ('financial_categories','name'), ('financial_categories','type'),
    ('financial_categories','color'), ('financial_categories','active'),
    ('financial_cost_centers','id'), ('financial_cost_centers','clinicId'),
    ('financial_cost_centers','name'), ('financial_cost_centers','description'),
    ('financial_cost_centers','active'),
    ('financial_payment_methods','id'), ('financial_payment_methods','clinicId'),
    ('financial_payment_methods','name'), ('financial_payment_methods','kind'),
    ('financial_payment_methods','feePercent'), ('financial_payment_methods','active'),
    ('financial_bank_accounts','id'), ('financial_bank_accounts','clinicId'),
    ('financial_bank_accounts','name'), ('financial_bank_accounts','bank'),
    ('financial_bank_accounts','agency'), ('financial_bank_accounts','accountNumber'),
    ('financial_bank_accounts','kind'), ('financial_bank_accounts','openingBalance'),
    ('financial_bank_accounts','active'),
    ('financial_insurance_plans','id'), ('financial_insurance_plans','clinicId'),
    ('financial_insurance_plans','name'), ('financial_insurance_plans','operator'),
    ('financial_insurance_plans','code'), ('financial_insurance_plans','paymentTermDays'),
    ('financial_insurance_plans','active'),
    ('financial_repasses','id'), ('financial_repasses','clinicId'),
    ('financial_repasses','doctorId'), ('financial_repasses','patientId'),
    ('financial_repasses','appointmentId'), ('financial_repasses','referenceMonth'),
    ('financial_repasses','grossAmount'), ('financial_repasses','percentage'),
    ('financial_repasses','amount'), ('financial_repasses','status'),
    ('financial_repasses','dueDate'), ('financial_repasses','paidDate'), ('financial_repasses','notes'),
    ('financial_cash_closures','id'), ('financial_cash_closures','clinicId'),
    ('financial_cash_closures','accountId'), ('financial_cash_closures','date'),
    ('financial_cash_closures','openingBalance'), ('financial_cash_closures','expectedBalance'),
    ('financial_cash_closures','countedBalance'), ('financial_cash_closures','difference'),
    ('financial_cash_closures','responsibleName'), ('financial_cash_closures','status'),
    ('financial_cash_closures','notes'),
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
    ('financial_settings','clinicId'), ('financial_settings','clinicName'),
    ('financial_settings','document'), ('financial_settings','currency'),
    ('financial_settings','defaultPaymentMethodId'), ('financial_settings','defaultAccountId'),
    ('financial_settings','allowNegativeCash'), ('financial_settings','sendPaymentNotifications'),
    ('patient_access_enrollments','patient_id'), ('patient_access_enrollments','clinic_id'),
    ('patient_access_enrollments','auth_user_id'), ('patient_access_enrollments','nonce_hash'),
    ('patient_access_enrollments','created_at'),
    ('patient_access_rate_limits','bucket_hash'),
    ('patient_access_rate_limits','window_started_at'),
    ('patient_access_rate_limits','attempts')
)
select e.table_name, e.column_name, 'EXPECTED COLUMN MISSING IN SOURCE - REVIEW MAPPING' as status
from expected_columns e
left join information_schema.columns a
  on a.table_schema = 'public'
 and a.table_name = e.table_name
 and a.column_name = e.column_name
where a.column_name is null
order by e.table_name, e.column_name;

-- Unknown columns on known app relations, including legacy variants that are
-- not represented in the current target. patientPassword is listed above as
-- a recognized legacy-only secret column, not an import target.
with expected_columns(table_name, column_name) as (
  values
    ('users','id'), ('users','username'), ('users','password'), ('users','name'),
    ('users','role'), ('users','doctor_id'), ('users','clinicId'), ('users','authUserId'),
    ('doctors','id'), ('doctors','name'), ('doctors','crm'), ('doctors','specialty'),
    ('doctors','email'), ('doctors','phone'), ('doctors','avatar'), ('doctors','availableTimes'), ('doctors','clinicId'),
    ('patients','id'), ('patients','name'), ('patients','birthDate'), ('patients','gender'), ('patients','cpf'),
    ('patients','email'), ('patients','phone'), ('patients','address'), ('patients','streetName'),
    ('patients','streetNumber'), ('patients','neighborhood'), ('patients','city'), ('patients','zipCode'),
    ('patients','healthInsurance'), ('patients','bloodType'), ('patients','allergies'), ('patients','history'),
    ('patients','preExistingConditions'), ('patients','createdAt'), ('patients','primaryDoctorId'),
    ('patients','files'), ('patients','clinicId'), ('patients','authUserId'), ('patients','paymentValue'),
    ('patients','paymentSender'), ('patients','selfRegistered'), ('patients','portalEnrollmentPending'),
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
    ('financial_transactions','insurancePlanId'), ('financial_transactions','documentNumber'), ('financial_transactions','notes'),
    ('financial_transactions','createdAt'),
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
    ('financial_reconciliations','id'), ('financial_reconciliations','clinicId'), ('financial_reconciliations','accountId'),
    ('financial_reconciliations','date'), ('financial_reconciliations','description'),
    ('financial_reconciliations','amount'), ('financial_reconciliations','type'),
    ('financial_reconciliations','status'), ('financial_reconciliations','transactionId'),
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
select a.table_name, a.column_name, a.data_type, a.udt_name
from information_schema.columns a
join (select distinct table_name from expected_columns) e on e.table_name = a.table_name
left join expected_columns known
  on known.table_name = a.table_name and known.column_name = a.column_name
where a.table_schema = 'public'
  and known.column_name is null
order by a.table_name, a.ordinal_position;

-- Exact row counts for all existing public tables/partitions. The notice stream
-- contains table names and counts only and automatically skips absent tables.
do $counts$
declare
  source_table record;
  row_count bigint;
begin
  for source_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname
  loop
    execute format('select count(*) from public.%I', source_table.relname)
      into row_count;
    raise notice 'SOURCE ROW COUNT public.% = %', source_table.relname, row_count;
  end loop;
end
$counts$;

-- Clinic ownership quality: absent legacy tables/columns are explicitly
-- skipped. No clinic IDs or record values are emitted.
do $ownership$
declare
  target_table text;
  relation_entry text;
  source_table text;
  source_key text;
  target_table_name text;
  relation_parts text[];
  missing_count bigint;
  ownership_tables constant text[] := array[
    'users', 'patients', 'doctors', 'appointments',
    'financial_transactions', 'financial_categories', 'financial_cost_centers',
    'financial_payment_methods', 'financial_bank_accounts',
    'financial_insurance_plans', 'financial_repasses', 'financial_cash_closures',
    'financial_reconciliations', 'financial_billing_records', 'financial_settings'
  ];
begin
  foreach target_table in array ownership_tables loop
    if to_regclass(format('public.%I', target_table)) is null then
      raise notice 'CLINIC OWNERSHIP public.% skipped: table absent', target_table;
    elsif exists (
      select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = target_table
        and column_name = 'clinicId'
    ) then
      execute format(
        'select count(*) from public.%I where "clinicId" is null or btrim("clinicId"::text) = ''''',
        target_table
      ) into missing_count;
      raise notice 'CLINIC OWNERSHIP public.% rows missing/blank clinicId: %', target_table, missing_count;
    else
      raise notice 'CLINIC OWNERSHIP public.% skipped: clinicId column absent', target_table;
    end if;
  end loop;

  if to_regclass('public.appointments') is not null
     and to_regclass('public.patients') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='clinicId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='patientId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='clinicId')
  then
    execute 'select count(*) from public.appointments a join public.patients p on p.id = a."patientId" where a."clinicId" is distinct from p."clinicId"'
      into missing_count;
    raise notice 'RELATIONSHIP appointment/patient clinic mismatches: %', missing_count;
  else
    raise notice 'RELATIONSHIP appointment/patient clinic mismatch check skipped: source table/column absent';
  end if;

  if to_regclass('public.appointments') is not null
     and to_regclass('public.doctors') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='clinicId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='doctorId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='doctors' and column_name='clinicId')
  then
    execute 'select count(*) from public.appointments a join public.doctors d on d.id = a."doctorId" where a."clinicId" is distinct from d."clinicId"'
      into missing_count;
    raise notice 'RELATIONSHIP appointment/doctor clinic mismatches: %', missing_count;
  else
    raise notice 'RELATIONSHIP appointment/doctor clinic mismatch check skipped: source table/column absent';
  end if;

  -- Related finance rows must be assigned to the same tenant as any linked
  -- patient/doctor/appointment. Optional source columns are skipped safely.
  for relation_entry in
    select unnest(array[
      'financial_transactions|patientId|patients',
      'financial_transactions|doctorId|doctors',
      'financial_transactions|appointmentId|appointments',
      'financial_repasses|patientId|patients',
      'financial_repasses|doctorId|doctors',
      'financial_repasses|appointmentId|appointments',
      'financial_billing_records|patientId|patients'
    ])
  loop
    relation_parts := string_to_array(relation_entry, '|');
    source_table := relation_parts[1];
    source_key := relation_parts[2];
    target_table_name := relation_parts[3];
    if to_regclass(format('public.%I', source_table)) is not null
       and to_regclass(format('public.%I', target_table_name)) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = source_table
           and column_name = source_key
       )
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = source_table
           and column_name = 'clinicId'
       )
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = target_table_name
           and column_name = 'clinicId'
       )
    then
      execute format(
        'select count(*) from public.%I s join public.%I d on d.id = s.%I where s."clinicId" is distinct from d."clinicId"',
        source_table, target_table_name, source_key
      ) into missing_count;
      raise notice 'RELATIONSHIP %.% / % clinic mismatches: %',
        source_table, source_key, target_table_name, missing_count;
    else
      raise notice 'RELATIONSHIP %.% / % clinic mismatch check skipped: source table/column absent',
        source_table, source_key, target_table_name;
    end if;
  end loop;
end
$ownership$;

-- Count normalized duplicate CPFs (groups and surplus rows only), never show CPF.
do $cpf$
declare
  duplicate_groups bigint;
  surplus_rows bigint;
begin
  if to_regclass('public.patients') is null
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='cpf') then
    raise notice 'NORMALIZED CPF duplicate check skipped: public.patients.cpf absent';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='clinicId') then
    execute $sql$
      select count(*), coalesce(sum(duplicate_count - 1), 0)
      from (
        select count(*) as duplicate_count
        from public.patients
        where cpf is not null and regexp_replace(cpf, '[^0-9]', '', 'g') <> ''
        group by coalesce(nullif(btrim("clinicId"), ''), '[missing clinic]'),
                 regexp_replace(cpf, '[^0-9]', '', 'g')
        having count(*) > 1
      ) duplicate_sets
    $sql$ into duplicate_groups, surplus_rows;
    raise notice 'NORMALIZED CPF duplicates within clinic: groups %, surplus rows %', duplicate_groups, surplus_rows;
  else
    execute $sql$
      select count(*), coalesce(sum(duplicate_count - 1), 0)
      from (
        select count(*) as duplicate_count
        from public.patients
        where cpf is not null and regexp_replace(cpf, '[^0-9]', '', 'g') <> ''
        group by regexp_replace(cpf, '[^0-9]', '', 'g')
        having count(*) > 1
      ) duplicate_sets
    $sql$ into duplicate_groups, surplus_rows;
    raise notice 'NORMALIZED CPF duplicates across source (clinic column absent): groups %, surplus rows %', duplicate_groups, surplus_rows;
  end if;
end
$cpf$;

-- Auth bindings: only duplicate/shared-link counts are reported, never UUIDs.
do $auth_binds$
declare
  duplicate_count bigint;
  overlap_count bigint;
  bound_rows bigint;
  unbound_rows bigint;
begin
  if to_regclass('public.users') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='authUserId') then
    execute 'select count(*) from (select "authUserId" from public.users where "authUserId" is not null group by "authUserId" having count(*) > 1) d'
      into duplicate_count;
    raise notice 'AUTH BINDS duplicate users.authUserId values: %', duplicate_count;
    execute 'select count(*) filter (where "authUserId" is not null), count(*) filter (where "authUserId" is null) from public.users'
      into bound_rows, unbound_rows;
    raise notice 'AUTH BINDS users rows bound %, unbound %', bound_rows, unbound_rows;
  else
    raise notice 'AUTH BINDS users.authUserId check skipped: source table/column absent';
  end if;

  if to_regclass('public.patients') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='authUserId') then
    execute 'select count(*) from (select "authUserId" from public.patients where "authUserId" is not null group by "authUserId" having count(*) > 1) d'
      into duplicate_count;
    raise notice 'AUTH BINDS duplicate patients.authUserId values: %', duplicate_count;
    execute 'select count(*) filter (where "authUserId" is not null), count(*) filter (where "authUserId" is null) from public.patients'
      into bound_rows, unbound_rows;
    raise notice 'AUTH BINDS patients rows bound %, unbound %', bound_rows, unbound_rows;
  else
    raise notice 'AUTH BINDS patients.authUserId check skipped: source table/column absent';
  end if;

  if to_regclass('public.users') is not null
     and to_regclass('public.patients') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='authUserId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='authUserId') then
    execute 'select count(distinct u."authUserId") from public.users u join public.patients p on p."authUserId" = u."authUserId" where u."authUserId" is not null'
      into overlap_count;
    raise notice 'AUTH BINDS Auth identities shared by a staff user and patient: %', overlap_count;
  else
    raise notice 'AUTH BINDS cross-table ownership check skipped: source table/column absent';
  end if;

  if to_regclass('auth.users') is not null then
    if to_regclass('public.users') is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='authUserId') then
      execute 'select count(*) from public.users u where u."authUserId" is not null and not exists (select 1 from auth.users a where a.id = u."authUserId")'
        into overlap_count;
      raise notice 'AUTH BINDS staff profile links without matching Auth identity: %', overlap_count;
    end if;
    if to_regclass('public.patients') is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='authUserId') then
      execute 'select count(*) from public.patients p where p."authUserId" is not null and not exists (select 1 from auth.users a where a.id = p."authUserId")'
        into overlap_count;
      raise notice 'AUTH BINDS patient profile links without matching Auth identity: %', overlap_count;
    end if;
  else
    raise notice 'AUTH BINDS auth.users check skipped: Supabase Auth schema absent';
  end if;
end
$auth_binds$;

-- File reference audit: aggregate counts only; no file URL/name is returned.
do $files$
declare
  file_count bigint;
  external_url_count bigint;
  non_url_reference_count bigint;
  empty_url_count bigint;
  files_type text;
begin
  if to_regclass('public.patients') is null then
    raise notice 'FILE REFERENCES check skipped: public.patients absent';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='patients' and column_name='files'
  ) then
    raise notice 'FILE REFERENCES check skipped: patients.files absent';
  else
    select udt_name into files_type
    from information_schema.columns
    where table_schema='public' and table_name='patients' and column_name='files';
    if files_type not in ('json', 'jsonb') then
      raise notice 'FILE REFERENCES check skipped: patients.files is %, not JSON', files_type;
    else
      execute $sql$
        select count(*),
               count(*) filter (where lower(btrim(coalesce(file_entry ->> 'url', ''))) like 'http://%'
                                  or lower(btrim(coalesce(file_entry ->> 'url', ''))) like 'https://%'),
               count(*) filter (where btrim(coalesce(file_entry ->> 'url', '')) <> ''
                                  and lower(btrim(coalesce(file_entry ->> 'url', ''))) not like 'http://%'
                                  and lower(btrim(coalesce(file_entry ->> 'url', ''))) not like 'https://%'),
               count(*) filter (where btrim(coalesce(file_entry ->> 'url', '')) = '')
        from public.patients p
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(p.files::jsonb) = 'array' then p.files::jsonb else '[]'::jsonb end
        ) as files_expanded(file_entry)
      $sql$ into file_count, external_url_count, non_url_reference_count, empty_url_count;
      raise notice 'FILE REFERENCES entries %, external HTTP(S) %, non-URL/storage-style %, missing URL %',
        file_count, external_url_count, non_url_reference_count, empty_url_count;
    end if;
  end if;
end
$files$;

-- Appointment orphan checks only run when both optional sides and key columns
-- exist, so older variants produce a skip notice rather than a SQL error.
do $relations$
declare
  orphan_count bigint;
begin
  if to_regclass('public.appointments') is not null and to_regclass('public.patients') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='patientId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='patients' and column_name='id') then
    execute 'select count(*) from public.appointments a where a."patientId" is not null and not exists (select 1 from public.patients p where p.id = a."patientId")'
      into orphan_count;
    raise notice 'RELATIONSHIP appointments with missing patient: %', orphan_count;
  else
    raise notice 'RELATIONSHIP appointment/patient orphan check skipped: source table/column absent';
  end if;

  if to_regclass('public.appointments') is not null and to_regclass('public.doctors') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='doctorId')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='doctors' and column_name='id') then
    execute 'select count(*) from public.appointments a where a."doctorId" is not null and not exists (select 1 from public.doctors d where d.id = a."doctorId")'
      into orphan_count;
    raise notice 'RELATIONSHIP appointments with missing doctor: %', orphan_count;
  else
    raise notice 'RELATIONSHIP appointment/doctor orphan check skipped: source table/column absent';
  end if;
end
$relations$;

commit;