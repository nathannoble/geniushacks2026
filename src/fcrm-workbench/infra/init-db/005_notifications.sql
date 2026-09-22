-- M9 Case & Notification Service: the notification log every persona
-- transition writes to, and what the Workbench UI reads for case status.

CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    case_id     TEXT NOT NULL REFERENCES cases(case_id),
    persona     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    message     TEXT NOT NULL,
    channel     TEXT NOT NULL DEFAULT 'log',  -- 'log' | 'webhook'
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON notifications (case_id);
