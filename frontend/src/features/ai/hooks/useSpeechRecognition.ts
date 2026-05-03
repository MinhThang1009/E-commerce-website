import { useState, useEffect, useCallback } from 'react';

interface SpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  browserSupportsSpeech: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export const useSpeechRecognition = (): SpeechRecognitionResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [browserSupportsSpeech, setBrowserSupportsSpeech] = useState(false);

  // Kiểm tra trình duyệt có hỗ trợ nhận dạng giọng nói không
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setBrowserSupportsSpeech(!!SpeechRecognition);
  }, []);

  // Khởi tạo đối tượng nhận dạng giọng nói
  const recognition = useCallback(() => {
    if (!browserSupportsSpeech) return null;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();

    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'vi-VN'; // Ngôn ngữ tiếng Việt

    recognitionInstance.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptValue = result[0].transcript;
      setTranscript(transcriptValue);
    };

    recognitionInstance.onerror = (event) => {
      console.error('Lỗi nhận dạng giọng nói', event.error);
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    return recognitionInstance;
  }, [browserSupportsSpeech]);

  const startListening = useCallback(() => {
    const recognitionInstance = recognition();
    if (!recognitionInstance) return;

    setTranscript('');
    setIsListening(true);
    recognitionInstance.start();
  }, [recognition]);

  const stopListening = useCallback(() => {
    const recognitionInstance = recognition();
    if (!recognitionInstance) return;

    recognitionInstance.stop();
    setIsListening(false);
  }, [recognition]);

  return {
    isListening,
    transcript,
    browserSupportsSpeech,
    startListening,
    stopListening,
  };
};

// Khai báo TypeScript cho Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

