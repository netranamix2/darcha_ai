from app.pipeline.answer import AnswerResult, verify
from app.pipeline.classify import ClassificationResult
from app.pipeline.retrieve import Hit
from app.pipeline.route import decide

CITE = [{"chunk_id": "1", "title": "Nizom", "ref": "3-band", "url": None}]


def ans(conf=0.9, cites=CITE, needs_human=False, failed=False):
    return AnswerResult(answer="javob", citations=cites, confidence=conf, needs_human=needs_human, failed=failed)


def cls(type_="question", flags=()):
    return ClassificationResult(type=type_, flags=list(flags))


def lvl(c, a, public=False, foreign=False):
    return decide(c, a, is_public=public, is_foreign_page=foreign).level


def test_green_requires_question_confidence_and_citation():
    assert lvl(cls(), ans()) == "green"
    assert lvl(cls(), ans(cites=[])) == "red"
    assert lvl(cls(), ans(conf=0.6)) == "yellow"
    assert lvl(cls(), ans(conf=0.4)) == "red"


def test_flags():
    assert lvl(cls(flags=["children"]), ans()) == "yellow"
    assert lvl(cls(flags=["personal_case"]), ans()) == "red"
    d = decide(cls(flags=["fraud"]), ans(), is_public=True, is_foreign_page=False)
    assert d.level == "red" and d.alert == "fraud" and d.template == "fraud"
    assert lvl(cls(flags=["prompt_injection"]), ans()) == "yellow"
    assert lvl(cls(flags=["political"]), ans()) == "yellow"


def test_types():
    assert decide(cls("spam"), ans(), is_public=True, is_foreign_page=False).action == "ignore"
    assert lvl(cls("complaint"), ans(), public=True) == "yellow"
    assert decide(cls("gratitude"), ans(cites=[]), is_public=False, is_foreign_page=False).action == "template"


def test_foreign_page_never_gets_public_ticket_notice():
    assert lvl(cls(), ans(conf=0.3), foreign=True) == "yellow"
    assert lvl(cls(), ans(), foreign=True) == "green"


def test_verify_drops_invented_citations():
    hits = [Hit(1, 10, "Nizom", "N-1", None, "3-band", "h", "t", score=0.9)]
    r = verify({"answer": "x", "citations": [{"chunk_id": "1", "ref": "3"}, {"chunk_id": "99", "ref": "?"}],
                "confidence": 0.95, "needs_human": False}, hits)
    assert [c["chunk_id"] for c in r.citations] == ["1"] and r.invalid_citations == ["99"]
    assert r.confidence < 0.95
    none = verify({"answer": "x", "citations": [{"chunk_id": "99", "ref": "?"}], "confidence": 0.95,
                   "needs_human": False}, hits)
    assert none.citations == [] and none.confidence <= 0.3


def test_flags_outrank_spam_type():
    # seen live: the classifier labelled an injection attempt "spam"
    assert lvl(cls("spam", ["prompt_injection"]), ans()) == "yellow"
    assert decide(cls("question", ["off_topic"]), ans(), is_public=False, is_foreign_page=False).template == "off_topic"
    assert decide(cls("spam", ["off_topic"]), ans(), is_public=False, is_foreign_page=False).action == "ignore"   # ads
    assert decide(cls("insult", ["off_topic"]), ans(), is_public=False, is_foreign_page=False).action == "ignore"
    assert lvl(cls("spam", ["fraud"]), ans()) == "red"


def test_cross_lingual_support_uses_vector_similarity():
    # Russian question -> Uzbek passage: reranker 0.03, but cosine 0.65 means a real match
    ru = Hit(1, 10, "Nizom", None, None, "1-band", "h", "t", vec_sim=0.65, score=0.03)
    wrong = Hit(2, 10, "Nizom", None, None, "3-band", "h", "t", vec_sim=0.38, score=0.0)
    assert ru.support == 1.0 and wrong.support == 0.0
    raw = {"answer": "x", "citations": [{"chunk_id": "1"}], "confidence": 0.9, "needs_human": False}
    assert verify(raw, [ru]).confidence >= 0.8
    raw["citations"] = [{"chunk_id": "2"}]
    assert verify(raw, [wrong]).confidence < 0.8
