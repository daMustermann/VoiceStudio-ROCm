import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRecording } from './use-recording';
import { cleanAudio } from '@/lib/api/audio';
import { startSupportedMediaRecorder } from '@/lib/audio/recorder';
import { toast } from 'sonner';
vi.mock('@/lib/api/audio', () => ({ cleanAudio: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/audio/recorder', () => ({
  buildAudioInputConstraints: () => ({ audio: true }),
  describeMicError: () => ({ key: 'error' }),
  extensionForMime: () => 'webm',
  listAudioInputs: async () => [],
  startInputLevelMonitor: () => vi.fn(),
  startSupportedMediaRecorder: vi.fn(),
}));
const getUserMedia = vi.fn();
const getDisplayMedia = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockReset();
  getDisplayMedia.mockReset();
  vi.mocked(startSupportedMediaRecorder).mockReset();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      getDisplayMedia,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it('releases a microphone granted after navigation without starting a recorder', async () => {
  let grant!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValue(
    new Promise<MediaStream>((resolve) => {
      grant = resolve;
    }),
  );
  const stop = vi.fn();
  const { result, unmount } = renderHook(() => useRecording(vi.fn()));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.start();
  });
  unmount();
  await act(async () => {
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await pending;
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(startSupportedMediaRecorder).not.toHaveBeenCalled();
});
it('does not deliver cleaned audio after its recording view unmounts', async () => {
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  let complete!: (file: File) => void;
  vi.mocked(cleanAudio).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  vi.mocked(startSupportedMediaRecorder).mockImplementation((_stream, callbacks) => ({
    mimeType: 'audio/webm',
    extension: 'webm',
    recorder: {
      state: 'recording',
      stop: () => {
        callbacks.onData(new Blob(['x'.repeat(2000)]));
        callbacks.onStop();
      },
    } as unknown as MediaRecorder,
  }));
  const onRecorded = vi.fn();
  const { result, unmount } = renderHook(() => useRecording(onRecorded));
  await act(async () => {
    await result.current.start();
  });
  act(() => result.current.stop());
  unmount();
  expect(vi.mocked(cleanAudio).mock.calls[0][2]?.aborted).toBe(true);
  await act(async () => {
    complete(new File(['clean'], 'clean.wav'));
  });
  expect(onRecorded).not.toHaveBeenCalled();
});

it('captures PC playback as audio-only, cleans the clip, and releases display tracks on stop', async () => {
  const audioStop = vi.fn();
  const videoStop = vi.fn();
  const audio = { stop: audioStop } as unknown as MediaStreamTrack;
  const video = { stop: videoStop, addEventListener: vi.fn() } as unknown as MediaStreamTrack;
  const display = {
    getTracks: () => [video, audio],
    getVideoTracks: () => [video],
    getAudioTracks: () => [audio],
  } as unknown as MediaStream;
  getDisplayMedia.mockResolvedValue(display);
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(public tracks: MediaStreamTrack[]) {}
    },
  );
  vi.mocked(cleanAudio).mockResolvedValue(
    new File(['clean audio'], 'clean.wav', { type: 'audio/wav' }),
  );
  const recorderStop = vi.fn();
  vi.mocked(startSupportedMediaRecorder).mockImplementation((_stream, callbacks) => ({
    mimeType: 'audio/webm',
    extension: 'webm',
    recorder: {
      state: 'recording',
      stop: () => {
        recorderStop();
        callbacks.onData(new Blob(['a'.repeat(2000)], { type: 'audio/webm' }));
        callbacks.onStop();
      },
    } as unknown as MediaRecorder,
  }));
  const onRecorded = vi.fn();
  const { result } = renderHook(() => useRecording(onRecorded, true, 'system'));
  await act(async () => result.current.start());
  expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: true });
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(vi.mocked(startSupportedMediaRecorder).mock.calls[0][0]).toEqual({ tracks: [audio] });
  expect(result.current.isRecording).toBe(true);
  act(() => result.current.stop());
  await waitFor(() => expect(onRecorded).toHaveBeenCalledOnce());
  expect(onRecorded.mock.calls[0][0].name).toBe('clean.wav');
  expect(recorderStop).toHaveBeenCalledOnce();
  expect(videoStop).toHaveBeenCalledOnce();
  expect(audioStop).toHaveBeenCalledOnce();
});

it('rejects PC capture without loopback audio and releases the display track', async () => {
  const stop = vi.fn();
  getDisplayMedia.mockResolvedValue({
    getAudioTracks: () => [],
    getTracks: () => [{ stop }],
  });
  const { result } = renderHook(() => useRecording(vi.fn(), true, 'system'));
  await act(async () => result.current.start());
  expect(startSupportedMediaRecorder).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
  expect(toast.error).toHaveBeenCalledWith('clone.system_audio_unavailable');
  expect(result.current.isRecording).toBe(false);
});
