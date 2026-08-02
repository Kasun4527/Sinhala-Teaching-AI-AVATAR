import json
import os
import re
import requests
from services.retriever import get_relevant_context

FINETUNED_MODEL_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")

# The fine-tuned model rewrites prose but was never trained on inputs
# containing [IMAGE: ...] placeholders, so it drops or mangles them if they're
# left in. They're stripped out before the call and reattached to the model's
# output afterward instead.
_IMAGE_TAG = re.compile(r'\[IMAGE:[^\]]+\]', re.IGNORECASE)

# Some generations echo the model's own Alpaca-style prompt template
# ("### Instruction" / "### Input" / "### Response") back as part of the
# output instead of returning only the completion — usually because
# generation for that chunk produced little or nothing real, so the model
# (or the server wrapping it) fell back to reflecting the prompt. When a
# "Response" marker is present, only the text after its last occurrence is
# the actual answer; anything before it (an echoed instruction/input) is
# discarded.
_RESPONSE_MARKER = re.compile(r'#{1,3}\s*response\s*:?\s*', re.IGNORECASE)


def _strip_template_echo(text: str) -> str:
    matches = list(_RESPONSE_MARKER.finditer(text))
    if matches:
        text = text[matches[-1].end():]
    return text.strip()


# Detects generations where the model produced substantially more English
# than the intended style — the fine-tune data itself trains the model to
# gloss terms in parentheses (e.g. "(Consumer Choice)"), so some Latin
# characters are expected and wanted. This threshold is deliberately more
# lenient than quiz_agent.py's 0.15 (where no English is wanted at all); it
# only catches generations that drift into substantial English rather than
# occasional glossary terms.
_SINHALA_CHAR = re.compile(r'[඀-෿]')
_LATIN_CHAR = re.compile(r'[A-Za-z]')
_LATIN_CONTAMINATION_THRESHOLD = 0.30


def _is_english_contaminated(text: str) -> bool:
    sinhala_count = len(_SINHALA_CHAR.findall(text))
    latin_count = len(_LATIN_CHAR.findall(text))
    total = sinhala_count + latin_count
    if total == 0:
        return False
    return (latin_count / total) > _LATIN_CONTAMINATION_THRESHOLD


# Long, formula/number-dense chunks (lab procedures, worked chemistry
# examples) occasionally cause the generation to break down partway through
# rather than staying incoherent throughout — producing a handful of
# corrupted words (garbled numbers, English fused mid-word) inside an
# otherwise mostly-fine passage. A ratio-based contamination check misses
# this, since a few bad words don't move the Latin/Sinhala ratio much. What
# reliably signals a breakdown is characters from a script that has no
# legitimate reason to appear at all — Sinhala STEM content never contains
# Ethiopic, Devanagari, Thai, Arabic, CJK, or Hangul characters, so any
# occurrence is treated as a hard failure for that chunk.
_FOREIGN_SCRIPT = re.compile(
    r'[ऀ-ॿ؀-ۿ฀-๿ሀ-፿'
    r'一-鿿぀-ヿ가-힯]'
)


def _has_foreign_script(text: str) -> bool:
    return bool(_FOREIGN_SCRIPT.search(text))


# The model occasionally fabricates a figure reference that doesn't
# correspond to any real image — verified against documents_unicode/, where
# only the bracketed "[IMAGE: filename]" tags (handled separately, above)
# actually occur. An unbracketed "රූපය: IMAGE 267"-style reference is
# generation noise, not a real placeholder to preserve, so it's stripped
# rather than reattached like a genuine tag.
_HALLUCINATED_IMAGE_REF = re.compile(
    r'රූප(ය|\s*සටහන)?\s*[:：]?\s*IMAGE\s*\d+', re.IGNORECASE
)


def _strip_hallucinated_image_refs(text: str) -> str:
    return _HALLUCINATED_IMAGE_REF.sub('', text).strip()

# Base instruction text matches the fine-tuning dataset exactly — the model was
# trained on these three fixed instructions, one per mastery level. The
# language-purity clause is appended on top of that (not part of the original
# fine-tune examples), as a best-effort mitigation for code-switching into
# English outside of the parenthetical glossary terms the model was actually
# trained to use (e.g. "(Consumer Choice)"). It's a mitigation, not a
# guarantee — verify against the live endpoint.
_LANGUAGE_RULE = (
    " ලිපිය සම්පූර්ණයෙන්ම සිංහල භාෂාවෙන් ලියන්න. ඉංග්‍රීසි යෙදුමක් අවශ්‍ය නම් "
    "එය වරහන් () ඇතුළත පමණක් යොදන්න — සම්පූර්ණ වාක්‍ය හෝ ඡේද ඉංග්‍රීසියෙන් නොලියන්න."
)

