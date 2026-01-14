-- FinovAI D1 Database Schema

-- Leads table: stores user signups from chatbot
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  diagnostic_data TEXT, -- JSON string with chat history/insights
  stage TEXT DEFAULT 'stage_0', -- Current financial stage (stage_0, stage_1, stage_2)
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Chat sessions table: stores conversation history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  session_id TEXT NOT NULL UNIQUE,
  messages TEXT NOT NULL, -- JSON array of messages
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lead_id ON chat_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
