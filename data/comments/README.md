300-500 real public comments from the ministry's channels for the FAQ-report demo.
One file or several `*.jsonl`, one comment per line:

    {"text": "...", "region": "Farg'ona", "channel": "telegram_comment", "received_at": "2026-11-10T09:00:00+05:00", "source": "https://t.me/..."}

Only `text` is required. Collect only public comments; do not store usernames.
Load with: `python scripts/seed_demo.py data/comments`
