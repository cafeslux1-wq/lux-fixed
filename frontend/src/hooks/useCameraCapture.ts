import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraFacing = 'user' | 'environment';

export interface CaptureState {
  isReady:      boolean;
  error:        string | null;
  photoDataUrl: string | null;
}

export function useCameraCapture(facing: CameraFacing = 'user') {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CaptureState>({ isReady: false, error: null, photoDataUrl: null });

  const startCamera = useCallback(async () => {
    setState({ isReady: false, error: null, photoDataUrl: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState(s => ({ ...s, isReady: true }));
      }
    } catch (err: unknown) {
      const e = err as DOMException;
      const msgs: Record<string, string> = {
        NotAllowedError:  'Accès caméra refusé. Autorisez la caméra dans les paramètres.',
        NotFoundError:    'Aucune caméra détectée sur cet appareil.',
        NotReadableError: 'Caméra déjà utilisée par une autre application.',
      };
      setState(s => ({ ...s, error: msgs[e.name] || 'Erreur caméra: ' + e.message }));
    }
  }, [facing]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setState(s => ({ ...s, photoDataUrl: dataUrl }));
    return dataUrl;
  }, [facing]);

  const retake = useCallback(() => {
    setState(s => ({ ...s, photoDataUrl: null }));
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setState({ isReady: false, error: null, photoDataUrl: null });
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, canvasRef, state, startCamera, capture, retake, stopCamera };
}
