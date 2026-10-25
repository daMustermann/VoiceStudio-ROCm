<div align="center">
  <img src="docs/logo.png" alt="VoiceStudio" width="88" />
  <h1>VoiceStudio ROCm</h1>
  <p><strong>AMD GPU fork of VoiceStudio, focused on native Windows ROCm support.</strong></p>
  <p>RX 7900 XTX (gfx1100) · PyTorch 2.14.0 + ROCm 10.1 · Electron desktop</p>
  <p>
    <a href="https://github.com/daMustermann/VoiceStudio-ROCm/tree/rocm">ROCm branch</a> ·
    <a href="#amd-rocm-on-windows">Install this fork</a> ·
    <a href="docs/install/windows.md#gpu-support">AMD GPU guide</a> ·
    <a href="https://github.com/debpalash/VoiceStudio">Original VoiceStudio</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Windows%20x64-AMD%20ROCm%2010.1-blue" alt="Windows AMD ROCm 10.1" />
    <img src="https://img.shields.io/badge/PyTorch-2.14.0%2Brocm10.1.0-orange" alt="PyTorch 2.14.0 ROCm build" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0" /></a>
  </p>
</div>

## AMD ROCm on Windows

This is an **experimental community fork** of [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio),
with an opt-in Windows AMD PyTorch stack. The tested combination is an
**RX 7900 XTX (gfx1100)** with **PyTorch 2.14.0+rocm10.1.0** and **ROCm 10.1**.
Other AMD GPU architectures and individual speech engines may need more work.

**Install from this fork's `rocm` branch** on Windows x64. You need Git,
Node.js 22+, Bun, a compatible AMD driver and enough space for the Python
environment and models. Run in PowerShell:

```powershell
git clone --branch rocm https://github.com/daMustermann/VoiceStudio-ROCm.git
cd VoiceStudio-ROCm
$env:OMNIVOICE_TORCH_VARIANT = 'rocm'
bun install
bun run setup:api
.\.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.version.hip, torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU')"
bun run desktop
```

The ROCm wheels for this setup require **Python 3.11 x64**. ROCm uses the
`torch.cuda` API through HIP, even on AMD hardware. To force the tested
speech-to-text engine before starting the app, set:

```powershell
$env:OMNIVOICE_ASR_BACKEND = 'pytorch-whisper'
$env:OMNIVOICE_PYTORCH_ASR_MODEL = 'openai/whisper-base'
```

### Acceleration status

| Component | RX 7900 XTX on Windows | Notes |
| --- | --- | --- |
| PyTorch / ROCm device detection | **Verified** | AMD GPU recognized through HIP / `torch.cuda` |
| PyTorch Whisper ASR | **Verified on GPU** | German speech transcribed with `openai/whisper-base` |
| OmniVoice TTS | **License-gated; inference not yet tested** | Native generation correctly rejects unaccepted OmniVoice/tokenizer terms |
| OmniVoice subprocess | **Real subprocess ping passed; inference not yet tested** | Same TTS model, model-license review still required |
| audio.cpp Vulkan runtime | **GPU detected; runtime verified** | RX 7900 XTX selected on Vulkan with ~24 GB VRAM; Breeze-TTS-2 weights and license acceptance still missing |
| KittenTTS (CPU fallback) | **Real audio generated** | 5.94 s English speech at 24 kHz, non-silent WAV; CPU-only by design |
| faster-whisper / WhisperX (CTranslate2) | **No ROCm acceleration** | CTranslate2 does not inherit PyTorch HIP support |

