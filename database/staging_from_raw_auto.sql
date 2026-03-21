-- AUTO-GENERATED: stg.* from raw.* (names from DB, not CSV)
CREATE SCHEMA IF NOT EXISTS stg;

CREATE OR REPLACE FUNCTION stg.clean_numeric(x text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, ',', '');
  v := replace(v, '%', '');
  v := replace(v, ' ', '');
  IF v !~ '^-?[0-9]*\.?[0-9]+$' THEN
    RETURN NULL;
  END IF;
  RETURN v::numeric;
END $$;

CREATE OR REPLACE FUNCTION stg.clean_int(x text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, ',', '');
  v := replace(v, ' ', '');
  IF v !~ '^-?[0-9]+$' THEN
    RETURN NULL;
  END IF;
  RETURN v::int;
END $$;

CREATE OR REPLACE FUNCTION stg.clean_date(x text)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;

  IF v ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN v::date;
  END IF;

  IF v ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    RETURN to_date(v, 'MM/DD/YYYY');
  END IF;

  IF v ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN
    RETURN to_date(v, 'MM/DD/YY');
  END IF;

  RETURN NULL;
END $$;

DROP TABLE IF EXISTS stg."brands" CASCADE;
CREATE TABLE stg."brands" (
  "company" text,
  "customer_type" text,
  "status" text,
  "lead_referral_source" text,
  "date_of_initial_contact" date,
  "title" text,
  "contact" text,
  "contact__title" text,
  "contact__first" text,
  "contact__middle" text,
  "contact__last" text,
  "address" text,
  "address__street_1" text,
  "address__street_2" text,
  "address__city" text,
  "address__state" text,
  "address__zip" text,
  "address__country" integer,
  "address__latitude" text,
  "address__longitude" text,
  "phone" text,
  "email" text,
  "website" text,
  "linkedin_profile" text,
  "background_info" text,
  "sales_rep" numeric,
  "project_type" text,
  "project_description" text,
  "presentation_date" date,
  "forecast" numeric,
  "deliverables" text,
  "column_5" text,
  "column_6" text,
  "column_7" text,
  "column_8" text,
  "column_9" text,
  "record_id" text
);

TRUNCATE TABLE stg."brands";
INSERT INTO stg."brands"
SELECT
  r."company" AS "company",
  r."customer_type" AS "customer_type",
  r."status" AS "status",
  r."lead_referral_source" AS "lead_referral_source",
  stg.clean_date(r."date_of_initial_contact") AS "date_of_initial_contact",
  r."title" AS "title",
  r."contact" AS "contact",
  r."contact__title" AS "contact__title",
  r."contact__first" AS "contact__first",
  r."contact__middle" AS "contact__middle",
  r."contact__last" AS "contact__last",
  r."address" AS "address",
  r."address__street_1" AS "address__street_1",
  r."address__street_2" AS "address__street_2",
  r."address__city" AS "address__city",
  r."address__state" AS "address__state",
  r."address__zip" AS "address__zip",
  stg.clean_int(r."address__country") AS "address__country",
  r."address__latitude" AS "address__latitude",
  r."address__longitude" AS "address__longitude",
  r."phone" AS "phone",
  r."email" AS "email",
  r."website" AS "website",
  r."linkedin_profile" AS "linkedin_profile",
  r."background_info" AS "background_info",
  stg.clean_numeric(r."sales_rep") AS "sales_rep",
  r."project_type" AS "project_type",
  r."project_description" AS "project_description",
  stg.clean_date(r."presentation_date") AS "presentation_date",
  stg.clean_numeric(r."forecast") AS "forecast",
  r."deliverables" AS "deliverables",
  r."column_5" AS "column_5",
  r."column_6" AS "column_6",
  r."column_7" AS "column_7",
  r."column_8" AS "column_8",
  r."column_9" AS "column_9",
  r."record_id" AS "record_id"
FROM raw."brands" r;

