-- Marine Intelligence Indonesia CRM
-- PostgreSQL schema for AWS RDS

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    industry TEXT,
    contact_person TEXT,
    position TEXT,
    province TEXT,
    home_port TEXT,
    fleet_size INTEGER,
    annual_operating_hours NUMERIC,
    decision_maker TEXT,
    current_supplier TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vessels (
    vessel_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    boat_name TEXT,
    builder TEXT,
    year_built INTEGER,
    length_m NUMERIC,
    beam_m NUMERIC,
    hull_material TEXT,
    hull_type TEXT,
    passenger_capacity INTEGER,
    fuel_tank_l NUMERIC,
    home_port TEXT,
    typical_route TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE engines (
    engine_id TEXT PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    hp NUMERIC NOT NULL,
    serial_number TEXT,
    install_date DATE,
    engine_hours NUMERIC,
    gear_ratio TEXT,
    propeller TEXT,
    warranty_expiry DATE,
    fuel_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trips (
    trip_id TEXT PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
    trip_date DATE NOT NULL,
    captain TEXT,
    operating_hours NUMERIC NOT NULL,
    distance_nm NUMERIC,
    average_speed_kn NUMERIC,
    fuel_used_l NUMERIC,
    fuel_price_per_l NUMERIC,
    electricity_kwh NUMERIC,
    weather TEXT,
    sea_state TEXT,
    payload TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance (
    maintenance_id TEXT PRIMARY KEY,
    engine_id TEXT NOT NULL REFERENCES engines(engine_id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    engine_hours NUMERIC,
    service_type TEXT,
    parts_replaced TEXT,
    labor_cost NUMERIC,
    parts_cost NUMERIC,
    downtime_hours NUMERIC,
    warranty_claim TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quotes (
    quote_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    quote_date DATE,
    current_setup TEXT,
    recommended_setup TEXT,
    capex NUMERIC,
    estimated_annual_savings NUMERIC,
    payback_years NUMERIC,
    outcome TEXT,
    objections TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE repowering (
    project_id TEXT PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
    old_setup TEXT,
    new_setup TEXT,
    expected_savings NUMERIC,
    actual_savings NUMERIC,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE batteries (
    battery_id TEXT PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
    brand TEXT,
    model TEXT,
    capacity_kwh NUMERIC,
    cycles INTEGER,
    soh_percent NUMERIC,
    average_temperature_c NUMERIC,
    charge_source TEXT,
    failure_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fuel_prices (
    record_id TEXT PRIMARY KEY,
    price_date DATE NOT NULL,
    region TEXT NOT NULL,
    fuel_type TEXT NOT NULL,
    price_per_unit NUMERIC NOT NULL,
    unit TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE market_intel (
    record_id TEXT PRIMARY KEY,
    intel_date DATE NOT NULL,
    brand TEXT,
    product TEXT,
    price NUMERIC,
    dealer TEXT,
    region TEXT,
    intel_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vessels_customer_id ON vessels(customer_id);
CREATE INDEX idx_engines_vessel_id ON engines(vessel_id);
CREATE INDEX idx_trips_vessel_id ON trips(vessel_id);
CREATE INDEX idx_maintenance_engine_id ON maintenance(engine_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_repowering_vessel_id ON repowering(vessel_id);
CREATE INDEX idx_batteries_vessel_id ON batteries(vessel_id);
CREATE INDEX idx_fuel_prices_region_date ON fuel_prices(region, price_date);
CREATE INDEX idx_market_intel_date ON market_intel(intel_date);
