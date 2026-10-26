import { setRecordingBusy } from '@/lib/store/reference';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { throttle } from '@tanstack/react-pacer';
import { toast } from 'sonner';
import { cleanAudio } from '@/lib/api/audio';
import {
  buildAudioInputConstraints,
  describeMicError,
  extensionForMime,
  listAudioInputs,
  startInputLevelMonitor,
  startSupportedMediaRecorder,
  type ChannelMode,
} from '@/lib/audio/recorder';
import { tr } from '@/lib/i18n-text';
import { beginAppActivity } from '@/lib/app-activity';

export type { ChannelMode } from '@/lib/audio/recorder';

/** Below this the blob is a click, not speech — MediaRecorder headers alone are a few hundred bytes. */
const MIN_RECORDING_BYTES = 1000;
const TIMER_TICK_MS = 100;
const LEVEL_THROTTLE_MS = 50;

export interface UseRecording {
  isRecording: boolean;
  isStarting: boolean;
  isCleaning: boolean;
  seconds: number;
  inputs: MediaDeviceInfo[];
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  channelMode: ChannelMode;
  setChannelMode: (mode: ChannelMode) => void;
  /** Input RMS level, 0..1. */
  level: number;
  start(): Promise<void>;
  stop(): void;
}

/**
 * Record a reference clip. Microphones may use optional source separation;
 * system output defaults to the original clip to preserve the speaker's timbre.
 */