DROP TABLE IF EXISTS stg."distributors" CASCADE;
CREATE TABLE stg."distributors" (
  "company" text,
  "chinese_company_name" text,
  "specialty" text,
  "agent_for_fuze" text,
  "annual_sales" numeric,
  "date_of_initial_contact" date,
  "title" text,
  "contact" text,
  "contact__title" text,
  "contact__first" text,
  "contact__middle" text,
  "contact__last" text,
  "address" text,
  "address__street_1" text,
  "address__street_2" text,
  "address__city" text,
  "address__state" text,
  "address__zip" text,
  "address__country" integer,
  "address__latitude" text,
  "address__longitude" text,
  "phone" text,
  "email" text,
  "website" text,
  "sales_rep" numeric,
  "country" integer,
  "distributor" text,
  "for_fuze" text,
  "country_2" integer,
  "record_id" text
);

TRUNCATE TABLE stg."distributors";
INSERT INTO stg."distributors"
SELECT
  r."company" AS "company",
  r."chinese_company_name" AS "chinese_company_name",
  r."specialty" AS "specialty",
  r."agent_for_fuze" AS "agent_for_fuze",
  stg.clean_numeric(r."annual_sales") AS "annual_sales",
  stg.clean_date(r."date_of_initial_contact") AS "date_of_initial_contact",
  r."title" AS "title",
  r."contact" AS "contact",
  r."contact__title" AS "contact__title",
  r."contact__first" AS "contact__first",
  r."contact__middle" AS "contact__middle",
  r."contact__last" AS "contact__last",
  r."address" AS "address",
  r."address__street_1" AS "address__street_1",
  r."address__street_2" AS "address__street_2",
  r."address__city" AS "address__city",
  r."address__state" AS "address__state",
  r."address__zip" AS "address__zip",
  stg.clean_int(r."address__country") AS "address__country",
  r."address__latitude" AS "address__latitude",
  r."address__longitude" AS "address__longitude",
  r."phone" AS "phone",
  r."email" AS "email",
  r."website" AS "website",
  stg.clean_numeric(r."sales_rep") AS "sales_rep",
  stg.clean_int(r."country") AS "country",
  r."distributor" AS "distributor",
  r."for_fuze" AS "for_fuze",
  stg.clean_int(r."country_2") AS "country_2",
  r."record_id" AS "record_id"
FROM raw."distributors" r;

DROP TABLE IF EXISTS stg."fabricdatabase" CASCADE;
CREATE TABLE stg."fabricdatabase" (
  "fuze_fabric_#" text,
  "wash" integer,
  "customer_fabric_code" text,
  "factory_fabric_code" text,
  "brand" text,
  "textile_mill_treatment" text,
  "application_method" text,
  "application_recipe" text,
  "fabric_content_#1" text,
  "content_1" text,
  "fabric_content_#2" text,
  "content_2" text,
  "fabric_content_#3" text,
  "content_3" text,
  "fabric_finish_note" text,
  "fabric_construction_description" text,
  "fabric_color" text,
  "fuze_treatment_location" text,
  "fuze_application_date" date,
  "fabric_submission_document" text,
  "fabric_submission_document__url" text,
  "fabric_submission_image" text,
  "fabric_submission_image__url" text,
  "textile_mill" text,
  "full_width" numeric,
  "weight_gsm" numeric,
  "yarn_filament" text,
  "note" text,
  "fuze_application_date_2" date,
  "fuze_treatment_location_2" text,
  "weight_gsm_2" numeric,
  "pad_recipe" text,
  "production_trial_completed" text,
  "icp_sent" numeric,
  "icp_rcvd" numeric,
  "icp_passed" numeric,
  "amb_sent" text,
  "amb_rcvd" text,
  "amb_pass" text,
  "category" text,
  "program_name" text,
  "status_note" text,
  "status" text,
  "ptc#" integer,
  "icp_sent#" numeric,
  "icp_rcvd#" numeric,
  "icp_passed#" numeric,
  "amb_sent#" text,
  "amb_rcvd#" text,
  "amb_pass#" text,
  "progress_count" integer,
  "progress_percentage" numeric,
  "progress_percentage_numeric" numeric,
  "record_id" text
);

