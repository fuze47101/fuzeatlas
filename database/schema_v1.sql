-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- BRANDS
-- =====================================

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    customer_type TEXT,
    status TEXT,
    sales_rep TEXT,
    legacy_knack_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- TEXTILE MILLS
-- =====================================

CREATE TABLE textile_mills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    mill_type TEXT,
    country TEXT,
    specialty TEXT,
    legacy_knack_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- LABS
-- =====================================

CREATE TABLE labs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_name TEXT NOT NULL, -- SGS, Intertek, etc.
    country TEXT,
    city TEXT,
    legacy_knack_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- FABRICS
-- =====================================

CREATE TYPE fabric_origin_enum AS ENUM ('PRE_ATLAS', 'ATLAS_NATIVE');

CREATE TABLE fabrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES brands(id),
    customer_fabric_code TEXT,
    factory_fabric_code TEXT,
    construction_description TEXT,
    color TEXT,
    weight_gsm NUMERIC,
    fiber_1 TEXT,
    fiber_1_percent NUMERIC,
    fiber_2 TEXT,
    fiber_2_percent NUMERIC,
    fiber_3 TEXT,
    fiber_3_percent NUMERIC,
    category TEXT,
    program_name TEXT,
    fabric_origin fabric_origin_enum DEFAULT 'ATLAS_NATIVE',
    is_placeholder BOOLEAN DEFAULT FALSE,
    legacy_knack_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- APPLICATIONS
-- =====================================

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fabric_id UUID REFERENCES fabrics(id),
    textile_mill_id UUID REFERENCES textile_mills(id),
    fuze_product TEXT,
    application_method TEXT,
    recipe TEXT,
    treatment_location TEXT,
    application_date DATE,
    is_production BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- LAB PACKETS
-- =====================================

CREATE TABLE lab_packets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),
    lab_id UUID REFERENCES labs(id),
    report_number TEXT NOT NULL,
    test_method TEXT,
    date_submitted DATE,
    date_received DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- WASH RESULTS
-- =====================================

CREATE TABLE wash_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_packet_id UUID REFERENCES lab_packets(id),
    wash_cycle INTEGER NOT NULL,
    icp_ag_mgkg NUMERIC,
    icp_au_mgkg NUMERIC,
    bacteria TEXT,
    reduction_percent NUMERIC,
    reduction_type TEXT DEFAULT 'percent', -- percent or log
    fungal_result_text TEXT,
    pass_fail BOOLEAN,
    serial_number TEXT,
    machine_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- FUZE GLOBAL CRITERIA
-- =====================================

CREATE TABLE fuze_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_method TEXT,
    bacteria TEXT,
    minimum_reduction_percent NUMERIC,
    minimum_icp_mgkg NUMERIC,
    wash_cycle INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- BRAND CRITERIA
-- =====================================

CREATE TABLE brand_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES brands(id),
    test_method TEXT,
    bacteria TEXT,
    minimum_reduction_percent NUMERIC,
    minimum_icp_mgkg NUMERIC,
    wash_cycle INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================
-- EVALUATION VERSIONS
-- =====================================

CREATE TABLE evaluation_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);

-- =====================================
-- EVALUATION RESULTS (MATERIALIZED)
-- =====================================

CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wash_result_id UUID REFERENCES wash_results(id),
    evaluation_version_id UUID REFERENCES evaluation_versions(id),
    fuze_pass BOOLEAN,
    brand_pass BOOLEAN,
    brand_id UUID REFERENCES brands(id),
    evaluated_at TIMESTAMP DEFAULT NOW()
);
