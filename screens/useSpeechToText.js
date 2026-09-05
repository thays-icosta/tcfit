import { useRef, useState, useEffect, useCallback } from 'react';
import { showAlert } from './alertUtils';

const RECORDING_TIMEOUT_MS = 30000;

// Web Speech API wrapper for the "fale em vez de digitar" mic buttons in the
// AI generator modals (workout, diet). Every stop path — the user tapping
// stop, an onerror/onend event, the modal closing, or the 30s safety net —
// funnels through the same `stop()` so the button state can never get stuck
// out of sync with whether a recognition session is actually still live.
export function useSpeechToText({ active, getBaseText, onTranscriptChange }) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  const clearRecordingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearRecordingTimeout();
    setRecording(false);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      try { recognition.abort(); } catch (e) {}
    }
  }, [clearRecordingTimeout]);

  const toggle = useCallback(() => {
    if (recognitionRef.current) {
      stop();
      return;
    }

    const SpeechRecognitionCtor = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognitionCtor) {
      showAlert('Não disponível', 'Reconhecimento de voz não é suportado nesse navegador. Digite o pedido no campo de texto.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const baseText = getBaseText ? getBaseText() : '';

    recognition.onresult = (event) => {
      try {
        let combined = '';
        for (let i = 0; i < event.results.length; i++) {
          combined += event.results[i][0]?.transcript || '';
        }
        onTranscriptChange(baseText ? `${baseText} ${combined}` : combined);
      } catch (e) {
        // no-op: a malformed result event shouldn't kill the recording session
      }
    };
    recognition.onerror = () => {
      try { stop(); } catch (e) { setRecording(false); }
    };
    recognition.onend = () => {
      try { stop(); } catch (e) { setRecording(false); }
    };

    recognitionRef.current = recognition;
    setRecording(true);
    try {
      recognition.start();
    } catch (e) {
      stop();
      return;
    }

    // Safety net: never leave the mic listening (or the button stuck) forever.
    // Whatever was transcribed up to this point already sits in the field via
    // the live onresult updates above.
    clearRecordingTimeout();
    timeoutRef.current = setTimeout(() => {
      stop();
    }, RECORDING_TIMEOUT_MS);
  }, [getBaseText, onTranscriptChange, stop, clearRecordingTimeout]);

  // If the modal/screen using this hook gets closed mid-recording, stop the
  // mic instead of letting it keep listening in the background.
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { recording, toggle };
}