TRUNCATE TABLE stg."fabricdatabase";
INSERT INTO stg."fabricdatabase"
SELECT
  r."fuze_fabric_#" AS "fuze_fabric_#",
  stg.clean_int(r."wash") AS "wash",
  r."customer_fabric_code" AS "customer_fabric_code",
  r."factory_fabric_code" AS "factory_fabric_code",
  r."brand" AS "brand",
  r."textile_mill_treatment" AS "textile_mill_treatment",
  r."application_method" AS "application_method",
  r."application_recipe" AS "application_recipe",
  r."fabric_content_#1" AS "fabric_content_#1",
  r."content_1" AS "content_1",
  r."fabric_content_#2" AS "fabric_content_#2",
  r."content_2" AS "content_2",
  r."fabric_content_#3" AS "fabric_content_#3",
  r."content_3" AS "content_3",
  r."fabric_finish_note" AS "fabric_finish_note",
  r."fabric_construction_description" AS "fabric_construction_description",
  r."fabric_color" AS "fabric_color",
  r."fuze_treatment_location" AS "fuze_treatment_location",
  stg.clean_date(r."fuze_application_date") AS "fuze_application_date",
  r."fabric_submission_document" AS "fabric_submission_document",
  r."fabric_submission_document__url" AS "fabric_submission_document__url",
  r."fabric_submission_image" AS "fabric_submission_image",
  r."fabric_submission_image__url" AS "fabric_submission_image__url",
  r."textile_mill" AS "textile_mill",
  stg.clean_numeric(r."full_width") AS "full_width",
  stg.clean_numeric(r."weight_gsm") AS "weight_gsm",
  r."yarn_filament" AS "yarn_filament",
  r."note" AS "note",
  stg.clean_date(r."fuze_application_date_2") AS "fuze_application_date_2",
  r."fuze_treatment_location_2" AS "fuze_treatment_location_2",
  stg.clean_numeric(r."weight_gsm_2") AS "weight_gsm_2",
  r."pad_recipe" AS "pad_recipe",
  r."production_trial_completed" AS "production_trial_completed",
  stg.clean_numeric(r."icp_sent") AS "icp_sent",
  stg.clean_numeric(r."icp_rcvd") AS "icp_rcvd",
  stg.clean_numeric(r."icp_passed") AS "icp_passed",
  r."amb_sent" AS "amb_sent",
  r."amb_rcvd" AS "amb_rcvd",
  r."amb_pass" AS "amb_pass",
  r."category" AS "category",
  r."program_name" AS "program_name",
  r."status_note" AS "status_note",
  r."status" AS "status",
  stg.clean_int(r."ptc#") AS "ptc#",
  stg.clean_numeric(r."icp_sent#") AS "icp_sent#",
  stg.clean_numeric(r."icp_rcvd#") AS "icp_rcvd#",
  stg.clean_numeric(r."icp_passed#") AS "icp_passed#",
  r."amb_sent#" AS "amb_sent#",
  r."amb_rcvd#" AS "amb_rcvd#",
  r."amb_pass#" AS "amb_pass#",
  stg.clean_int(r."progress_count") AS "progress_count",
  stg.clean_numeric(r."progress_percentage") AS "progress_percentage",
  stg.clean_numeric(r."progress_percentage_numeric") AS "progress_percentage_numeric",
  r."record_id" AS "record_id"
FROM raw."fabricdatabase" r;

DROP TABLE IF EXISTS stg."fabricmanager" CASCADE;
CREATE TABLE stg."fabricmanager" (
  "name" text,
  "name__title" text,
  "name__first" text,
  "name__middle" text,
  "name__last" text,
  "email" text,
  "password" text,
  "user_status" text,
  "user_roles" text,
  "record_id" text
);

