-- database/staging_v1.sql
-- Raw staging tables mirror the CSV columns (mostly TEXT) so load never fails.
-- We preserve "legacy mess" here, then normalize into real tables later.

CREATE SCHEMA IF NOT EXISTS raw;

-- Brands (25 fields)
DROP TABLE IF EXISTS raw.brands;
CREATE TABLE raw.brands (
  company                  TEXT,
  customer_type            TEXT,
  status                   TEXT,
  lead_referral_source     TEXT,
  date_of_initial_contact  TEXT,
  title                    TEXT,
  contact                  TEXT,
  address                  TEXT,
  phone                    TEXT,
  email                    TEXT,
  website                  TEXT,
  linkedin_profile         TEXT,
  background_info          TEXT,
  sales_rep                TEXT,
  project_type             TEXT,
  project_description      TEXT,
  presentation_date        TEXT,
  forecast                 TEXT,
  deliverables             TEXT,
  column_5                 TEXT,
  column_6                 TEXT,
  column_7                 TEXT,
  column_8                 TEXT,
  column_9                 TEXT,
  knack_record_id          TEXT
);

-- Textile Mills (21 fields)
DROP TABLE IF EXISTS raw.textilemills;
CREATE TABLE raw.textilemills (
  company                  TEXT,
  chinese_company_name     TEXT,
  textile_mill_type        TEXT,
  specialty                TEXT,
  purchasing               TEXT,
  annual_sales             TEXT,
  lead_referral_source     TEXT,
  date_of_initial_contact  TEXT,
  title                    TEXT,
  contact                  TEXT,
  address                  TEXT,
  country_map              TEXT,
  secondary_country        TEXT,
  phone                    TEXT,
  email                    TEXT,
  website                  TEXT,
  sales_rep                TEXT,
  development              TEXT,
  presentation_complete    TEXT,
  customer_type            TEXT,
  brand_nominated          TEXT
);

-- Distributors (17 fields)
DROP TABLE IF EXISTS raw.distributors;
CREATE TABLE raw.distributors (
  company                  TEXT,
  chinese_company_name     TEXT,
  specialty                TEXT,
  agent_for_fuze           TEXT,
  annual_sales             TEXT,
  date_of_initial_contact  TEXT,
  title                    TEXT,
  contact                  TEXT,
  address                  TEXT,
  phone                    TEXT,
  email                    TEXT,
  website                  TEXT,
  sales_rep                TEXT,
  country                  TEXT,
  distributor              TEXT,
  for_fuze                 TEXT,
  country_2                TEXT
);

-- Labratories (1 field)
DROP TABLE IF EXISTS raw.labratories;
CREATE TABLE raw.labratories (
  labratory_name TEXT
);

-- Fabric Database (51 fields)
DROP TABLE IF EXISTS raw.fabricdatabase;
CREATE TABLE raw.fabricdatabase (
  fuze_fabric_number               TEXT,
  wash                             TEXT,
  customer_fabric_code             TEXT,
  factory_fabric_code              TEXT,
  brand                            TEXT,
  textile_mill_treatment           TEXT,
  application_method               TEXT,
  application_recipe               TEXT,
  fabric_content_1                 TEXT,
  pct_content_1                    TEXT,
  fabric_content_2                 TEXT,
  pct_content_2                    TEXT,
  fabric_content_3                 TEXT,
  pct_content_3                    TEXT,
  fabric_finish_note               TEXT,
  fabric_construction_description  TEXT,
  fabric_color                     TEXT,
  fuze_treatment_location          TEXT,
  fuze_application_date            TEXT,
  fabric_submission_document       TEXT,
  fabric_submission_image          TEXT,
  textile_mill                     TEXT,
  full_width                       TEXT,
  weight_gsm                       TEXT,
  yarn_filament                    TEXT,
  note                             TEXT,
  fuze_application_date_2          TEXT,
  fuze_treatment_location_2        TEXT,
  weight_gsm_2                     TEXT,
  pad_recipe                       TEXT,
  production_trial_completed       TEXT,
  icp_sent                         TEXT,
  icp_rcvd                         TEXT,
  icp_passed                       TEXT,
  amb_sent                         TEXT,
  amb_rcvd                         TEXT,
  amb_pass                         TEXT,
  category                         TEXT,
  program_name                     TEXT,
  status_note                      TEXT,
  status                           TEXT,
  ptc_num_2                        TEXT,
  icp_sent_num_2                   TEXT,
  icp_rcvd_num_2                   TEXT,
  icp_passed_num_2                 TEXT,
  amb_sent_num_2                   TEXT,
  amb_rcvd_num_2                   TEXT,
  amb_pass_num_2                   TEXT,
  progress_count                   TEXT,
  progress_percentage              TEXT,
  progress_percentage_numeric      TEXT
);

-- Test Reports (37 fields)
DROP TABLE IF EXISTS raw.testreports;
CREATE TABLE raw.testreports (
  test_number                 TEXT,
  brand                       TEXT,
  textile_mill                TEXT,
  fabric_database             TEXT,
  labratory                   TEXT,
  fuze_fabric_number          TEXT,
  wash                        TEXT,
  number_of_washes            TEXT,
  test_method                 TEXT,
  test_method_dropdown        TEXT,
  test_report_num             TEXT,
  tested_bacteria_1           TEXT,
  antimicrobial_result_1      TEXT,
  tested_bacteria             TEXT,
  tested_bacteria_2           TEXT,
  antibacterial_result_2      TEXT,
  written_result_fungal       TEXT,
  tested_odor                 TEXT,
  tested_metal                TEXT,
  icp_ag_result               TEXT,
  icp_au_result               TEXT,
  fuze_internal_report_num    TEXT,
  date                         TEXT,
  date_post_wash              TEXT,
  testing_labratory           TEXT,
  fuze_application_date       TEXT,
  report_1                    TEXT,
  report_2                    TEXT,
  report_3                    TEXT,
  report_4                    TEXT,
  image                       TEXT,
  ag_serial                   TEXT,
  au_serial                   TEXT,
  fungal_serial               TEXT,
  machine_type                TEXT,
  post_wash_report_num        TEXT,
  ag                          TEXT
);

-- Notes (unknown structure — keep flexible)
DROP TABLE IF EXISTS raw.notes;
CREATE TABLE raw.notes (
  payload TEXT
);