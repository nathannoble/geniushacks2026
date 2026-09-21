-- Synthetic Screening Reference Data (M4). Entirely fictitious names —
-- for hackathon demo/testing only, not a real sanctions or PEP list.

CREATE TABLE IF NOT EXISTS watchlist_entries (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,   -- 'individual' | 'organization'
    list_name   TEXT NOT NULL    -- synthetic list label
);

INSERT INTO watchlist_entries (name, entity_type, list_name) VALUES
    ('Marcus J. Holloway', 'individual', 'Synthetic Sanctions List'),
    ('Elena Voskresenskaya', 'individual', 'Synthetic Sanctions List'),
    ('Rafael Dominguez Ortiz', 'individual', 'Synthetic Sanctions List'),
    ('Katarzyna Wojciechowska', 'individual', 'Synthetic Sanctions List'),
    ('Tobias Ferreira Lima', 'individual', 'Synthetic Sanctions List'),
    ('Northgate Trading Consortium', 'organization', 'Synthetic Sanctions List'),
    ('Meridian Overseas Holdings Ltd', 'organization', 'Synthetic Sanctions List'),
    ('Silverline Import Export Co', 'organization', 'Synthetic Sanctions List'),
    ('Vasquez-Reyes Family Trust', 'organization', 'Synthetic Sanctions List'),
    ('Amara Chukwuemeka Obi', 'individual', 'Synthetic PEP List'),
    ('Dmitri Alexandrovich Volkov', 'individual', 'Synthetic PEP List'),
    ('Priya Ramaswamy Krishnan', 'individual', 'Synthetic PEP List'),
    ('Jean-Baptiste Moreau-Laurent', 'individual', 'Synthetic PEP List'),
    ('Cascade Ridge Holdings LLC', 'organization', 'Synthetic Adverse Media List'),
    ('Blackstone Harbor Ventures', 'organization', 'Synthetic Adverse Media List'),
    ('Yusuf Abdirahman Hassan', 'individual', 'Synthetic Adverse Media List'),
    ('Wen-Chi Chang', 'individual', 'Synthetic Adverse Media List'),
    ('Olumide Bankole Adeyemi', 'individual', 'Synthetic Sanctions List'),
    ('Ingrid Larsen-Hoff', 'individual', 'Synthetic PEP List'),
    ('Redwood Capital Partners Inc', 'organization', 'Synthetic Adverse Media List'),
    ('Alessandro Ricci Bianchi', 'individual', 'Synthetic Sanctions List'),
    ('Nadia Farouk El-Sayed', 'individual', 'Synthetic PEP List'),
    ('Summit Peak Vendor Services', 'organization', 'Synthetic Vendor-Risk List'),
    ('Harborview Logistics Group', 'organization', 'Synthetic Vendor-Risk List'),
    ('Grzegorz Nowakowski', 'individual', 'Synthetic Sanctions List')
ON CONFLICT (name) DO NOTHING;