TRUNCATE TABLE stg."fabricmanager";
INSERT INTO stg."fabricmanager"
SELECT
  r."name" AS "name",
  r."name__title" AS "name__title",
  r."name__first" AS "name__first",
  r."name__middle" AS "name__middle",
  r."name__last" AS "name__last",
  r."email" AS "email",
  r."password" AS "password",
  r."user_status" AS "user_status",
  r."user_roles" AS "user_roles",
  r."record_id" AS "record_id"
FROM raw."fabricmanager" r;

DROP TABLE IF EXISTS stg."factorymanager" CASCADE;
CREATE TABLE stg."factorymanager" (
  "name" text,
  "name__title" text,
  "name__first" text,
  "name__middle" text,
  "name__last" text,
  "email" text,
  "password" text,
  "user_status" text,
  "user_roles" text,
  "record_id" text
);

TRUNCATE TABLE stg."factorymanager";
INSERT INTO stg."factorymanager"
SELECT
  r."name" AS "name",
  r."name__title" AS "name__title",
  r."name__first" AS "name__first",
  r."name__middle" AS "name__middle",
  r."name__last" AS "name__last",
  r."email" AS "email",
  r."password" AS "password",
  r."user_status" AS "user_status",
  r."user_roles" AS "user_roles",
  r."record_id" AS "record_id"
FROM raw."factorymanager" r;

DROP TABLE IF EXISTS stg."labratories" CASCADE;
CREATE TABLE stg."labratories" (
  "labratory_name" text,
  "record_id" text
);

TRUNCATE TABLE stg."labratories";
INSERT INTO stg."labratories"
SELECT
  r."labratory_name" AS "labratory_name",
  r."record_id" AS "record_id"
FROM raw."labratories" r;

DROP TABLE IF EXISTS stg."notes" CASCADE;
CREATE TABLE stg."notes" (
  "date" date,
  "notes" text,
  "add_task_or_meeting" text,
  "task_or_meeting" text,
  "tasks_or_meeting_types" text,
  "task_meeting_due_date" date,
  "contact" text,
  "task_status" text,
  "task_update" date,
  "sales_rep" numeric,
  "record_id" text
);

TRUNCATE TABLE stg."notes";
INSERT INTO stg."notes"
SELECT
  stg.clean_date(r."date") AS "date",
  r."notes" AS "notes",
  r."add_task_or_meeting" AS "add_task_or_meeting",
  r."task_or_meeting" AS "task_or_meeting",
  r."tasks_or_meeting_types" AS "tasks_or_meeting_types",
  stg.clean_date(r."task_meeting_due_date") AS "task_meeting_due_date",
  r."contact" AS "contact",
  r."task_status" AS "task_status",
  stg.clean_date(r."task_update") AS "task_update",
  stg.clean_numeric(r."sales_rep") AS "sales_rep",
  r."record_id" AS "record_id"
FROM raw."notes" r;

DROP TABLE IF EXISTS stg."salesmanagers" CASCADE;
CREATE TABLE stg."salesmanagers" (
  "name" text,
  "name__title" text,
  "name__first" text,
  "name__middle" text,
  "name__last" text,
  "email" text,
  "password" text,
  "user_roles" text,
  "user_status" text,
  "record_id" text
);

TRUNCATE TABLE stg."salesmanagers";
INSERT INTO stg."salesmanagers"
SELECT
  r."name" AS "name",
  r."name__title" AS "name__title",
  r."name__first" AS "name__first",
  r."name__middle" AS "name__middle",
  r."name__last" AS "name__last",
  r."email" AS "email",
  r."password" AS "password",
  r."user_roles" AS "user_roles",
  r."user_status" AS "user_status",
  r."record_id" AS "record_id"
FROM raw."salesmanagers" r;

DROP TABLE IF EXISTS stg."salesreps" CASCADE;
CREATE TABLE stg."salesreps" (
  "name" text,
  "name__title" text,
  "name__first" text,
  "name__middle" text,
  "name__last" text,
  "email" text,
  "password" text,
  "sales_manager" numeric,
  "user_roles" text,
  "user_status" text,
  "record_id" text
);

