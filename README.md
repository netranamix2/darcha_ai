# Darcha

One AI core for citizen inquiries to the Ministry of Education and Science of Uzbekistan
(Umummilliy AI Xakaton, Tashkent stage, problem #1). Telegram, website chat and Instagram all go through
the same pipeline. Typical questions get an answer in seconds **with a link to the regulation**. Unclear,
sensitive and personal cases go to a human as a draft or a ticket with a legal deadline. The whole flow
feeds a weekly FAQ report.

## Architecture

```
Telegram (DM, channel comments, @mentions) ─┐
Website chat  (/api/chat/*)                 ├─► InboundMessage ─► pipeline (one for all channels)
Instagram (comments, Direct, tags) / sim. ──┘
                                                1 normalize: language + script, Cyrillic→Latin, mask PINFL/passport/phone/card
                                                2 classify (LLM, JSON): type, topic, region, sentiment, urgency, flags   ┐ in
                                                3 search: bge-m3 vectors top-8 + full-text top-8 → RRF → reranker → top-4 │ parallel
                                                4 answer (LLM, JSON) ONLY from the fragments, with citations             ┘
                                                5 verify in code: every citation must be a retrieved, active document
                                                6 level: 🟢 auto-answer · 🟡 draft for approval · 🔴 ticket (number + legal deadline)
                                                7 deliver to the same channel + store for analytics
PostgreSQL + pgvector ◄─────────────────────────────────────────────────────────────────────────────────
  └─ background jobs (in-process): SLA reminders/escalation · spike alerts · weekly FAQ report (HDBSCAN + LLM)
```

Level rules: `backend/app/pipeline/route.py` (unit-tested). Thresholds are set in `.env` and tuned with `run_eval.py`.

## Quick start (local, GPU)

```bash
cp .env.example .env                      # ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, ...
docker compose up -d db                   # Postgres 17 + pgvector
cd backend && uv venv -p 3.12 && uv pip install -r pyproject.toml --extra dev && cd ..
backend/.venv/bin/python scripts/ingest_docs.py data/documents
backend/.venv/bin/python scripts/run_eval.py data/eval/questions.jsonl
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Swagger: http://localhost:8000/docs. Demo logins (change before any real use): `operator/operator123`,
`specialist/specialist123`, `teachers/teachers123`, `manager/manager123`, `kbadmin/kbadmin123`.

Everything in Docker (CPU): `docker compose up -d`.

## API for the frontend
| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/chat/sessions` | site chat | `{session_id}` (keep in localStorage) |
| POST | `/api/chat/messages` | site chat | `{session_id, text}` → `{message_id, answer, citations[{title,ref,url}], level, ticket_number?, due_at?}` |
| GET | `/api/chat/sessions/{id}/messages` | site chat | history; poll every 5–10 s (specialist answers and approved drafts appear here) |
| POST | `/api/chat/messages/{id}/rating` | site chat | `{rating: 1..5}` |
| POST | `/api/chat/voice` | site chat | multipart `session_id` + `audio` → same as `/messages` + `transcript` (needs `ENABLE_VOICE=1`) |
| POST | `/api/auth/login` | panel | `{username, password}` → `{access_token, role, user}`; then `Authorization: Bearer …` |
| GET | `/api/inbox?level=yellow&status=draft` | panel | drafts to approve |
| POST | `/api/responses/{id}/approve` · `/reject` · `/edit` | panel | approve (optionally with edited `text`) and send · reject (+ticket) · edit draft |
| GET/PATCH | `/api/tickets`, `/api/tickets/{id}` | panel | list (filters `status`, `department_id`, `overdue`) · detail with history · change status/assignee/department/priority |
| POST | `/api/tickets/{id}/answer` | specialist | `{text, add_to_kb}` → sent to the citizen's original channel |
| POST | `/api/panel/draft` | panel | Virtual Reception mode: paste text → draft + citations |
| GET | `/api/analytics/summary?from=&to=` | dashboard | volumes by channel/level/type, sentiment, regions, topics, p50/p95 response time, tickets, rating |
| GET | `/api/reports/faq?period=week` · POST `/api/reports/faq/run` | dashboard | FAQ report: clusters, what is unclear, trend, clarification drafts |
| GET/POST/PATCH | `/api/documents…` | KB admin | list · upload · reindex · `status=repealed` |
| POST | `/api/ask` | tests | question → full result incl. debug (retrieval scores, classification) |
| GET/POST | `/api/dev/instagram/feed` · `/comments` · `/dm` · `/posts` | demo | Instagram mock-profile simulator |
| POST | `/webhooks/telegram`, GET/POST `/webhooks/meta` | Telegram, Meta | webhooks (secret token / X-Hub-Signature-256 checked) |

`level`: `green` = AI answer · `none` = ignored (spam/abuse, empty `answer`; show nothing) · `yellow` = staff is preparing the answer (`answer` is empty) · `red` = ticket (`ticket_number`, `due_at`).

## Channels
- **Telegram:** `TELEGRAM_MODE=polling` needs no public URL. For channel comments, add the bot as an admin to the channel's discussion group and turn privacy mode off in @BotFather. In groups the bot answers when it is mentioned or someone replies to it.
- **Instagram:** a professional demo account + a Meta app in development mode. Webhook `https://<host>/webhooks/meta` subscribed to `comments`, `mentions`, `messages`. Graph API endpoints are in `backend/app/adapters/meta.py`; verify them against the current Meta docs when connecting. Without the Meta app, use the simulator (`/api/dev/instagram/*`), which runs the same pipeline.

## Tests and metrics
`cd backend && .venv/bin/pytest -q` covers the routing rules, citation verification, chunking, transliteration, PII masking and Meta parsing/signature.
`scripts/run_eval.py` reports answer accuracy, retrieval top-4, level correctness, honest refusals, p50/p95 latency and per-language accuracy. It also checks that **0** messages from `data/eval/harmful.jsonl` get the green level.

## Known limits (be upfront with the jury)
- Names (FIO) are not masked by regex, only IDs, phones, cards and emails. Plan: an NER model.
- No Redis queue on the hackathon. Work runs in-process, and the adapter→`InboundMessage`→pipeline boundary is where a queue plugs in.
- Ticket deadlines default to 15 days (5 for urgent). Confirm them in the current Law on appeals and set them in `.env`.
- Telegram can't show a bot mentions of the ministry's channel in chats the bot is not a member of.
