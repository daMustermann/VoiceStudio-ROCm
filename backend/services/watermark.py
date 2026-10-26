"""Audio-export compatibility shims and the optional video logo overlay.

The ROCm fork does not embed audio watermarks or append an audio brand tone.
Older generation call sites still import these no-op functions so exported
audio is passed through unchanged without loading AudioSeal or a worker pool.
"""

from __future__ import annotations

import torch
from core.prefs import resolve


def _check_available() -> bool:
    """The AudioSeal integration is not included in this fork."""
    return False


def is_enabled() -> bool:
    return False


def will_mark() -> bool:
    return False


def is_visible_audio_enabled() -> bool:
    return False


def is_visible_video_enabled() -> bool:
    """Whether the separately configurable video logo overlay is enabled."""
    return resolve("watermark.visible_video", default=True) is not False


def mark_synthetic(
    waveform: torch.Tensor,
    sample_rate: int,
    *,
    context: str,
    force: bool = False,
) -> torch.Tensor:
    """Keep generated audio unchanged, even for legacy force=True calls."""
    return waveform


async def mark_synthetic_async(
    waveform: torch.Tensor,
    sample_rate: int,
    *,
    context: str,
    force: bool = False,
    timeout: float | None = None,
) -> torch.Tensor:
    """No background watermark worker or extra audio processing."""
    return waveform


def embed_watermark(
    waveform: torch.Tensor,
    sample_rate: int,
    message: list[int] | None = None,
    *,
    force: bool = False,
) -> torch.Tensor:
    """Legacy import compatibility; does not modify audio."""
    return waveform


def apply_audio_brand(waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
    """No added sound logo."""
    return waveform


def detect_watermark(waveform: torch.Tensor, sample_rate: int) -> dict:
    """Legacy import compatibility; audio watermark detection is unavailable."""
    return {
        "is_watermarked": False,
        "confidence": 0.0,
        "message_bits": "",
        "is_omnivoice": False,
        "error": "Audio watermark detection is not available in this fork",
    }


def prefetch_generator(*, allow_download: bool = False) -> None:
    """Legacy startup hook: never download or load an AudioSeal model."""
    return None


def release_idle_models(idle_seconds: float, *, now: float | None = None) -> bool:
    """No watermark models to release."""
    return False


def get_ffmpeg_overlay_args(logo_path: str, duration_s: float = 5.0) -> list[str]:
    """Build ffmpeg arguments for the separate, optional video-logo overlay."""
    if not is_visible_video_enabled():
        return []
    filter_str = (
        f"[1:v]scale=-1:64,format=rgba,"
        f"fade=t=out:st={duration_s - 1}:d=1:alpha=1[logo];"
        f"[0:v][logo]overlay=W-w-20:H-h-20:enable='lte(t,{duration_s})'"
    )
    return ["-filter_complex", filter_str]
