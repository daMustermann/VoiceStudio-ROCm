"""Video overlay preferences for the ROCm fork.

Audio watermarking and AudioSeal detection are intentionally unavailable.
"""

from fastapi import APIRouter

from core.prefs import get as pref_get, set_ as pref_set

router = APIRouter()


@router.get("/watermark/status")
def watermark_status():
    """Report disabled audio watermarks and the optional video overlay."""
    return {
        "invisible_enabled": False,
        "visible_audio_enabled": False,
        "visible_video_enabled": pref_get("watermark.visible_video", True),
        "audioseal_available": False,
    }


@router.post("/watermark/settings")
def update_watermark_settings(
    invisible: bool | None = None,
    visible_audio: bool | None = None,
    visible_video: bool | None = None,
):
    """Retain the video preference while ignoring legacy audio flags."""
    if visible_video is not None:
        pref_set("watermark.visible_video", visible_video)
    return watermark_status()
