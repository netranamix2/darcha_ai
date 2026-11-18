import hashlib
import hmac

from app.adapters import meta


def test_signature(monkeypatch):
    monkeypatch.setattr(meta, "META_APP_SECRET", "s3cret")
    body = b'{"a":1}'
    good = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    assert meta.verify_signature(body, good)
    assert not meta.verify_signature(body, "sha256=bad")
    assert not meta.verify_signature(body, None)


def test_parse_events(monkeypatch):
    monkeypatch.setattr(meta, "META_IG_USER_ID", "999")
    payload = {"object": "instagram", "entry": [{"id": "999", "changes": [
        {"field": "comments", "value": {"id": "c1", "text": "Kontrakt qachon?", "from": {"id": "5", "username": "ali"},
                                        "media": {"id": "m1"}}},
        {"field": "comments", "value": {"id": "c2", "text": "our reply", "from": {"id": "999"}, "media": {"id": "m1"}}},
        {"field": "mentions", "value": {"comment_id": "c3", "media_id": "m9"}},
    ], "messaging": [{"sender": {"id": "77"}, "message": {"mid": "x", "text": "Salom"}},
                     {"sender": {"id": "999"}, "message": {"mid": "y", "text": "echo", "is_echo": True}}]}]}
    events = meta.parse_events(payload)
    kinds = [e["mention"]["comment_id"] if isinstance(e, dict) else e.channel for e in events]
    assert kinds == ["instagram_comment", "c3", "instagram_dm"]
    assert events[0].is_public and not events[2].is_public
