import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, IconButton, Typography, CircularProgress, LinearProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import api from '../lib/api';

const formatSeconds = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;
  return `${minutes}:${formattedSeconds}`;
};

const VoiceRecording = ({
  onCancel = () => {},
  onConfirm = () => {},
  className = '',
  transcribe = true,
  displayMedia = false,
  echoCancellation = true,
  noiseSuppression = true,
  autoGainControl = true,
}) => {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (recording) {
      setDuration(0);
      const interval = setInterval(() => setDuration((d) => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [recording]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    setTranscription('');
    setAudioUrl(null);
    setAudioBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      source.connect(analyserRef.current);
      animateLevel();
      mediaRecorderRef.current = new window.MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stopStream();
      };
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      setError('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    cancelAnimationFrame(animationRef.current);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const animateLevel = () => {
    if (!analyserRef.current) return;
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);
    // Calculate RMS
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    setLevel(Math.min(1, rms * 4));
    animationRef.current = requestAnimationFrame(animateLevel);
  };

  const handleCancel = () => {
    stopRecording();
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscription('');
    setError(null);
    onCancel();
  };

  const handleConfirm = async () => {
    if (!audioBlob) return;
    setLoading(true);
    setError(null);
    try {
      let transcript = '';
      if (transcribe) {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        const res = await api.transcribeAudio(formData);
        transcript = res.text || '';
        setTranscription(transcript);
      }
      onConfirm({ audioBlob, audioUrl, transcription: transcript });
    } catch (err) {
      setError('Transcription failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {!recording && !audioUrl && (
        <IconButton color="primary" onClick={startRecording} size="large">
          <MicIcon fontSize="large" />
        </IconButton>
      )}
      {recording && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Recording... {formatSeconds(duration)}</Typography>
          <LinearProgress variant="determinate" value={level * 100} sx={{ width: 120, height: 8, borderRadius: 4 }} />
          <IconButton color="error" onClick={stopRecording} size="large">
            <StopIcon fontSize="large" />
          </IconButton>
        </Box>
      )}
      {audioUrl && !recording && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <audio src={audioUrl} controls style={{ width: 200 }} />
          {transcribe && (
            <Button onClick={handleConfirm} variant="contained" color="primary" disabled={loading} startIcon={<CheckIcon />}>
              {loading ? <CircularProgress size={20} /> : 'Transcribe & Use'}
            </Button>
          )}
          <Button onClick={handleCancel} variant="outlined" color="secondary" startIcon={<CloseIcon />}>Cancel</Button>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          {transcription && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">Transcription:</Typography>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>{transcription}</Typography>
            </Box>
          )}
        </Box>
      )}
      {error && !audioUrl && <Typography color="error" variant="body2">{error}</Typography>}
    </Box>
  );
};

export default VoiceRecording; 