"""Data model from section 8 of the project doc (PostgreSQL + pgvector, one database)."""
from __future__ import annotations

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (BigInteger, Boolean, Computed, DateTime, Float, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.config import EMBED_DIM


class Base(DeclarativeBase):
    pass


def ts() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------- reference data
class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(64))       # null = central office
    telegram_id: Mapped[str | None] = mapped_column(String(64))  # chat for notifications


class Staff(Base):
    __tablename__ = "staff"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32))   # operator | specialist | manager | kb_admin | admin
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    region: Mapped[str | None] = mapped_column(String(64))       # regional staff see only their region
    telegram_id: Mapped[str | None] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name_uz: Mapped[str] = mapped_column(String(255))
    name_ru: Mapped[str] = mapped_column(String(255))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id"))


# ---------------------------------------------------------------- inbound flow
class Citizen(Base):
    __tablename__ = "citizens"
    __table_args__ = (UniqueConstraint("channel", "external_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str] = mapped_column(String(128))
    display: Mapped[str | None] = mapped_column(String(255))
    lang_pref: Mapped[str | None] = mapped_column(String(16))
    phone_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = ts()


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_created", "created_at"), Index("ix_messages_thread", "thread_ref"))
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    citizen_id: Mapped[int | None] = mapped_column(ForeignKey("citizens.id"))
    channel: Mapped[str] = mapped_column(String(32))
    external_msg_id: Mapped[str | None] = mapped_column(String(128))
    thread_ref: Mapped[str | None] = mapped_column(String(128))   # web: session id; tg: chat:msg; ig: media id
    text_raw: Mapped[str] = mapped_column(Text)                    # stored only server-side, never sent to the LLM
    text_masked: Mapped[str] = mapped_column(Text)
    text_latin: Mapped[str] = mapped_column(Text)
    lang: Mapped[str | None] = mapped_column(String(8))            # uz | ru | mixed
    script: Mapped[str | None] = mapped_column(String(16))         # latin | cyrillic
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_mention: Mapped[bool] = mapped_column(Boolean, default=False)
    is_foreign_page: Mapped[bool] = mapped_column(Boolean, default=False)
    reply_ctx: Mapped[dict] = mapped_column(JSONB, default=dict)   # what the adapter needs to reply
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = ts()
    embedding = mapped_column(Vector(EMBED_DIM), nullable=True)    # filled lazily for the FAQ report

    citizen: Mapped[Citizen | None] = relationship()
    classification: Mapped[Classification | None] = relationship(back_populates="message", uselist=False)
    responses: Mapped[list[Response]] = relationship(back_populates="message", order_by="Response.id")


class Classification(Base):
    __tablename__ = "classifications"
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True)
    type: Mapped[str] = mapped_column(String(32))        # question | complaint | suggestion | gratitude | spam | insult
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id"))
    region: Mapped[str | None] = mapped_column(String(64))
    sentiment: Mapped[str] = mapped_column(String(16))   # negative | neutral | positive
    urgency: Mapped[str] = mapped_column(String(16))     # low | normal | high
    flags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    model: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = ts()

    message: Mapped[Message] = relationship(back_populates="classification")
    topic: Mapped[Topic | None] = relationship()


class Response(Base):
    __tablename__ = "responses"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    level: Mapped[str] = mapped_column(String(8))          # green | yellow | red | none
    kind: Mapped[str] = mapped_column(String(16), default="ai")  # ai | template | holding | specialist
    answer_text: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[list] = mapped_column(JSONB, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    reason: Mapped[str | None] = mapped_column(Text)        # why this level was chosen (shown in the panel)
    status: Mapped[str] = mapped_column(String(16))         # draft | approved | sent | rejected | skipped
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("staff.id"))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    rating: Mapped[int | None] = mapped_column(Integer)      # citizen's 1-5 rating of this answer
    debug: Mapped[dict] = mapped_column(JSONB, default=dict)  # retrieval scores etc. for the tech demo
    created_at: Mapped[datetime] = ts()

    message: Mapped[Message] = relationship(back_populates="responses")


class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), unique=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id"))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"))
    region: Mapped[str | None] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(16))       # low | normal | high
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | in_progress | answered | closed
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    summary: Mapped[str] = mapped_column(Text)
    draft_answer: Mapped[str | None] = mapped_column(Text)
    draft_citations: Mapped[list] = mapped_column(JSONB, default=list)
    similar: Mapped[list] = mapped_column(JSONB, default=list)  # similar resolved tickets
    final_answer: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()

    message: Mapped[Message] = relationship()
    department: Mapped[Department | None] = relationship()
    events: Mapped[list[TicketEvent]] = relationship(order_by="TicketEvent.id")


