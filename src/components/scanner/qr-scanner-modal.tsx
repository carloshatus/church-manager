import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  AlertCircle,
  Keyboard,
  SwitchCamera,
  Zap,
  ZapOff,
  ZoomIn,
  RotateCw,
  SlidersHorizontal,
  RefreshCw,
  Focus,
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

interface BarcodeResult {
  rawValue: string;
  format?: string;
}

interface NativeBarcodeDetector {
  detect: (source: ImageBitmapSource) => Promise<BarcodeResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): NativeBarcodeDetector;
    };
  }
}

function formatCameraLabel(label: string, index: number): string {
  const clean = (label || '').trim();
  const lower = clean.toLowerCase();

  const isFront =
    lower.includes('front') ||
    lower.includes('user') ||
    lower.includes('selfie') ||
    lower.includes('frontal') ||
    lower.includes('face');

  if (isFront) {
    return `Frontal (Selfie) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isUltraWide =
    lower.includes('ultra') ||
    lower.includes('0.5') ||
    lower.includes('wide-angle') ||
    lower.includes('wide angle');

  if (isUltraWide) {
    return `Traseira 0.5x (Grande Angular) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isTele =
    lower.includes('tele') ||
    lower.includes('zoom') ||
    lower.includes('2x') ||
    lower.includes('3x');

  if (isTele) {
    return `Traseira Tele/Zoom ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isMain =
    lower.includes('main') ||
    lower.includes('primary') ||
    lower.includes('principal') ||
    lower.includes('1x');

  if (isMain) {
    return `Traseira 1x (Principal) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isGenericBack =
    lower.includes('back') ||
    lower.includes('rear') ||
    lower.includes('environment') ||
    lower.includes('traseira');

  if (isGenericBack) {
    return `Traseira ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  return `Câmera #${index + 1} ${clean ? `• ${clean}` : ''}`;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);

  const isScanningRef = useRef(false);
  const hasScannedRef = useRef(false);

  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [activeResolution, setActiveResolution] = useState<string | null>(null);

  // Zoom & Lanterna
  const [zoomSupported, setZoomSupported] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Foto & Entrada manual
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [focusPulse, setFocusPulse] = useState<{ x: number; y: number } | null>(null);

  // Inicializa BarcodeDetector de hardware (quando suportado nativamente)
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        nativeDetectorRef.current = new window.BarcodeDetector!({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
        });
      } catch {
        nativeDetectorRef.current = null;
      }
    }
  }, []);

  // Parada limpa da câmera e cancelamento do loop de animação
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Erro ao finalizar track de vídeo:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Fechamento seguro do modal
  const handleClose = useCallback(() => {
    hasScannedRef.current = true;
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  // Sucesso na leitura do código
  const handleSuccess = useCallback(
    (decodedText: string) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      isScanningRef.current = false;
      stopCamera();
      onScanSuccess(decodedText);
      onClose();
    },
    [onClose, onScanSuccess, stopCamera]
  );

  const scanFrameRef = useRef<() => void>(() => {});

  // Loop contínuo de leitura de frames (padrão idêntico e direto de calculate-bills-v0)
  const scanFrame = useCallback(() => {
    if (!isScanningRef.current || hasScannedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      if (isScanningRef.current && !hasScannedRef.current) {
        animFrameRef.current = requestAnimationFrame(() => scanFrameRef.current());
      }
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 1. Tenta detecção acelerada por hardware via BarcodeDetector nativo (Chrome Android)
    if (nativeDetectorRef.current) {
      nativeDetectorRef.current
        .detect(video)
        .then((barcodes) => {
          if (
            !hasScannedRef.current &&
            isScanningRef.current &&
            barcodes &&
            barcodes.length > 0 &&
            barcodes[0]?.rawValue
          ) {
            handleSuccess(barcodes[0].rawValue);
          }
        })
        .catch(() => {
          // Continua para o jsQR
        });
    }

    // 2. Leitura com jsQR em resolução nativa direta no Canvas (modelo idêntico a calculate-bills-v0)
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      try {
        canvas.width = vw;
        canvas.height = vh;
        ctx.drawImage(video, 0, 0, vw, vh);

        const imageData = ctx.getImageData(0, 0, vw, vh);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code?.data && !hasScannedRef.current && isScanningRef.current) {
          handleSuccess(code.data);
          return;
        }
      } catch {
        // Ignora erros transitórios de frame
      }
    }

    if (isScanningRef.current && !hasScannedRef.current) {
      animFrameRef.current = requestAnimationFrame(() => scanFrameRef.current());
    }
  }, [handleSuccess]);

  useEffect(() => {
    scanFrameRef.current = scanFrame;
  }, [scanFrame]);

  // Inicia ou alterna a câmera ativa com WebRTC nativo
  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      try {
        setIsSwitchingCamera(true);
        setCameraError(null);
        stopCamera();
        hasScannedRef.current = false;

        let stream: MediaStream | null = null;

        // 1. Tenta com preferredCameraId (se informado pelo usuário)
        if (preferredCameraId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: preferredCameraId },
              },
              audio: false,
            });
          } catch (prefErr) {
            console.warn(
              'Falha ao abrir câmera com deviceId específico, usando padrão traseira...',
              prefErr
            );
          }
        }

        // 2. Se não abriu, usa a câmera traseira padrão (environment)
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: 'environment' } },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: false,
            });
          }
        }

        streamRef.current = stream;

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings?.();
          if (settings?.width && settings?.height) {
            setActiveResolution(`${settings.width}x${settings.height}`);
          }
          if (settings?.deviceId) {
            setActiveCameraId(settings.deviceId);
          }

          // Foco contínuo nativo (se suportado pelo hardware)
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            });
          } catch {
            // Focus contínuo pode não ser suportado
          }

          // Detecta capacidades de Lanterna e Zoom da lente ativa
          try {
            const caps = track.getCapabilities?.() as
              | {
                  zoom?: { min?: number; max?: number };
                  torch?: boolean;
                }
              | undefined;

            if (caps?.torch) {
              setTorchSupported(true);
            } else {
              setTorchSupported(false);
            }

            if (caps?.zoom && caps.zoom.max && caps.zoom.max > 1) {
              setZoomSupported(true);
              setMinZoom(caps.zoom.min ?? 1);
              setMaxZoom(Math.min(5, caps.zoom.max));
              setCurrentZoom(1);
            } else {
              setZoomSupported(false);
            }
          } catch {
            setTorchSupported(false);
            setZoomSupported(false);
          }
        }

        // Enumera dispositivos após permissão concedida
        if (navigator.mediaDevices?.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevs = devices
              .filter((d) => d.kind === 'videoinput')
              .map((d, index) => ({
                id: d.deviceId,
                label: d.label || `Câmera ${index + 1}`,
              }));
            if (videoDevs.length > 0) {
              setAvailableCameras(videoDevs);
            }
          } catch {
            // Ignora erro de enumeração
          }
        }

        // Inicia escaneamento em tempo real
        isScanningRef.current = true;
        animFrameRef.current = requestAnimationFrame(() => scanFrameRef.current());
      } catch (err: unknown) {
        console.warn('Erro ao iniciar câmera:', err);
        const errorName = (err as DOMException)?.name;
        setCameraError(
          errorName === 'NotAllowedError'
            ? 'Permissão de acesso à câmera negada. Permita nas configurações do navegador.'
            : 'Dificuldade para acessar a câmera. Use o botão "Tirar Foto com Celular" ou digite a chave.'
        );
      } finally {
        setIsSwitchingCamera(false);
      }
    },
    [stopCamera]
  );

  // Inicialização e limpeza ao abrir/fechar o modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;

    // Timeout mínimo para garantir renderização do elemento <video>
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        void startCamera();
      }
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      stopCamera();
      setCameraError(null);
      setManualInput('');
      setShowManualInput(false);
      setIsTorchOn(false);
      setCurrentZoom(1);
      setActiveResolution(null);
      hasScannedRef.current = false;
    };
  }, [isOpen, startCamera, stopCamera]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Troca de câmera via seleção explícita
  const handleSelectCamera = async (newCameraId: string) => {
    if (!newCameraId || newCameraId === activeCameraId || isSwitchingCamera) return;
    setActiveCameraId(newCameraId);
    await startCamera(newCameraId);
  };

  // Alterna ciclicamente entre as câmeras / lentes traseiras
  const handleSwitchCameraCycle = async () => {
    if (availableCameras.length <= 1 || isSwitchingCamera) return;

    const backCameras = availableCameras.filter(
      (c) =>
        !c.label.toLowerCase().includes('front') &&
        !c.label.toLowerCase().includes('user') &&
        !c.label.toLowerCase().includes('selfie') &&
        !c.label.toLowerCase().includes('frontal')
    );

    const list = backCameras.length > 1 ? backCameras : availableCameras;
    const currentIndex = list.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % list.length;
    const nextCamera = list[nextIndex];

    if (nextCamera) {
      await handleSelectCamera(nextCamera.id);
    }
  };

  // Atualiza lista de câmeras manualmente
  const handleRefreshCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          id: d.deviceId,
          label: d.label || `Câmera ${index + 1}`,
        }));
      if (videoDevs.length > 0) {
        setAvailableCameras(videoDevs);
      }
    } catch {
      // Ignora erro
    }
  };

  // Força foco com toque na tela
  const handleRefocus = useCallback(async (e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      setFocusPulse({ x, y });
      setTimeout(() => setFocusPulse(null), 1000);
    }
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
      });
    } catch {
      // Ignora se não suportado
    }
  }, []);

  // Ajusta zoom da câmera
  const handleApplyZoom = async (zoomValue: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomValue } as MediaTrackConstraintSet],
      });
      setCurrentZoom(zoomValue);
    } catch (e) {
      console.warn('Falha ao aplicar zoom:', e);
    }
  };

  // Liga/desliga lanterna
  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Falha ao acionar lanterna:', e);
    }
  };

  // Fallback: Tirar foto com o aplicativo oficial da câmera do celular
  const handleNativePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningPhoto(true);
    setCameraError(null);

    try {
      const bitmap = await createImageBitmap(file);

      // 1. Hardware BarcodeDetector
      if (nativeDetectorRef.current) {
        try {
          const barcodes = await nativeDetectorRef.current.detect(bitmap);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleSuccess(barcodes[0].rawValue);
            return;
          }
        } catch {
          // Continua para jsQR
        }
      }

      // 2. jsQR no Canvas da foto
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        const qr = jsQR(imgData.data, bitmap.width, bitmap.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (qr && qr.data) {
          handleSuccess(qr.data);
          return;
        }
      }

      setCameraError(
        'QR Code não identificado na foto. Certifique-se de aproximar bem a câmera do QR Code e garantir boa iluminação.'
      );
    } catch {
      setCameraError(
        'Não foi possível processar a foto. Tente novamente ou digite a chave.'
      );
    } finally {
      setIsScanningPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleSuccess(manualInput.trim());
  };

  if (!isOpen) {
    return null;
  }

  const activeCameraObj = availableCameras.find((c) => c.id === activeCameraId);
  const activeCameraLabel = activeCameraObj
    ? formatCameraLabel(activeCameraObj.label, availableCameras.indexOf(activeCameraObj))
    : 'Câmera Traseira Padrão';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Bar com Controles de Hardware */}
      <div className="w-full flex items-center justify-between max-w-md pt-1 px-1">
        <div className="flex items-center gap-2 text-white font-medium">
          <Camera className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm font-semibold">Leitor de QR Code Fiscal</span>
          {activeResolution && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              title="Resolução ativa capturada da câmera"
            >
              {activeResolution}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Lanterna (se suportado) */}
          {torchSupported && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2 rounded-full transition ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
              title="Ligar/Desligar Lanterna"
              aria-label="Lanterna"
            >
              {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Botão de Trocar Câmera / Lente rápida */}
          {availableCameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCameraCycle}
              disabled={isSwitchingCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 text-slate-200 hover:text-white text-xs font-medium border border-slate-700/60 transition disabled:opacity-50"
              title="Alternar entre lentes da câmera"
            >
              <SwitchCamera
                className={`w-4 h-4 text-primary ${isSwitchingCamera ? 'animate-spin' : ''}`}
              />
              <span className="hidden xs:inline">Trocar</span>
            </button>
          )}

          {/* Botão Fechar no Topo */}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-300 hover:text-white rounded-full bg-slate-800/90 border border-slate-700/70 transition"
            aria-label="Fechar Scanner"
            title="Fechar Scanner (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport do Scanner com Seletor Explícito de Câmeras */}
      <div className="w-full max-w-sm flex flex-col items-center justify-center my-auto px-2">
        {/* BARRA DE SELEÇÃO DE CÂMERA */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-lg mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium flex-shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>Lente:</span>
          </div>

          {availableCameras.length > 1 ? (
            <select
              value={activeCameraId || ''}
              onChange={(e) => void handleSelectCamera(e.target.value)}
              disabled={isSwitchingCamera}
              className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-2.5 py-1.5 focus:border-primary focus:outline-none truncate"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {formatCameraLabel(cam.label, idx)}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex-1 text-xs text-slate-200 truncate px-1">
              {availableCameras.length === 1 ? activeCameraLabel : 'Detectando lentes...'}
            </div>
          )}

          {activeResolution && (
            <span
              className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-lg flex-shrink-0 hidden xs:inline-block"
              title="Resolução ativa do sensor"
            >
              {activeResolution}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefreshCameras}
            title="Atualizar lista de lentes"
            className="p-1 text-slate-400 hover:text-primary transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {!cameraError ? (
          <>
            <div
              onClick={handleRefocus}
              className="relative w-full aspect-square overflow-hidden rounded-3xl border-2 border-primary/50 shadow-2xl bg-black cursor-pointer select-none"
              title="Toque no visor para re-focar"
            >
              {/* Elemento de vídeo direto com WebRTC (PlaysInline para iOS Safari e Android) */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Linha animada do Laser */}
              <div className="scanner-laser-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444]" />

              {/* Cantoneiras Visuais */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg pointer-events-none" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg pointer-events-none" />

              {/* Pulso de Foco ao Tocar */}
              {focusPulse && (
                <div
                  className="absolute w-12 h-12 border-2 border-amber-400 rounded-full animate-ping pointer-events-none"
                  style={{
                    left: `${focusPulse.x - 24}px`,
                    top: `${focusPulse.y - 24}px`,
                  }}
                />
              )}

              {/* Feedback quando está trocando lente */}
              {isSwitchingCamera && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2 text-white text-xs font-medium backdrop-blur-sm">
                  <RotateCw className="w-5 h-5 text-primary animate-spin" />
                  <span>Alternando câmera...</span>
                </div>
              )}
            </div>

            {/* Dica de foco e distância */}
            <div className="flex items-center justify-between w-full px-1 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Focus className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Aproxime a 15–20 cm (toque para focar)</span>
              </span>
              <button
                type="button"
                onClick={() => void handleRefocus()}
                className="text-primary hover:underline font-medium text-[11px]"
              >
                Re-focar
              </button>
            </div>
          </>
        ) : (
          <div className="w-full rounded-2xl border border-red-500/30 bg-red-950/20 p-5 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-semibold text-sm mb-1">
              Dificuldade com a Câmera
            </h4>
            <p className="text-slate-400 text-xs mb-4">{cameraError}</p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
            >
              <Camera className="w-4 h-4" />
              Tirar Foto com Foco Automático
            </button>
          </div>
        )}

        {/* Controles de Zoom / Ajuste de Lente */}
        {zoomSupported && !cameraError && (
          <div className="flex items-center gap-2 mt-3 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Aproximar:</span>
            {[
              ...(minZoom < 1 ? [0.5] : []),
              1,
              ...(maxZoom >= 1.5 ? [1.5] : []),
              ...(maxZoom >= 2 ? [2] : []),
            ].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => void handleApplyZoom(lvl)}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  currentZoom === lvl
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-300 hover:text-white bg-slate-800/60'
                }`}
              >
                {lvl}x
              </button>
            ))}
          </div>
        )}

        {/* Input escondido para foto nativa com foco da câmera do aparelho */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleNativePhotoCapture}
          className="hidden"
        />

        {/* Formulário de Digitação Manual */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="w-full mt-3 space-y-2">
            <label className="text-xs text-slate-300 block text-left">
              Cole a URL da SEFAZ ou os 44 dígitos da chave:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="https://... ou 2926..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition"
              >
                Inserir
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer com Ações Alternativas e Botão Fechar no rodapé */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2.5 pb-4">
        {/* Botão de Foto Nativa (Laser Autofocus) */}
        {!cameraError && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningPhoto}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-500/50 px-4 py-2.5 text-xs font-semibold text-white transition shadow-lg shadow-emerald-950/40"
          >
            {isScanningPhoto ? (
              <>
                <RotateCw className="w-4 h-4 text-white animate-spin" />
                <span>Decodificando foto do cupom...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-white" />
                <span>📸 Tirar Foto com Câmera do Celular (Foco Perfeito)</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          {!showManualInput && !cameraError && (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="inline-flex items-center gap-1.5 hover:text-primary transition underline underline-offset-4"
            >
              <Keyboard className="w-3.5 h-3.5" />
              Digitar chave
            </button>
          )}

          {availableCameras.length > 1 && !cameraError && (
            <button
              type="button"
              onClick={handleSwitchCameraCycle}
              className="inline-flex items-center gap-1.5 hover:text-primary transition underline underline-offset-4"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              Próxima lente
            </button>
          )}

          {/* Botão Fechar no rodapé */}
          <button
            type="button"
            onClick={handleClose}
            className="hover:text-white transition underline underline-offset-4"
          >
            Fechar leitor
          </button>
        </div>
      </div>
    </div>
  );
};
