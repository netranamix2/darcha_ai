"""Multilingual embeddings (bge-m3) and cross-encoder reranking (bge-reranker-v2-m3).

Both run locally: the texts of citizens' questions never leave the server for search.
Models load lazily; call warmup() at startup to avoid a slow first request.
"""
from __future__ import annotations

import threading

import numpy as np

from app.config import DEVICE, EMBED_MODEL, RERANK_MODEL, USE_RERANKER

_lock = threading.Lock()
_embedder = None
_reranker = None


def _device() -> str:
    if DEVICE != "auto":
        return DEVICE
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _dtype_kwargs(dev: str) -> dict:
    if dev != "cuda":
        return {}
    import torch
    return {"dtype": torch.float16}


def _load(cls, name: str, **kw):
    """Cache first: a startup must not depend on huggingface.co (a hung metadata request once
    froze startup with no timeout). Go online only when the model has never been downloaded."""
    try:
        return cls(name, local_files_only=True, **kw)
    except (OSError, ValueError):
        return cls(name, **kw)


def embedder():
    global _embedder
    with _lock:
        if _embedder is None:
            from sentence_transformers import SentenceTransformer
            dev = _device()
            # Load straight in fp16 on GPU: loading fp32 first does not fit two models on a 4 GB card.
            _embedder = _load(SentenceTransformer, EMBED_MODEL, device=dev, model_kwargs=_dtype_kwargs(dev))
    return _embedder


def reranker():
    global _reranker
    if not USE_RERANKER:
        return None
    with _lock:
        if _reranker is None:
            from sentence_transformers import CrossEncoder
            dev = _device()
            _reranker = _load(CrossEncoder, RERANK_MODEL, device=dev, max_length=512, model_kwargs=_dtype_kwargs(dev))
    return _reranker


def embed(texts: list[str], batch_size: int = 16) -> np.ndarray:
    return embedder().encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)


def embed_one(text: str) -> list[float]:
    return embed([text])[0].tolist()


def rerank(query: str, passages: list[str]) -> list[float] | None:
    """Relevance in 0..1 for each passage, or None when the reranker is disabled."""
    model = reranker()
    if model is None or not passages:
        return None
    scores = model.predict([(query, p) for p in passages], show_progress_bar=False)
    scores = np.asarray(scores, dtype=np.float32)
    if scores.min() < 0 or scores.max() > 1:   # raw logits -> probabilities
        scores = 1 / (1 + np.exp(-scores))
    return scores.tolist()


def warmup() -> None:
    embed(["salom"])
    rerank("salom", ["salom"])