LEVEL_INSTRUCTIONS = {
    "Beginner": "පහත අන්තර්ගතය ආරම්භක (Beginner) මට්ටමේ සිසුන්ට ගැලපෙන ලෙස සම්පූර්ණ කරුණු ඇතුළත් කර නැවත ලියන්න." + _LANGUAGE_RULE,
    "Intermediate": "පහත අන්තර්ගතය මධ්‍යම (Intermediate) මට්ටමේ සිසුන්ට ගැලපෙන ලෙස සම්පූර්ණ කරුණු ඇතුළත් කර නැවත ලියන්න." + _LANGUAGE_RULE,
    "Advanced": "පහත අන්තර්ගතය උසස් (Advanced) මට්ටමේ සිසුන්ට ගැලපෙන ලෙස විද්‍යාත්මක නිරවද්‍යතාවය සහ තාක්ෂණික පාරිභාෂිතය භාවිතා කරමින් නැවත ලියන්න." + _LANGUAGE_RULE,
}


def _group_paragraphs_for_rewrite(paragraphs: list) -> list:
    """Group retriever paragraphs into rewrite units.

    [IMAGE: ...] paragraphs (retriever.py stores them as their own standalone
    paragraphs, in document order) pass straight through untouched — they're
    never sent to the model. Each text paragraph is its own rewrite unit
    (one paragraph per chunk, not paired) — bundling two paragraphs into one
    "rewrite this completely" call let the model merge/condense them instead
    of fully covering both, silently thinning out or dropping one
    paragraph's content even though nothing was lost on the input side.
    One paragraph per call has nothing to compete with, so the model has no
    reason to summarize away part of it.
    """
    groups = []

    for para in paragraphs:
        if para.strip().upper().startswith("[IMAGE"):
            groups.append({"type": "image", "text": para.strip()})
            continue
        groups.append({"type": "text", "paragraphs": [para]})
    return groups


def generate_content(subject, lesson, topic, level):

    context = get_relevant_context(subject, lesson, topic, k=4, max_length=None)

    if not context:
        context = f"{topic} යන මාතෘකාව {subject} විෂය {lesson} පාඩමෙහි ඇතුළත් වේ."

    print(f"[DEBUG] Level={level}, context={len(context)} chars")

    instruction = LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS["Intermediate"])

    # Split back into the original paragraphs (retriever.py joined them with
    # "\n\n") and group them into per-chunk rewrite units rather than sending
    # the whole document as one truncated 2500-char call.
    paragraphs = [p for p in re.split(r'\n{2,}', context) if p.strip()]
    groups = _group_paragraphs_for_rewrite(paragraphs)
    text_groups = [g for g in groups if g["type"] == "text"]

    if not text_groups:
        return context  # nothing but image tags — nothing to rewrite

    # Any stray inline [IMAGE: ...] left inside a text chunk (defense in depth
    # — normally these are their own paragraph, handled above) is stripped
    # from the model input and reattached to that same chunk's output below,
    # rather than to the whole document's output.
    for g in text_groups:
        raw = "\n\n".join(g["paragraphs"])
        g["image_tags"] = _IMAGE_TAG.findall(raw)
        g["clean_input"] = _IMAGE_TAG.sub('', raw).strip()

    payload = {
        "items": [
            {"instruction": instruction, "input": g["clean_input"][:2500]}
            for g in text_groups
        ],
        "max_new_tokens": 800,
    }

    try:
        response = requests.post(
            FINETUNED_MODEL_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=180,
        )
        response.raise_for_status()
        data = response.json()
        answers = data.get("answers", [])
        print(f"[DEBUG] Rewrote {len(text_groups)} chunk(s), got {len(answers)} answer(s)")
    except Exception as e:
        print(f"[WARNING] Fine-tuned model call failed: {e} — returning raw context")
        return context

    # Reassemble in original order: each text group's rewritten answer (or its
    # own original text if the model didn't return one), with that group's
    # own image tags reattached, and image-only groups passed through as-is.
    blocks = []
    text_i = 0
    for g in groups:
        if g["type"] == "image":
            blocks.append(g["text"])
            continue
        raw_answer = answers[text_i].strip() if text_i < len(answers) else ""
        answer = _strip_template_echo(raw_answer) if raw_answer else ""
        answer = _strip_hallucinated_image_refs(answer) if answer else answer
        if not answer or _is_english_contaminated(answer) or _has_foreign_script(answer):
            if _has_foreign_script(answer):
                print(f"[WARNING] Dropping garbled generation (foreign script detected) for chunk {text_i}")
            answer = g["clean_input"]
        if g["image_tags"]:
            answer = f"{answer}\n\n{chr(10).join(g['image_tags'])}"
        blocks.append(answer)
        text_i += 1

    return "\n\n".join(blocks)