class TicketEvent(Base):
    """Ticket history + audit log (who did what, when)."""
    __tablename__ = "ticket_events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(32))
    actor: Mapped[str] = mapped_column(String(64))         # "system" or staff username
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = ts()


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))          # fraud | violence | spike | overdue
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id"))
    message_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id"))
    text: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()


# ---------------------------------------------------------------- knowledge base
class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    number: Mapped[str | None] = mapped_column(String(128))
    issued_at: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="active")   # active | repealed
    valid_until: Mapped[str | None] = mapped_column(String(10))   # YYYY-MM-DD: one-off rules stop being cited after it
    doc_type: Mapped[str] = mapped_column(String(32), default="regulation")  # regulation | faq | specialist_answer
    source_url: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[str | None] = mapped_column(String(8))
    file: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()

    chunks: Mapped[list[Chunk]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_chunks_embedding", "embedding", postgresql_using="hnsw",
              postgresql_ops={"embedding": "vector_cosine_ops"}),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    article_ref: Mapped[str] = mapped_column(String(255), default="")   # "12-band", "5-modda", "FAQ"
    header: Mapped[str] = mapped_column(Text, default="")               # title — chapter — point
    text: Mapped[str] = mapped_column(Text)
    text_latin: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(Vector(EMBED_DIM))
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('simple', replace(text_latin, '''', ''))", persisted=True))

    document: Mapped[Document] = relationship(back_populates="chunks")


# ---------------------------------------------------------------- analytics
class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    period: Mapped[str] = mapped_column(String(16))          # week | month
    period_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_to: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = ts()

    clusters: Mapped[list[Cluster]] = relationship(back_populates="report", order_by="Cluster.size.desc()")


class Cluster(Base):
    __tablename__ = "clusters"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    cluster_id: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(Text)
    what_is_unclear: Mapped[str] = mapped_column(Text, default="")
    size: Mapped[int] = mapped_column(Integer)
    regions: Mapped[dict] = mapped_column(JSONB, default=dict)
    sentiment: Mapped[dict] = mapped_column(JSONB, default=dict)
    escalated_share: Mapped[float] = mapped_column(Float, default=0.0)
    unanswered_in_kb: Mapped[bool] = mapped_column(Boolean, default=False)
    trend: Mapped[dict] = mapped_column(JSONB, default=dict)          # {"status": new|growing|falling|stable, "prev": n}
    examples: Mapped[list] = mapped_column(JSONB, default=list)
    explainer_draft: Mapped[dict] = mapped_column(JSONB, default=dict)  # post / faq_card / bot_template + citations
    centroid = mapped_column(Vector(EMBED_DIM))

    report: Mapped[Report] = relationship(back_populates="clusters")


class DemoSocial(Base):
    """Mock Instagram profile used by the simulator (clearly labelled 'Darcha Demo')."""
    __tablename__ = "demo_social"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))      # post | comment | dm
    post_id: Mapped[int | None] = mapped_column(Integer)
    parent_id: Mapped[int | None] = mapped_column(Integer)
    author: Mapped[str] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()
