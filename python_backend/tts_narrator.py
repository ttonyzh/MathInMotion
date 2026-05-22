"""
Synchronized narration for Manim animations via Azure Cognitive Services Speech.

Key insight: self.add_sound(path, time_offset=T) uses Manim's renderer.time
at the moment of the call, so placing it inline in the step loop gives perfect
sync regardless of camera-scroll timing.
"""

import io
import os
import re
import wave
import logging
import tempfile

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

logger = logging.getLogger('tts_narrator')

DELAY_S = 0.5   # narration starts this long after the step's wait begins
GAP_S   = 0.4   # silence after narration before next step

AZURE_SPEECH_KEY    = os.getenv('AZURE_SPEECH_KEY', '')
AZURE_SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION', 'eastus')
DEFAULT_VOICE       = 'en-US-JennyNeural'

VOICES = {
    'Jenny':  'en-US-JennyNeural',
    'Guy':    'en-US-GuyNeural',
    'Aria':   'en-US-AriaNeural',
    'Davis':  'en-US-DavisNeural',
    'Jason':  'en-US-JasonNeural',
    'Nancy':  'en-US-NancyNeural',
}


# ── Text cleanup ──────────────────────────────────────────────────────────────

def _clean_tts_text(text: str) -> str:
    text = re.sub(r'\bopen\s+parenthes[ie]s\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bclos(?:e|ing)\s+parenthes[ie]s\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bclose\s+paren\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bopen\s+paren\b', '', text, flags=re.IGNORECASE)
    if re.search(r'\bdivided\s+by\b', text, flags=re.IGNORECASE):
        text = re.sub(r'\bnumerator\b', 'top', text, flags=re.IGNORECASE)
        text = re.sub(r'\bdenominator\b', 'bottom', text, flags=re.IGNORECASE)
    text = re.sub(r' {2,}', ' ', text).strip(' ,')
    return text


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_narrations(manim_code: str) -> list[dict]:
    texts = re.findall(r'#\s*tts:\s*(.+)', manim_code)
    return [
        {'text': _clean_tts_text(t.strip().strip('\'"')), 'step_index': i}
        for i, t in enumerate(texts)
    ]


# ── Azure TTS ─────────────────────────────────────────────────────────────────

def _azure_tts(text: str, voice: str, key: str, region: str) -> bytes:
    """Call Azure Speech REST API and return raw WAV bytes."""
    ssml = (
        f"<speak version='1.0' xml:lang='en-US'>"
        f"<voice name='{voice}'>{text}</voice>"
        f"</speak>"
    )
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
    }
    resp = requests.post(url, headers=headers, data=ssml.encode('utf-8'), timeout=30)
    resp.raise_for_status()
    return resp.content


def _wav_duration_ms(wav_bytes: bytes) -> int:
    with wave.open(io.BytesIO(wav_bytes)) as wf:
        return int(wf.getnframes() / wf.getframerate() * 1000)


def _write_silent_wav(path: str, duration_ms: int = 1500) -> None:
    sample_rate = 24000
    num_samples = int(sample_rate * duration_ms / 1000)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b'\x00\x00' * num_samples)


# ── Timing ────────────────────────────────────────────────────────────────────

def _calculate_waits(clips_ms: list[int]) -> list[float]:
    return [
        round(max(DELAY_S + dur_ms / 1000.0 + GAP_S, 1.0), 2)
        for dur_ms in clips_ms
    ]


# ── Code patching ─────────────────────────────────────────────────────────────

def _inject(code: str, clip_paths: list[str], wait_times: list[float]) -> str:
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

    # Use [ \t]+ (not \s+) to avoid capturing preceding newlines into \1
    code = re.sub(
        r'([ \t]+)self\.wait\(0\.[45]\)',
        (r'\1if _step_wait_idx < len(_tts_clips):\n'
         r'\1    self.add_sound(_tts_clips[_step_wait_idx], time_offset=' + str(DELAY_S) + r')\n'
         r'\1self.wait(_step_waits[_step_wait_idx] if _step_wait_idx < len(_step_waits) else 1.0)\n'
         r'\1_step_wait_idx += 1'),
        code,
    )
    return code


# ── Main entry point ──────────────────────────────────────────────────────────

def prepare_narration(
    manim_code: str,
    voice: str = DEFAULT_VOICE,
) -> tuple[str, str | None]:
    """
    Parse # tts: comments, generate WAV clips via Azure TTS, patch the Manim code.

    Returns (patched_code, temp_dir) or (original_code, None) on error/no narrations.
    """
    narrations = parse_narrations(manim_code)
    if not narrations:
        return manim_code, None

    key    = AZURE_SPEECH_KEY
    region = AZURE_SPEECH_REGION

    if not key:
        logger.warning("AZURE_SPEECH_KEY not set — skipping TTS")
        return manim_code, None

    # Resolve short name (e.g. "Jenny") to full voice ID if needed
    voice = VOICES.get(voice, voice)

    temp_dir   = tempfile.mkdtemp(prefix='manim_tts_')
    clips_ms   = []
    clip_paths = []

    for n in narrations:
        wav_path = os.path.join(temp_dir, f"clip_{n['step_index']}.wav")
        try:
            wav_bytes = _azure_tts(n['text'], voice, key, region)
            with open(wav_path, 'wb') as f:
                f.write(wav_bytes)
            clips_ms.append(_wav_duration_ms(wav_bytes))
        except Exception as e:
            logger.warning(f"Azure TTS failed step {n['step_index']}: {e}")
            _write_silent_wav(wav_path, duration_ms=1500)
            clips_ms.append(1500)
        clip_paths.append(wav_path)

    n_waits = len(re.findall(r'self\.wait\(0\.[45]\)', manim_code))
    if n_waits != len(narrations):
        logger.warning(
            f"MISMATCH: {len(narrations)} # tts: comments but {n_waits} self.wait(0.4/0.5) calls"
        )

    wait_times = _calculate_waits(clips_ms)
    code = _inject(manim_code, clip_paths, wait_times)

    logger.info(f"Narration prepared: {len(narrations)} clips | voice={voice} | waits={wait_times}")
    return code, temp_dir
