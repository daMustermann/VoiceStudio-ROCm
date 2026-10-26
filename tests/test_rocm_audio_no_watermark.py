"""The ROCm fork exports untouched generated audio and keeps video overlays optional."""

import asyncio

import torch


def test_audio_marking_is_identity_even_when_forced():
    from services import watermark

    waveform = torch.tensor([[0.25, -0.75, 0.0]], dtype=torch.float32)
    assert watermark.is_enabled() is False
    assert watermark.will_mark() is False
    assert watermark.is_visible_audio_enabled() is False
    assert watermark._check_available() is False
    assert watermark.mark_synthetic(waveform, 24000, context="test", force=True) is waveform
    assert asyncio.run(
        watermark.mark_synthetic_async(waveform, 24000, context="test", force=True)
    ) is waveform
    assert watermark.embed_watermark(waveform, 24000, force=True) is waveform
    assert watermark.apply_audio_brand(waveform, 24000) is waveform


def test_watermark_api_ignores_legacy_audio_flags(monkeypatch):
    from api.routers import watermark as api

    settings = {"watermark.visible_video": False}
    monkeypatch.setattr(api, "pref_get", lambda key, default=None: settings.get(key, default))
    monkeypatch.setattr(api, "pref_set", lambda key, value: settings.__setitem__(key, value))

    api.update_watermark_settings(invisible=True, visible_audio=True)
    assert api.watermark_status() == {
        "invisible_enabled": False,
        "visible_audio_enabled": False,
        "visible_video_enabled": False,
        "audioseal_available": False,
    }
    assert settings == {"watermark.visible_video": False}

    api.update_watermark_settings(visible_video=True)
    assert api.watermark_status()["visible_video_enabled"] is True
