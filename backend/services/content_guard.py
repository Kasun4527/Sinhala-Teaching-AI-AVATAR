"""
Content Guard — LLM Safety Guardrails for Education Platform
=============================================================
Provides three main functions:
  • check_input(text)  — Layer 2: validates user-facing inputs before LLM call
  • check_output(text) — Layer 3a: scans LLM-generated output for harmful content
  • log_safety_flag()  — Layer 5: persists flagged incidents to MongoDB for teacher review
"""

import re
import unicodedata
from datetime import datetime, timezone

from db import db

# ── MongoDB collection for safety audit logs ─────────────────────────────────
safety_flags_collection = db["safety_flags"]

# ═══════════════════════════════════════════════════════════════════════════════
# BLOCKLISTS — Sinhala + English
# ═══════════════════════════════════════════════════════════════════════════════
# These lists are intentionally broad for an education platform serving minors.
# False positives are acceptable — a blocked legitimate term can be reviewed
# and whitelisted, but a missed harmful term reaching a student cannot be undone.

# ── English blocklist (lowercase) ─────────────────────────────────────────────
# NOTE: Terms must NOT match legitimate educational content. For example:
#   - "sex" is excluded because biology discusses "sex chromosomes", "sex cells"
#   - "kill" is excluded because science discusses bacteria that "kill pathogens"
# Instead, use multi-word phrases that are unambiguously harmful.
_ENGLISH_BLOCKED_TERMS = [
    # Sexual content (multi-word to avoid biology false positives)
    "porn", "pornography", "xxx", "nude", "naked",
    "erotic", "orgasm", "masturbat", "genital", "penis", "vagina",
    "intercourse", "fetish", "hentai", "nsfw", "onlyfans",
    "sexual content", "sexual act", "sexually explicit",
    # Violence / weapons
    "murder", "suicide", "self-harm", "self harm", "cutting myself",
    "how to die", "want to die", "end my life", "bomb", "explosive",
    "terrorism", "terrorist", "massacre", "genocide", "torture",
    "school shooting", "mass shooting",
    # Drugs / substance abuse
    "cocaine", "heroin", "methamphetamine", "crack pipe", "drug abuse",
    "how to make drugs", "overdose",
    # Hate speech
    "racial slur", "white supremacy", "nazi", "hate crime",
    # Self-harm / eating disorders
    "anorexia tips", "bulimia tips", "pro-ana", "pro-mia",
    "how to starve", "cutting tips",
]

# ── Sinhala blocklist ─────────────────────────────────────────────────────────
# NFC-normalized Sinhala terms covering sexual, violent, and self-harm content.
# NOTE: "ලිංගික" (sexual/gender) is deliberately excluded — it appears in
# legitimate Buddhist studies curriculum (ලිංගිකයන් = gender) and biology
# (ලිංගික ප්‍රජනනය = sexual reproduction). Only multi-word phrases that are
# unambiguously harmful are included.
_SINHALA_BLOCKED_TERMS = [
    # Sexual content (specific harmful phrases only)
    "අසභ්‍ය", "කාමුක", "නිරුවත්", "අශ්ලීල",
    "ස්ත්‍රී පුරුෂ සංසර්ගය", "වෛශ්‍යාව", "ගණිකාව",
    # Violence
    "මිනීමැරුම", "මිනීමරනවා", "ඝාතනය", "ත්‍රස්තවාදය", "ත්‍රස්තවාදී",
    "බෝම්බ", "පිපිරුම", "මහා සංහාරය", "වධ හිංසා",
    # Self-harm / Suicide
    "සියදිවි නසාගන්නවා", "සියදිවි", "මරාගන්නවා", "ආත්මහත්‍යා",
    "මැරෙන්න ඕන", "මට මැරෙන්න", "ජීවිතය අවසන්",
    # Drugs
    "මත්ද්‍රව්‍ය", "කොකේන්", "හෙරොයින්",
]

