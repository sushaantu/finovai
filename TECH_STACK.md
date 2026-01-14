# FinovAI Tech Stack

## Overview
FinovAI is a Spanish-language financial coaching platform built as a full-stack serverless application on Cloudflare's edge infrastructure.

---

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2 | UI framework |
| **TypeScript** | 5.9 | Type safety |
| **Vite** | 7.3 | Build tool & dev server |
| **Tailwind CSS** | 4.1 | Utility-first styling |
| **Motion (Framer)** | 12.26 | Animations |
| **Lucide React** | 0.562 | Icons |
| **Radix UI** | - | Accessible primitives |
| **class-variance-authority** | 0.7 | Component variants |

**Key UI Libraries:**
- `react-device-mockup` - iPhone mockup for hero section
- `tailwind-merge` + `clsx` - Conditional class handling

---

## Backend

| Technology | Purpose |
|------------|---------|
| **Cloudflare Workers** | Serverless compute (edge) |
| **Cloudflare D1** | SQLite database (edge) |
| **Cloudflare Workers AI** | LLM inference |
| **Twilio WhatsApp API** | OTP delivery |

**AI Model:**
- `@cf/meta/llama-3.1-8b-instruct` (Meta Llama 3.1 8B)
- Runs on Cloudflare's edge network
- 500 max tokens per response

---

## Database Schema (D1/SQLite)

| Table | Purpose | Status |
|-------|---------|--------|
| `users` | Phone-based user accounts | Active |
| `sessions` | Auth session tokens (30-day expiry) | Active |
| `otp_verifications` | WhatsApp OTP codes | Active |
| `conversations` | Chat threads | Active |
| `messages` | Chat messages with AI responses | Active |
| `conversation_participants` | Access control | Active |
| `couples` | Partner linking | Planned |
| `leads` | Legacy email signups | Legacy |
| `chat_sessions` | Legacy chat storage | Legacy |

---

## Infrastructure

| Service | Purpose |
|---------|---------|
| **Cloudflare Workers** | API + static hosting |
| **Cloudflare D1** | Database |
| **Cloudflare Workers AI** | LLM |
| **Custom Domain** | finov.ai |

---

## API Endpoints

### Auth
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/auth/send-otp` | Send WhatsApp OTP | Active |
| POST | `/api/auth/verify-otp` | Verify & login | Active |
| GET | `/api/auth/me` | Get current user | Active |
| POST | `/api/auth/logout` | End session | Active |

### User
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| PATCH | `/api/users/me` | Update profile | Active |

### Chat (Authenticated)
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/api/conversations` | List conversations | Active |
| POST | `/api/conversations` | Create conversation | Active |
| GET | `/api/conversations/:id/messages` | Get messages | Active |
| POST | `/api/conversations/:id/messages` | Send message | Active |

### Legacy
| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/chat` | Guest chat (no auth) | Active |
| POST | `/api/signup` | Email lead signup | Legacy |
| GET | `/api/health` | Health check | Active |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client                              │
│   React + Tailwind + Motion (Vite build → dist/)        │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Edge)                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │              worker/index.ts                     │    │
│  │  • Static asset serving (ASSETS binding)        │    │
│  │  • REST API handlers                            │    │
│  │  • Auth middleware                              │    │
│  └──────┬──────────────────┬──────────────────────┘    │
│         │                  │                            │
│         ▼                  ▼                            │
│  ┌────────────┐    ┌─────────────┐    ┌────────────┐   │
│  │  D1 (SQL)  │    │ Workers AI  │    │  Twilio    │   │
│  │  Database  │    │ Llama 3.1   │    │ WhatsApp   │   │
│  └────────────┘    └─────────────┘    └────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Development

### Commands
```bash
bun run dev           # Frontend dev server (port 5173)
bunx wrangler dev     # Backend dev server (port 8788)
bun run build         # Production build
bun run worker:deploy # Deploy to Cloudflare
bun run db:migrate    # Run DB migrations (remote)
bun run db:migrate:local # Run DB migrations (local)
```

### Local Development
Requires two terminals:
1. `bun run dev` - Vite frontend with proxy to worker
2. `bunx wrangler dev --port 8788` - Worker backend

Vite proxy forwards `/api/*` requests to the worker.

---

## Current Status

### Active Features
- Landing page with financial coaching positioning
- Guest chat (no login required) with AI advisor
- Phone + WhatsApp OTP authentication
- Persistent conversations for logged-in users
- User profile management

### Legacy Code (May Remove Later)
| Item | Notes |
|------|-------|
| `POST /api/signup` | Email lead capture |
| `leads` table | Email signups |
| `chat_sessions` table | Old chat storage |

---

## Roadmap

### Phase 1: Foundation (Completed)
- [x] Landing page design
- [x] AI chat integration (Cloudflare Workers AI)
- [x] Database schema (D1)
- [x] Phone + OTP authentication
- [x] Conversation persistence
- [x] Slide-in chat sidebar UI

### Phase 2: Enhanced Chat (Current)
- [x] Guest chat without login
- [x] Value exchange flow (chat → offer report → request phone)
- [x] Clean up unused code
- [ ] Improve AI responses quality

### Phase 3: Real-Time Features
- [ ] Durable Objects for WebSocket connections
- [ ] Typing indicators
- [ ] Online/offline presence
- [ ] Instant message delivery (no polling)

### Phase 4: Couple Feature
- [ ] Invite partner via WhatsApp
- [ ] Accept invitation flow
- [ ] Shared conversations (couple_ai)
- [ ] Private conversations within couple
- [ ] Partner presence indicators

### Phase 5: Mobile
- [ ] iOS app (Swift/SwiftUI)
- [ ] Same API, native experience
- [ ] Push notifications
- [ ] Biometric auth

### Phase 6: Premium Features
- [ ] Detailed financial reports
- [ ] Goal tracking
- [ ] Budget categories
- [ ] Bank connection (Plaid/Belvo)
- [ ] Subscription model

---

## Model Considerations

**Current:** Cloudflare Workers AI - Llama 3.1 8B
- Pros: Free, low latency, no API keys
- Cons: Smaller model, inconsistent Spanish

**Future Options:**
| Provider | Model | Pros | Cons |
|----------|-------|------|------|
| Cloudflare | Llama 3.3 70B | Larger, smarter | Slower, cost |
| OpenAI | GPT-4o-mini | Great quality | API cost, latency |
| Anthropic | Claude 3 Haiku | Fast, good Spanish | API cost |
| Anthropic | Claude 3.5 Sonnet | Best quality | Higher cost |

---

## Infrastructure Costs

**Current (Free Tier):**
- Cloudflare Workers: 100k requests/day free
- Cloudflare D1: 5M rows read/day, 100k writes/day free
- Workers AI: 10k neurons/day free

**Paid Services:**
- Twilio WhatsApp: ~$0.05 per OTP message
- Custom domain: ~$10/year