TRUNCATE TABLE stg."salesreps";
INSERT INTO stg."salesreps"
SELECT
  r."name" AS "name",
  r."name__title" AS "name__title",
  r."name__first" AS "name__first",
  r."name__middle" AS "name__middle",
  r."name__last" AS "name__last",
  r."email" AS "email",
  r."password" AS "password",
  stg.clean_numeric(r."sales_manager") AS "sales_manager",
  r."user_roles" AS "user_roles",
  r."user_status" AS "user_status",
  r."record_id" AS "record_id"
FROM raw."salesreps" r;

DROP TABLE IF EXISTS stg."testingmanager" CASCADE;
CREATE TABLE stg."testingmanager" (
  "name" text,
  "name__title" text,
  "name__first" text,
  "name__middle" text,
  "name__last" text,
  "email" text,
  "password" text,
  "user_status" text,
  "user_roles" text,
  "record_id" text
);

TRUNCATE TABLE stg."testingmanager";
INSERT INTO stg."testingmanager"
SELECT
  r."name" AS "name",
  r."name__title" AS "name__title",
  r."name__first" AS "name__first",
  r."name__middle" AS "name__middle",
  r."name__last" AS "name__last",
  r."email" AS "email",
  r."password" AS "password",
  r."user_status" AS "user_status",
  r."user_roles" AS "user_roles",
  r."record_id" AS "record_id"
FROM raw."testingmanager" r;

DROP TABLE IF EXISTS stg."testreports" CASCADE;
CREATE TABLE stg."testreports" (
  "test_number" integer,
  "brand" text,
  "textile_mill" text,
  "fabric_database" text,
  "labratory" text,
  "fuze_fabric_number" integer,
  "wash" integer,
  "number_of_washes" integer,
  "test_method" text,
  "test_method_dropdown" text,
  "test_report_#" text,
  "tested_bacteria_#1" text,
  "antimicrobial_result_#1" numeric,
  "tested_bacteria" text,
  "tested_bacteria_#2" text,
  "antibacterial_result_#2" numeric,
  "written_result_fungal_testing" numeric,
  "tested_odor" text,
  "tested_metal" text,
  "icp_ag_result" numeric,
  "icp_au_result" numeric,
  "fuze_internal_report_#" text,
  "date" date,
  "date_post_wash" date,
  "testing_labratory" text,
  "fuze_application_date" date,
  "report_1" text,
  "report_1__url" text,
  "report_2" text,
  "report_2__url" text,
  "report_3" text,
  "report_3__url" text,
  "report_4" text,
  "report_4__url" text,
  "image" text,
  "image__url" text,
  "ag_serial_#" integer,
  "au_serial_#" integer,
  "fungal_serial_#" integer,
  "machine_type" text,
  "post_wash_report_#" integer,
  "ag" text,
  "record_id" text
);

TRUNCATE TABLE stg."testreports";
INSERT INTO stg."testreports"
SELECT
  stg.clean_int(r."test_number") AS "test_number",
  r."brand" AS "brand",
  r."textile_mill" AS "textile_mill",
  r."fabric_database" AS "fabric_database",
  r."labratory" AS "labratory",
  stg.clean_int(r."fuze_fabric_number") AS "fuze_fabric_number",
  stg.clean_int(r."wash") AS "wash",
  stg.clean_int(r."number_of_washes") AS "number_of_washes",
  r."test_method" AS "test_method",
  r."test_method_dropdown" AS "test_method_dropdown",
  r."test_report_#" AS "test_report_#",
  r."tested_bacteria_#1" AS "tested_bacteria_#1",
  stg.clean_numeric(r."antimicrobial_result_#1") AS "antimicrobial_result_#1",
  r."tested_bacteria" AS "tested_bacteria",
  r."tested_bacteria_#2" AS "tested_bacteria_#2",
  stg.clean_numeric(r."antibacterial_result_#2") AS "antibacterial_result_#2",
  stg.clean_numeric(r."written_result_fungal_testing") AS "written_result_fungal_testing",
  r."tested_odor" AS "tested_odor",
  r."tested_metal" AS "tested_metal",
  stg.clean_numeric(r."icp_ag_result") AS "icp_ag_result",
  stg.clean_numeric(r."icp_au_result") AS "icp_au_result",
  r."fuze_internal_report_#" AS "fuze_internal_report_#",
  stg.clean_date(r."date") AS "date",
  stg.clean_date(r."date_post_wash") AS "date_post_wash",
  r."testing_labratory" AS "testing_labratory",
  stg.clean_date(r."fuze_application_date") AS "fuze_application_date",
  r."report_1" AS "report_1",
  r."report_1__url" AS "report_1__url",
  r."report_2" AS "report_2",
  r."report_2__url" AS "report_2__url",
  r."report_3" AS "report_3",
  r."report_3__url" AS "report_3__url",
  r."report_4" AS "report_4",
  r."report_4__url" AS "report_4__url",
  r."image" AS "image",
  r."image__url" AS "image__url",
  stg.clean_int(r."ag_serial_#") AS "ag_serial_#",
  stg.clean_int(r."au_serial_#") AS "au_serial_#",
  stg.clean_int(r."fungal_serial_#") AS "fungal_serial_#",
  r."machine_type" AS "machine_type",
  stg.clean_int(r."post_wash_report_#") AS "post_wash_report_#",
  r."ag" AS "ag",
  r."record_id" AS "record_id"