# ── Compiled regex patterns ───────────────────────────────────────────────────
# Build a single regex per language for fast matching.  Word-boundary matching
# is used for English (to avoid matching "organism" for "orgasm" etc.).
# Sinhala doesn't use spaces/boundaries the same way, so substring match is used.

def _build_english_pattern():
    """Build a case-insensitive regex with word boundaries for English terms."""
    escaped = [re.escape(t) for t in _ENGLISH_BLOCKED_TERMS]
    # Use \b only on terms that start/end with word chars
    bounded = []
    for t in escaped:
        bounded.append(rf"\b{t}")
    return re.compile("|".join(bounded), re.IGNORECASE)


def _build_sinhala_pattern():
    """Build a regex for NFC-normalized Sinhala terms (substring match)."""
    escaped = [re.escape(t) for t in _SINHALA_BLOCKED_TERMS]
    return re.compile("|".join(escaped))


_EN_PATTERN = _build_english_pattern()
_SI_PATTERN = _build_sinhala_pattern()


# ═══════════════════════════════════════════════════════════════════════════════
# NORMALIZER — handles Sinhala Unicode normalization (NFC vs NFD)
# ═══════════════════════════════════════════════════════════════════════════════

def _normalize(text: str) -> str:
    """NFC-normalize text so that visually identical Sinhala strings match."""
    return unicodedata.normalize("NFC", text)


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — INPUT VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

# Maximum input length (characters). Prevents prompt-injection via very long inputs.
_MAX_INPUT_LENGTH = 5000


def check_input(text: str, context: dict = None) -> dict:
    """Validate user-facing input before it reaches the LLM.

    Args:
        text:    The raw input text (topic name, free-text question, etc.)
        context: Optional dict with metadata for logging (student_id, subject, etc.)

    Returns:
        {
            "safe": bool,
            "reason": str or None,     # human-readable reason if blocked
            "matched_term": str or None # the actual term that was matched
        }
    """
    if not text or not text.strip():
        return {"safe": True, "reason": None, "matched_term": None}

    normalized = _normalize(text.strip())

    # Length check
    if len(normalized) > _MAX_INPUT_LENGTH:
        reason = f"Input too long ({len(normalized)} chars, max {_MAX_INPUT_LENGTH})"
        if context:
            log_safety_flag(
                flag_type="input_blocked",
                reason=reason,
                content_snippet=normalized[:200],
                **context
            )
        return {"safe": False, "reason": reason, "matched_term": None}

    # English keyword check
    en_match = _EN_PATTERN.search(normalized)
    if en_match:
        matched = en_match.group()
        reason = f"Blocked English term detected: '{matched}'"
        if context:
            log_safety_flag(
                flag_type="input_blocked",
                reason=reason,
                matched_term=matched,
                content_snippet=normalized[:200],
                **context
            )
        return {"safe": False, "reason": reason, "matched_term": matched}

    # Sinhala keyword check
    si_match = _SI_PATTERN.search(normalized)
    if si_match:
        matched = si_match.group()
        reason = f"Blocked Sinhala term detected"
        if context:
            log_safety_flag(
                flag_type="input_blocked",
                reason=reason,
                matched_term=matched,
                content_snippet=normalized[:200],
                **context
            )
        return {"safe": False, "reason": reason, "matched_term": matched}

    return {"safe": True, "reason": None, "matched_term": None}


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 3a — OUTPUT FILTERING
# ═══════════════════════════════════════════════════════════════════════════════