VoiceStudio's model manager may require acceptance of licenses for
`k2-fsa/OmniVoice` and `eustlb/higgs-audio-v2-tokenizer`; downloading models
does not grant that acceptance. audio.cpp's Vulkan path is an alternative to
ROCm, with its own model and license requirements. See the
[full Windows ROCm guide](docs/install/windows.md#gpu-support).

The live TTS smoke checks above ran on Windows with an RX 7900 XTX on
2026-10-25. A working native-runtime probe or subprocess ping is **not** proof
that the respective model can synthesize audio on that GPU.

> [!IMPORTANT]
> **The official [VoiceStudio releases](https://github.com/debpalash/VoiceStudio/releases/latest)
> and `voicestudio.sh` installation scripts are maintained upstream.** They
> install upstream VoiceStudio, **not this fork's `rocm` changes**. No fork-specific
> Windows installer has been published; use the source instructions above.

![A tour of the Electron app: voice cloning, voice design, dubbing, and model management](docs/media/electron/voicestudio.gif)

## VoiceStudio features

| Create | Produce | Connect |
| :--- | :--- | :--- |
| Clone a voice or design your own | Dub videos with timed speech | Local API & MCP for agents |
| Dictate with a floating widget | Stories, audiobooks & batch jobs | Reusable recipes & watch folders |

Start with **VoiceStudio** (default, powered by k2-fsa/OmniVoice), or choose another engine. [Features & engine catalog](docs/feature-catalog.md).

Local workflows run on your hardware. Remote services are optional; usage analytics requires consent.

<details>
<summary><strong>Explore the workspaces</strong> · Clone, dub, design & models</summary>

<table>
  <tr>
    <td><img src="docs/media/electron/voice-cloning.png" alt="Electron voice cloning workspace with the bundled demo voice" width="100%" /></td>
    <td><img src="docs/media/electron/dubbing.png" alt="Electron video dubbing workspace" width="100%" /></td>
  </tr>
  <tr><td align="center">Voice cloning</td><td align="center">Video dubbing</td></tr>
  <tr>
    <td><img src="docs/media/electron/voice-design.png" alt="Describe a voice in the Electron voice design workspace" width="100%" /></td>
    <td><img src="docs/media/electron/models.png" alt="Install and manage local speech models" width="100%" /></td>
  </tr>
  <tr><td align="center">Voice design</td><td align="center">Local models</td></tr>
</table>

<img width="2628" height="1950" alt="VoiceStudio desktop workspace" src="https://github.com/user-attachments/assets/b474497d-a453-49a3-a2dd-f023ec6b7659" />

</details>

## Upstream installation and other platforms

The instructions in this section install **upstream VoiceStudio**. For the
Windows AMD ROCm fork, use [the source setup above](#amd-rocm-on-windows).

### Upstream one-command install (macOS / Linux)

```sh
# Latest Electron release
curl -fsSL https://voicestudio.sh/install | sh

# A specific published Electron release (replace X.Y.Z)
curl -fsSL https://voicestudio.sh/install | sh -s -- --version X.Y.Z

# Build current main and install the desktop app
curl -fsSL https://voicestudio.sh/install | sh -s -- --main

# Uninstall the app, keeping your data
curl -fsSL https://voicestudio.sh/install | sh -s -- --uninstall
```

For **upstream** VoiceStudio on Windows, run `irm https://voicestudio.sh/install | iex` in PowerShell.

If `voicestudio.sh/install` is unreachable or returns 404, run the same script
straight from the repository, or clone it and run `scripts/install.sh`:

```bash
curl -fsSL https://raw.githubusercontent.com/debpalash/VoiceStudio/main/scripts/install.sh | sh
```

Release downloads require curl and a SHA-256 tool. `--main` requires Git,
Node.js 22+, Bun, Rust/Cargo, and platform build tools; see
[installer prerequisites and behavior](docs/install/script.md).
The installer preserves your settings, projects, and models. Older versions
must contain Electron packages; it never falls back to archived Tauri builds.

Or download from [Releases](https://github.com/debpalash/VoiceStudio/releases/latest) (macOS `.dmg`, Windows `.exe`, Linux `.AppImage` or `.deb`) and follow your platform guide:

**[macOS](docs/install/macos.md) · [Windows](docs/install/windows.md) · [Linux](docs/install/linux.md) · [Docker](docs/install/docker.md)**

| Hardware | Support |
|---|---|
| NVIDIA GPU (Windows / Linux) | CUDA acceleration |
| Apple Silicon | Metal (MPS) acceleration |
| No dedicated GPU (Intel/AMD integrated graphics, older PCs) | Fully usable on the CPU, slower; setup installs the small CPU build of PyTorch (about 5 GB free disk) |
| Windows on ARM (Snapdragon X etc.) | **Experimental**, validation pending: native ARM64 app, x64 Python backend under emulation, CPU only |
| Intel Mac | App UI only; connect to a remote backend ([why](docs/install/macos.md)) |

Open **Voice cloning**, choose a voice or add a clean reference recording, enter your text, and generate. Install the required model when prompted. Hardware needs vary by engine; see [performance](docs/performance.md).

### Install upstream with a prompt

Paste into your coding agent (Claude Code, Codex, Cursor, …):

```text
Install the upstream VoiceStudio Electron app on this device and verify it works, following
https://github.com/debpalash/VoiceStudio/blob/main/docs/install/agent.md
```

The [agent guide](docs/install/agent.md) covers hardware detection, reusing existing
data, asking before model downloads, and a test generation. Agents that support skills
can also run `npx skills add debpalash/VoiceStudio`.

<details>
<summary><strong>Run the upstream Electron preview from source</strong></summary>

```bash
git clone https://github.com/debpalash/VoiceStudio.git
cd VoiceStudio
bun install
bun run setup:api  # prepare Python dependencies before starting Electron
bun run dev
```

See [Electron setup](electron/README.md) for prerequisites and backend configuration.

Use `bun run smoke-test` to build and launch an isolated packaged Electron app.
Add `-- --install` for the networked managed-runtime installation check.

</details>

> **Electron is the only desktop app and web UI.** Version 0.5.3 was the final Tauri release. Existing Tauri users must [install Electron separately](docs/electron-migration.md). The retired Tauri shell and legacy UI entry points have been removed.

## Documentation

| Need | Start here |
|---|---|
| Setup help | [Troubleshooting](docs/install/troubleshooting.md) · [Model downloads](docs/downloading-models.md) |
| Models & audio quality | [Engine guides](docs/engines/README.md) · [Benchmarks](docs/benchmarks.md) |
| Integrations | [Local API](docs/speech-platform.md) · [MCP](docs/mcp.md) · [Examples](examples/README.md) |
| Phone apps (preview, run offline) | [iOS and Android](docs/mobile.md) |
| Development | [Contributing](.github/CONTRIBUTING.md) ([CLA signing guidance](.github/CONTRIBUTING.md#contribution-licensing) for your first PR) · [Electron](electron/README.md) · [Changelog](CHANGELOG.md) |

Agent skills: `npx skills add debpalash/VoiceStudio` — choose **voicestudio** for audio workflows or **voicestudio-maintainer** for repository maintenance.

## Support the upstream maintainers

Sponsorship funds maintainer time, development tools, release infrastructure and test hardware; it buys recognition, not features.

[GitHub Sponsors](https://github.com/sponsors/debpalash) · [Ko-fi](https://ko-fi.com/debpalash) · [PayPal](https://paypal.me/palashCoder) · [Tiers and recognition](SPONSORS.md) · [Ask for recognition](https://github.com/debpalash/VoiceStudio/issues/new?template=sponsor.yml)

## License & responsible use

[AGPL-3.0](LICENSE) covers the application, including commercial use under its conditions. Model weights, tokenizers, voices and generated-output conditions are separate; a paid app licence does not grant those rights. Clone voices only with permission. Model Manager now shows versioned model-source notices, evidence links and unresolved review gaps from the [shared inventory](docs/licensing/model-inventory.md). Its optional [reviewed-file preview](docs/licensing/model-review-workflow.md) does not enforce ordinary downloads or certify commercial permission. See [license details](LICENSE-NOTICE.md).