FROM raw."testreports" r;

DROP TABLE IF EXISTS stg."textilemills" CASCADE;
CREATE TABLE stg."textilemills" (
  "company" text,
  "chinese_company_name" text,
  "texile_mill_type" text,
  "specialty" text,
  "purchasing" text,
  "annual_sales" numeric,
  "lead_referral_source" text,
  "date_of_initial_contact" date,
  "title" text,
  "contact" text,
  "contact__title" text,
  "contact__first" text,
  "contact__middle" text,
  "contact__last" text,
  "address" text,
  "address__street_1" text,
  "address__street_2" text,
  "address__city" text,
  "address__state" text,
  "address__zip" text,
  "address__country" integer,
  "address__latitude" text,
  "address__longitude" text,
  "country_map" integer,
  "secondary_country" integer,
  "phone" text,
  "email" text,
  "website" text,
  "sales_rep" numeric,
  "development" text,
  "presentation_complete" text,
  "customer_type" text,
  "brand_nominated" text,
  "record_id" text
);

TRUNCATE TABLE stg."textilemills";
INSERT INTO stg."textilemills"
SELECT
  r."company" AS "company",
  r."chinese_company_name" AS "chinese_company_name",
  r."texile_mill_type" AS "texile_mill_type",
  r."specialty" AS "specialty",
  r."purchasing" AS "purchasing",
  stg.clean_numeric(r."annual_sales") AS "annual_sales",
  r."lead_referral_source" AS "lead_referral_source",
  stg.clean_date(r."date_of_initial_contact") AS "date_of_initial_contact",
  r."title" AS "title",
  r."contact" AS "contact",
  r."contact__title" AS "contact__title",
  r."contact__first" AS "contact__first",
  r."contact__middle" AS "contact__middle",
  r."contact__last" AS "contact__last",
  r."address" AS "address",
  r."address__street_1" AS "address__street_1",
  r."address__street_2" AS "address__street_2",
  r."address__city" AS "address__city",
  r."address__state" AS "address__state",
  r."address__zip" AS "address__zip",
  stg.clean_int(r."address__country") AS "address__country",
  r."address__latitude" AS "address__latitude",
  r."address__longitude" AS "address__longitude",
  stg.clean_int(r."country_map") AS "country_map",
  stg.clean_int(r."secondary_country") AS "secondary_country",
  r."phone" AS "phone",
  r."email" AS "email",
  r."website" AS "website",
  stg.clean_numeric(r."sales_rep") AS "sales_rep",
  r."development" AS "development",
  r."presentation_complete" AS "presentation_complete",
  r."customer_type" AS "customer_type",
  r."brand_nominated" AS "brand_nominated",
  r."record_id" AS "record_id"
FROM raw."textilemills" r;