def check_output(text: str, context: dict = None) -> dict:
    """Scan LLM-generated output for harmful content.

    Args:
        text:    The raw LLM output.
        context: Optional dict with metadata for logging.

    Returns:
        {
            "safe": bool,
            "reason": str or None,
            "matched_term": str or None,
            "cleaned_text": str  # original text if safe, fallback if flagged
        }
    """
    if not text or not text.strip():
        return {"safe": True, "reason": None, "matched_term": None, "cleaned_text": text}

    normalized = _normalize(text.strip())

    # English keyword check
    en_match = _EN_PATTERN.search(normalized)
    if en_match:
        matched = en_match.group()
        reason = f"Blocked English term in LLM output: '{matched}'"
        if context:
            log_safety_flag(
                flag_type="output_flagged",
                reason=reason,
                matched_term=matched,
                content_snippet=normalized[:500],
                **context
            )
        return {
            "safe": False,
            "reason": reason,
            "matched_term": matched,
            "cleaned_text": _get_safe_fallback(context)
        }

    # Sinhala keyword check
    si_match = _SI_PATTERN.search(normalized)
    if si_match:
        matched = si_match.group()
        reason = f"Blocked Sinhala term in LLM output"
        if context:
            log_safety_flag(
                flag_type="output_flagged",
                reason=reason,
                matched_term=matched,
                content_snippet=normalized[:500],
                **context
            )
        return {
            "safe": False,
            "reason": reason,
            "matched_term": matched,
            "cleaned_text": _get_safe_fallback(context)
        }

    return {"safe": True, "reason": None, "matched_term": None, "cleaned_text": text}


def _get_safe_fallback(context: dict = None) -> str:
    """Return a safe replacement message when LLM output is flagged."""
    topic = context.get("topic", "") if context else ""
    if topic:
        return f"මෙම {topic} මාතෘකාව පිළිබඳ අන්තර්ගතය නැවත උත්පාදනය වෙමින් පවතී. කරුණාකර මඳ වේලාවකින් නැවත උත්සාහ කරන්න."
    return "අන්තර්ගතය නැවත උත්පාදනය වෙමින් පවතී. කරුණාකර මඳ වේලාවකින් නැවත උත්සාහ කරන්න."


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 5 — AUDIT LOGGING & TEACHER ALERTS
# ═══════════════════════════════════════════════════════════════════════════════

def log_safety_flag(
    flag_type: str,
    reason: str,
    content_snippet: str = "",
    matched_term: str = "",
    student_id: str = "",
    subject: str = "",
    lesson: str = "",
    topic: str = "",
    agent: str = "",
    teacher_id: str = "",
    **kwargs
):
    """Persist a safety flag to MongoDB for teacher review.

    Args:
        flag_type:       "input_blocked" or "output_flagged"
        reason:          Human-readable explanation
        content_snippet: First N chars of the offending content (for review)
        matched_term:    The specific term that triggered the flag
        student_id:      The student who triggered it
        subject/lesson/topic: Curriculum context
        agent:           Which agent was involved (content/quiz/explain)
        teacher_id:      The student's linked teacher (for scoped alerts)
    """
    doc = {
        "flag_type": flag_type,
        "reason": reason,
        "content_snippet": content_snippet,
        "matched_term": matched_term,
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "agent": agent,
        "teacher_id": teacher_id,
        "reviewed": False,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        safety_flags_collection.insert_one(doc)
        print(f"[ContentGuard] ⚠️ Safety flag logged: {flag_type} — {reason}")
    except Exception as e:
        print(f"[ContentGuard] Failed to log safety flag: {e}")


def get_safety_alerts(teacher_id: str = None, limit: int = 50) -> list:
    """Retrieve recent safety alerts, optionally scoped to a teacher.

    Returns a list of flag documents sorted by newest first.
    """
    query = {}
    if teacher_id:
        query["teacher_id"] = teacher_id
    
    cursor = safety_flags_collection.find(
        query,
        {"_id": 0}  # exclude MongoDB ObjectId for JSON serialization
    ).sort("created_at", -1).limit(limit)
    
    return list(cursor)


def mark_alert_reviewed(alert_id: str) -> bool:
    """Mark a safety alert as reviewed by the teacher."""
    from bson import ObjectId
    result = safety_flags_collection.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {"reviewed": True, "reviewed_at": datetime.now(timezone.utc)}}
    )
    return result.modified_count > 0
