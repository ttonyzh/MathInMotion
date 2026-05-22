"""
Synchronized narration for Manim animations.

Key insight: self.add_sound(path, time_offset=T) uses Manim's renderer.time
at the moment of the call, so placing it inline in the step loop (right before
each self.wait) gives us perfect sync regardless of camera-scroll timing.

We inject:
  - _tts_clips list (paths to per-step WAV files)
  - _step_waits list (how long each step waits, covering narration duration)
  - A replacement for self.wait(0.4) that calls add_sound then waits
"""

import os
import re
import logging
import tempfile

logger = logging.getLogger('tts_narrator')

WRITE_S = 0.6   # Write() run_time in the template
DELAY_S = 0.5   # narration starts this long after the step's wait begins
GAP_S   = 0.4   # silence after narration before next step


# ── Parsing ───────────────────────────────────────────────────────────────────

def _clean_tts_text(text: str) -> str:
    """Strip artifacts that make TTS sound robotic."""
    text = re.sub(r'\bopen\s+parenthes[ie]s\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bclos(?:e|ing)\s+parenthes[ie]s\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bclose\s+paren\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bopen\s+paren\b', '', text, flags=re.IGNORECASE)
    # "numerator"/"denominator" only belong with stacked fractions, not ÷ expressions.
    # If "divided by" is already in the text, the speaker is describing a ÷ operation —
    # replace numerator/denominator with the plain position words.
    if re.search(r'\bdivided\s+by\b', text, flags=re.IGNORECASE):
        text = re.sub(r'\bnumerator\b', 'top', text, flags=re.IGNORECASE)
        text = re.sub(r'\bdenominator\b', 'bottom', text, flags=re.IGNORECASE)
    # Collapse multiple spaces left by removals
    text = re.sub(r' {2,}', ' ', text).strip(' ,')
    return text


def parse_narrations(manim_code: str) -> list[dict]:
    """Return ordered list of {text, step_index} from # tts: comments."""
    texts = re.findall(r'#\s*tts:\s*(.+)', manim_code)
    return [
        {'text': _clean_tts_text(t.strip().strip('\'"')), 'step_index': i}
        for i, t in enumerate(texts)
    ]


# ── Timing ────────────────────────────────────────────────────────────────────

def _calculate_waits(clips_ms: list[int]) -> list[float]:
    """
    Per-step self.wait() durations.
    Each wait covers: DELAY_S (before narration) + clip duration + GAP_S.
    """
    waits = []
    for dur_ms in clips_ms:
        dur_s = dur_ms / 1000.0
        waits.append(round(max(DELAY_S + dur_s + GAP_S, 1.0), 2))
    return waits


# ── Code patching ─────────────────────────────────────────────────────────────

def _inject(code: str, clip_paths: list[str], wait_times: list[float]) -> str:
    """
    Inject _tts_clips and _step_waits into construct(), then replace every
    self.wait(0.4) with an inline add_sound call followed by the timed wait.

    Because add_sound is called inline (not from the header), Manim uses the
    current renderer.time + DELAY_S as the play timestamp — perfectly synced
    to whichever step is active, regardless of camera scrolls.
    """
    waits_literal = '[' + ', '.join(str(w) for w in wait_times) + ']'
    clips_literal = '[' + ', '.join(f'r"{p}"' for p in clip_paths) + ']'

    header = (
        f'        _step_waits = {waits_literal}\n'
        f'        _step_wait_idx = 0\n'
        f'        _tts_clips = {clips_literal}\n'
    )

    code = re.sub(
        r'(def construct\(self\):\s*\n)',
        r'\1' + header,
        code,
        count=1,
    )

    # Replace per-step self.wait(0.4 or 0.5) with sound + timed wait + increment
    code = re.sub(
        r'(\s+)self\.wait\(0\.[45]\)',
        (r'\1if _step_wait_idx < len(_tts_clips):\n'
         r'\1    self.add_sound(_tts_clips[_step_wait_idx], time_offset=' + str(DELAY_S) + r')\n'
         r'\1self.wait(_step_waits[_step_wait_idx] if _step_wait_idx < len(_step_waits) else 1.0)\n'
         r'\1_step_wait_idx += 1'),
        code,
    )

    return code


# ── Main entry point ──────────────────────────────────────────────────────────

def prepare_narration(manim_code: str) -> tuple[str, str | None]:
    """
    Parse # tts: comments, generate WAV clips, patch the Manim code.

    Returns (patched_code, temp_dir) — temp_dir is deleted after rendering.
    Returns (original_code, None) if no narrations or on error.
    """
    narrations = parse_narrations(manim_code)
    if not narrations:
        return manim_code, None

    try:
        from gtts import gTTS
        from pydub import AudioSegment
    except ImportError as e:
        logger.warning(f"TTS dependencies missing: {e}")
        return manim_code, None

    temp_dir   = tempfile.mkdtemp(prefix='manim_tts_')
    clips_ms   = []
    clip_paths = []

    for n in narrations:
        wav_path = os.path.join(temp_dir, f"clip_{n['step_index']}.wav")
        try:
            mp3_path = wav_path.replace('.wav', '.mp3')
            gTTS(text=n['text'], lang='en', slow=False).save(mp3_path)
            seg = AudioSegment.from_mp3(mp3_path)
            seg.export(wav_path, format='wav')
            os.unlink(mp3_path)
            clips_ms.append(len(seg))
        except Exception as e:
            logger.warning(f"TTS failed step {n['step_index']}: {e}")
            from pydub import AudioSegment as AS
            AS.silent(duration=1500).export(wav_path, format='wav')
            clips_ms.append(1500)
        clip_paths.append(wav_path)

    wait_times = _calculate_waits(clips_ms)

    # Count actual self.wait(0.4/0.5) calls to detect mismatch
    n_waits = len(re.findall(r'self\.wait\(0\.[45]\)', manim_code))
    if n_waits != len(narrations):
        logger.warning(
            f"MISMATCH: {len(narrations)} # tts: comments but {n_waits} self.wait(0.4/0.5) calls"
        )
        logger.warning(f"TTS texts found: {[n['text'][:40] for n in narrations]}")

    code = _inject(manim_code, clip_paths, wait_times)

    logger.info(
        f"Narration prepared: {len(narrations)} clips | {n_waits} waits | waits={wait_times}"
    )
    return code, temp_dir