export function useRecording(
  onRecorded: (file: File) => void,
  trackReference = true,
  source: 'microphone' | 'system' = 'microphone',
  cleanUp = source === 'microphone',
): UseRecording {
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const finishActivity = useRef<(() => void) | null>(null);
  useEffect(() => {
    const busy = isRecording || isStarting || isCleaning;
    if (busy && !finishActivity.current) finishActivity.current = beginAppActivity('recording');
    if (!busy && finishActivity.current) {
      finishActivity.current();
      finishActivity.current = null;
    }
  }, [isRecording, isStarting, isCleaning]);
  useEffect(
    () => () => {
      finishActivity.current?.();
      finishActivity.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!trackReference) return;
    setRecordingBusy(isRecording || isStarting || isCleaning);
    return () => setRecordingBusy(false);
  }, [isRecording, isStarting, isCleaning, trackReference]);
  const [seconds, setSeconds] = useState(0);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [channelMode, setChannelMode] = useState<ChannelMode>('auto');
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopLevelRef = useRef<(() => void) | null>(null);
  const startingRef = useRef(false);
  const lifecycle = useRef(0);
  const cleaningRequest = useRef<AbortController | null>(null);

  // 60 fps analyser samples would re-render the whole form; ~20 fps is plenty for a meter.
  const publishLevel = useMemo(
    () => throttle((value: number) => setLevel(value), { wait: LEVEL_THROTTLE_MS }),
    [],
  );

  const refreshInputs = useCallback(async () => {
    try {
      const devices = await listAudioInputs();
      setInputs(devices);
      setSelectedInputId((current) =>
        current && !devices.some((device) => device.deviceId === current) ? '' : current,
      );
    } catch {
      setInputs([]);
    }
  }, []);

  const stopLevelMonitor = useCallback(() => {
    stopLevelRef.current?.();
    stopLevelRef.current = null;
    setLevel(0);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (source === 'microphone') void refreshInputs();
    const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    const onChange = (): void => void refreshInputs();
    if (source === 'microphone') mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      lifecycle.current++;
      cleaningRequest.current?.abort();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      mediaDevices?.removeEventListener?.('devicechange', onChange);
      stopLevelRef.current?.();
      clearTimer();
      releaseStream();
    };
  }, [refreshInputs, clearTimer, releaseStream, source]);

  const finishRecording = useCallback(
    async (blob: Blob, extension: string) => {
      clearTimer();
      stopLevelMonitor();
      releaseStream();
      recorderRef.current = null;
      setIsRecording(false);
      if (blob.size < MIN_RECORDING_BYTES) {
        toast.error(tr('recording.too_short'));
        return;
      }
      const generation = lifecycle.current;
      const filename = `recording.${extension}`;
      if (!cleanUp) {
        if (generation === lifecycle.current) {
          onRecordedRef.current(new File([blob], filename, { type: blob.type }));
          toast.success(tr('recording.loaded_original'));
        }
        return;
      }
      const request = new AbortController();
      cleaningRequest.current = request;
      setIsCleaning(true);
      try {
        const clean = await cleanAudio(blob, filename, request.signal);
        if (generation !== lifecycle.current || request.signal.aborted) return;
        onRecordedRef.current(clean);
        toast.success(tr('recording.cleaned_loaded'));
      } catch {
        if (generation !== lifecycle.current || request.signal.aborted) return;
        onRecordedRef.current(new File([blob], filename, { type: blob.type }));
        toast.success(tr('recording.loaded_raw'));
      } finally {
        if (cleaningRequest.current === request) cleaningRequest.current = null;
        if (generation === lifecycle.current) setIsCleaning(false);
      }
    },
    [clearTimer, stopLevelMonitor, releaseStream, cleanUp],
  );

  const start = useCallback(async () => {
    if (startingRef.current || recorderRef.current) return;
    const generation = lifecycle.current;
    startingRef.current = true;
    setIsStarting(true);
    try {
      const stream =
        source === 'system'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia(
              buildAudioInputConstraints(selectedInputId, channelMode),
            );
      if (generation !== lifecycle.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const audioTracks = source === 'system' ? stream.getAudioTracks() : [];
      if (source === 'system' && !audioTracks.length) {
        releaseStream();
        toast.error(tr('clone.system_audio_unavailable'));
        return;
      }
      // Labels are only populated once a stream has been granted.
      if (source === 'microphone') void refreshInputs();
      stopLevelMonitor();
      try {
        stopLevelRef.current = startInputLevelMonitor(stream, publishLevel);
      } catch {
        // The meter is optional; recording must still work without Web Audio.
        stopLevelRef.current = null;
      }

      const chunks: Blob[] = [];
      let format = { mimeType: 'audio/webm', extension: 'webm' };
      // Record only sound: getDisplayMedia requires a display/video track but
      // feeding it into MediaRecorder would create video instead of voice input.
      const recordingStream = source === 'system' ? new MediaStream(audioTracks) : stream;
      const started = startSupportedMediaRecorder(recordingStream, {
        // Opus at Chromium's default bitrate can audibly soften voice details.
        // A higher target bitrate helps preserve timbre for clean PC recordings.
        ...(source === 'system' ? { audioBitsPerSecond: 256_000 } : {}),
        onData: (chunk) => {
          if (chunk.type)
            format = { mimeType: chunk.type, extension: extensionForMime(chunk.type) };
          chunks.push(chunk);
        },
        onStop: () => {
          if (generation !== lifecycle.current) return;
          void finishRecording(new Blob(chunks, { type: format.mimeType }), format.extension);
        },
      });
      if (!started) {
        stopLevelMonitor();
        releaseStream();
        toast.error(tr('recording.recorder_unsupported'));
        return;
      }
      format = { mimeType: started.mimeType, extension: started.extension };
      recorderRef.current = started.recorder;
      if (source === 'system') {
        // Stopping display sharing externally must finish and release the clip.
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener(
            'ended',
            () => {
              if (generation === lifecycle.current && recorderRef.current === started.recorder)
                stopRecorderOnDisplayEnd(started.recorder);
            },
            { once: true },
          );
        });
      }
      setSeconds(0);
      setIsRecording(true);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        setSeconds(Math.round((Date.now() - startedAt) / TIMER_TICK_MS) / 10);
      }, TIMER_TICK_MS);
    } catch (err) {
      if (generation !== lifecycle.current) return;
      stopLevelMonitor();
      releaseStream();
      if (source === 'system')
        toast.error(tr('clone.system_audio_unavailable'), { duration: 6000 });
      else {
        const { key, params } = describeMicError(err);
        toast.error(tr(key, params), { duration: 6000 });
      }
    } finally {
      startingRef.current = false;
      if (generation === lifecycle.current) setIsStarting(false);
    }
  }, [
    selectedInputId,
    source,
    channelMode,
    refreshInputs,
    stopLevelMonitor,
    releaseStream,
    publishLevel,
    finishRecording,
  ]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // onstop → finishRecording
    } else {
      recorderRef.current = null;
      clearTimer();
      releaseStream();
    }
    stopLevelMonitor();
    setIsRecording(false);
  }, [clearTimer, releaseStream, stopLevelMonitor]);

  return {
    isRecording,
    isStarting,
    isCleaning,
    seconds,
    inputs,
    selectedInputId,
    setSelectedInputId,
    channelMode,
    setChannelMode,
    level,
    start,
    stop,
  };
}

function stopRecorderOnDisplayEnd(recorder: MediaRecorder): void {
  if (recorder.state !== 'inactive') recorder.stop();
}
