DROP INDEX IF EXISTS idx_transactions_email_date;
DROP INDEX IF EXISTS idx_transactions_email_source;

ALTER TABLE transactions RENAME TO transactions_legacy_source_constraint;

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  notes TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'cartola', 'syncfy')),
  confidence REAL NOT NULL DEFAULT 1,
  raw_source TEXT,
  cartola_import_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (email) REFERENCES financial_profiles(email),
  FOREIGN KEY (cartola_import_id) REFERENCES cartola_imports(id)
);

INSERT INTO transactions (
  id, email, date, type, amount, currency, category, description, merchant, notes,
  source, confidence, raw_source, cartola_import_id, created_at, updated_at
)
SELECT
  id, email, date, type, amount, currency, category, description, merchant, notes,
  source, confidence, raw_source, cartola_import_id, created_at, updated_at
FROM transactions_legacy_source_constraint;

DROP TABLE transactions_legacy_source_constraint;

CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON transactions(email, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_email_source ON transactions(email, source);
