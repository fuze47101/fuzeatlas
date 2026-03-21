-- AUTO-GENERATED: raw staging tables from CSV headers
CREATE SCHEMA IF NOT EXISTS raw;

DROP TABLE IF EXISTS raw."brands" CASCADE;
CREATE TABLE raw."brands" (
  "company" TEXT,
  "customer_type" TEXT,
  "status" TEXT,
  "lead_referral_source" TEXT,
  "date_of_initial_contact" TEXT,
  "title" TEXT,
  "contact" TEXT,
  "contact__title" TEXT,
  "contact__first" TEXT,
  "contact__middle" TEXT,
  "contact__last" TEXT,
  "address" TEXT,
  "address__street_1" TEXT,
  "address__street_2" TEXT,
  "address__city" TEXT,
  "address__state" TEXT,
  "address__zip" TEXT,
  "address__country" TEXT,
  "address__latitude" TEXT,
  "address__longitude" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "linkedin_profile" TEXT,
  "background_info" TEXT,
  "sales_rep" TEXT,
  "project_type" TEXT,
  "project_description" TEXT,
  "presentation_date" TEXT,
  "forecast" TEXT,
  "deliverables" TEXT,
  "column_5" TEXT,
  "column_6" TEXT,
  "column_7" TEXT,
  "column_8" TEXT,
  "column_9" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."distributors" CASCADE;
CREATE TABLE raw."distributors" (
  "company" TEXT,
  "chinese_company_name" TEXT,
  "specialty" TEXT,
  "agent_for_fuze" TEXT,
  "annual_sales" TEXT,
  "date_of_initial_contact" TEXT,
  "title" TEXT,
  "contact" TEXT,
  "contact__title" TEXT,
  "contact__first" TEXT,
  "contact__middle" TEXT,
  "contact__last" TEXT,
  "address" TEXT,
  "address__street_1" TEXT,
  "address__street_2" TEXT,
  "address__city" TEXT,
  "address__state" TEXT,
  "address__zip" TEXT,
  "address__country" TEXT,
  "address__latitude" TEXT,
  "address__longitude" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "sales_rep" TEXT,
  "country" TEXT,
  "distributor" TEXT,
  "for_fuze" TEXT,
  "country_2" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."fabricdatabase" CASCADE;
CREATE TABLE raw."fabricdatabase" (
  "fuze_fabric_#" TEXT,
  "wash" TEXT,
  "customer_fabric_code" TEXT,
  "factory_fabric_code" TEXT,
  "brand" TEXT,
  "textile_mill_treatment" TEXT,
  "application_method" TEXT,
  "application_recipe" TEXT,
  "fabric_content_#1" TEXT,
  "content_1" TEXT,
  "fabric_content_#2" TEXT,
  "content_2" TEXT,
  "fabric_content_#3" TEXT,
  "content_3" TEXT,
  "fabric_finish_note" TEXT,
  "fabric_construction_description" TEXT,
  "fabric_color" TEXT,
  "fuze_treatment_location" TEXT,
  "fuze_application_date" TEXT,
  "fabric_submission_document" TEXT,
  "fabric_submission_document__url" TEXT,
  "fabric_submission_image" TEXT,
  "fabric_submission_image__url" TEXT,
  "textile_mill" TEXT,
  "full_width" TEXT,
  "weight_gsm" TEXT,
  "yarn_filament" TEXT,
  "note" TEXT,
  "fuze_application_date_2" TEXT,
  "fuze_treatment_location_2" TEXT,
  "weight_gsm_2" TEXT,
  "pad_recipe" TEXT,
  "production_trial_completed" TEXT,
  "icp_sent" TEXT,
  "icp_rcvd" TEXT,
  "icp_passed" TEXT,
  "amb_sent" TEXT,
  "amb_rcvd" TEXT,
  "amb_pass" TEXT,
  "category" TEXT,
  "program_name" TEXT,
  "status_note" TEXT,
  "status" TEXT,
  "ptc#" TEXT,
  "icp_sent#" TEXT,
  "icp_rcvd#" TEXT,
  "icp_passed#" TEXT,
  "amb_sent#" TEXT,
  "amb_rcvd#" TEXT,
  "amb_pass#" TEXT,
  "progress_count" TEXT,
  "progress_percentage" TEXT,
  "progress_percentage_numeric" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."fabricmanager" CASCADE;
CREATE TABLE raw."fabricmanager" (
  "name" TEXT,
  "name__title" TEXT,
  "name__first" TEXT,
  "name__middle" TEXT,
  "name__last" TEXT,
  "email" TEXT,
  "password" TEXT,
  "user_status" TEXT,
  "user_roles" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."factorymanager" CASCADE;
CREATE TABLE raw."factorymanager" (
  "name" TEXT,
  "name__title" TEXT,
  "name__first" TEXT,
  "name__middle" TEXT,
  "name__last" TEXT,
  "email" TEXT,
  "password" TEXT,
  "user_status" TEXT,
  "user_roles" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."labratories" CASCADE;
CREATE TABLE raw."labratories" (
  "labratory_name" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."notes" CASCADE;
CREATE TABLE raw."notes" (
  "date" TEXT,
  "notes" TEXT,
  "add_task_or_meeting" TEXT,
  "task_or_meeting" TEXT,
  "tasks_or_meeting_types" TEXT,
  "task_meeting_due_date" TEXT,
  "contact" TEXT,
  "task_status" TEXT,
  "task_update" TEXT,
  "sales_rep" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."salesmanagers" CASCADE;
CREATE TABLE raw."salesmanagers" (
  "name" TEXT,
  "name__title" TEXT,
  "name__first" TEXT,
  "name__middle" TEXT,
  "name__last" TEXT,
  "email" TEXT,
  "password" TEXT,
  "user_roles" TEXT,
  "user_status" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."salesreps" CASCADE;
CREATE TABLE raw."salesreps" (
  "name" TEXT,
  "name__title" TEXT,
  "name__first" TEXT,
  "name__middle" TEXT,
  "name__last" TEXT,
  "email" TEXT,
  "password" TEXT,
  "sales_manager" TEXT,
  "user_roles" TEXT,
  "user_status" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."testingmanager" CASCADE;
CREATE TABLE raw."testingmanager" (
  "name" TEXT,
  "name__title" TEXT,
  "name__first" TEXT,
  "name__middle" TEXT,
  "name__last" TEXT,
  "email" TEXT,
  "password" TEXT,
  "user_status" TEXT,
  "user_roles" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."testreports" CASCADE;
CREATE TABLE raw."testreports" (
  "test_number" TEXT,
  "brand" TEXT,
  "textile_mill" TEXT,
  "fabric_database" TEXT,
  "labratory" TEXT,
  "fuze_fabric_number" TEXT,
  "wash" TEXT,
  "number_of_washes" TEXT,
  "test_method" TEXT,
  "test_method_dropdown" TEXT,
  "test_report_#" TEXT,
  "tested_bacteria_#1" TEXT,
  "antimicrobial_result_#1" TEXT,
  "tested_bacteria" TEXT,
  "tested_bacteria_#2" TEXT,
  "antibacterial_result_#2" TEXT,
  "written_result_fungal_testing" TEXT,
  "tested_odor" TEXT,
  "tested_metal" TEXT,
  "icp_ag_result" TEXT,
  "icp_au_result" TEXT,
  "fuze_internal_report_#" TEXT,
  "date" TEXT,
  "date_post_wash" TEXT,
  "testing_labratory" TEXT,
  "fuze_application_date" TEXT,
  "report_1" TEXT,
  "report_1__url" TEXT,
  "report_2" TEXT,
  "report_2__url" TEXT,
  "report_3" TEXT,
  "report_3__url" TEXT,
  "report_4" TEXT,
  "report_4__url" TEXT,
  "image" TEXT,
  "image__url" TEXT,
  "ag_serial_#" TEXT,
  "au_serial_#" TEXT,
  "fungal_serial_#" TEXT,
  "machine_type" TEXT,
  "post_wash_report_#" TEXT,
  "ag" TEXT,
  "record_id" TEXT
);

DROP TABLE IF EXISTS raw."textilemills" CASCADE;
CREATE TABLE raw."textilemills" (
  "company" TEXT,
  "chinese_company_name" TEXT,
  "texile_mill_type" TEXT,
  "specialty" TEXT,
  "purchasing" TEXT,
  "annual_sales" TEXT,
  "lead_referral_source" TEXT,
  "date_of_initial_contact" TEXT,
  "title" TEXT,
  "contact" TEXT,
  "contact__title" TEXT,
  "contact__first" TEXT,
  "contact__middle" TEXT,
  "contact__last" TEXT,
  "address" TEXT,
  "address__street_1" TEXT,
  "address__street_2" TEXT,
  "address__city" TEXT,
  "address__state" TEXT,
  "address__zip" TEXT,
  "address__country" TEXT,
  "address__latitude" TEXT,
  "address__longitude" TEXT,
  "country_map" TEXT,
  "secondary_country" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "sales_rep" TEXT,
  "development" TEXT,
  "presentation_complete" TEXT,
  "customer_type" TEXT,
  "brand_nominated" TEXT,
  "record_id" TEXT
);
