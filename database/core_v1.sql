-- core_v1.sql (DEV-safe, id defaults + legacy_record_id for UPSERT)
-- Requires pgcrypto for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS core;

-- Track imports
CREATE TABLE IF NOT EXISTS core.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source text,
  notes text
);

CREATE TABLE IF NOT EXISTS core.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid REFERENCES core.import_runs(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  row_ref text,
  error text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- BRANDS
-- =========
CREATE TABLE IF NOT EXISTS core.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,
  company text,
  customer_type text,
  status text,
  lead_referral_source text,
  date_of_initial_contact date,
  title text,
  contact text,
  address text,
  phone text,
  email text,
  website text,
  linkedin_profile text,
  background_info text,
  sales_rep text,
  project_type text,
  project_description text,
  presentation_date date,
  forecast text,
  deliverables text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- TEXTILE MILLS / FACTORIES
-- =========
CREATE TABLE IF NOT EXISTS core.textile_mills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,
  company text,
  chinese_company_name text,
  textile_mill_type text,
  specialty text,
  purchasing text,
  annual_sales text,
  lead_referral_source text,
  date_of_initial_contact date,
  title text,
  contact text,
  address text,
  country_map text,
  secondary_country text,
  phone text,
  email text,
  website text,
  sales_rep text,
  development text,
  presentation_complete text,
  customer_type text,
  brand_nominated text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- DISTRIBUTORS
-- =========
CREATE TABLE IF NOT EXISTS core.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,
  company text,
  chinese_company_name text,
  specialty text,
  agent_for_fuze text,
  annual_sales text,
  date_of_initial_contact date,
  title text,
  contact text,
  address text,
  phone text,
  email text,
  website text,
  sales_rep text,
  country text,
  distributor text,
  for_fuze text,
  country_2 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- LABS
-- =========
CREATE TABLE IF NOT EXISTS core.labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,
  laboratory text,
  location text,
  country text,
  contact text,
  email text,
  phone text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- FABRICS
-- =========
CREATE TABLE IF NOT EXISTS core.fabrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,

  -- linkage (soft for now; we will harden later)
  brand text,
  textile_mill text,

  fuze_fabric_number text,
  wash text,
  customer_fabric_code text,
  factory_fabric_code text,
  textile_mill_treatment text,
  application_method text,
  application_recipe text,

  fabric_content_1 text,
  content_1_pct numeric,
  fabric_content_2 text,
  content_2_pct numeric,
  fabric_content_3 text,
  content_3_pct numeric,

  fabric_finish_note text,
  fabric_construction_description text,
  fabric_color text,
  fuze_treatment_location text,
  fuze_application_date date,

  full_width text,
  weight_gsm numeric,
  yarn_filament text,
  note text,

  pad_recipe text,
  production_trial_completed text,

  icp_sent text,
  icp_rcvd text,
  icp_passed text,
  amb_sent text,
  amb_rcvd text,
  amb_pass text,

  category text,
  program_name text,
  status_note text,
  status text,

  pre_atlas boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- TEST REPORTS
-- =========
CREATE TABLE IF NOT EXISTS core.test_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,

  test_number text,
  brand text,
  textile_mill text,

  fabric_database text,
  laboratory text,
  fuze_fabric_number text,
  wash text,
  number_of_washes integer,

  test_method text,
  test_report_number text,

  tested_bacteria_1 text,
  antimicrobial_result_1 numeric,
  tested_bacteria_2 text,
  antibacterial_result_2 numeric,

  written_result_fungal text,
  tested_odor text,
  tested_metal text,

  icp_ag_result numeric,
  icp_au_result numeric,

  fuze_internal_report_number text,
  report_date date,
  date_post_wash date,

  machine_type text,
  post_wash_report_number text,

  ag_serial text,
  au_serial text,
  fungal_serial text,

  pass_fail_internal text,
  pass_fail_brand text,

  pre_atlas boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========
-- NOTES
-- =========
CREATE TABLE IF NOT EXISTS core.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes (text search + lookups)
CREATE INDEX IF NOT EXISTS idx_core_brands_company ON core.brands(company);
CREATE INDEX IF NOT EXISTS idx_core_fabrics_brand ON core.fabrics(brand);
CREATE INDEX IF NOT EXISTS idx_core_fabrics_fuze_fabric_number ON core.fabrics(fuze_fabric_number);
CREATE INDEX IF NOT EXISTS idx_core_test_reports_test_number ON core.test_reports(test_number);
CREATE INDEX IF NOT EXISTS idx_core_test_reports_fuze_fabric_number ON core.test_reports(fuze_fabric_number);