import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
  type CameraDevice,
} from 'html5-qrcode';
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

const PREFERRED_CAMERA_KEY = 'church_manager_preferred_camera';

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

// Seleciona a lente principal (1x com autofoco mecânico) e evita a lente 0.5x (ultra-wide de foco fixo)
function findBestBackCamera(cameras: CameraDevice[]): string | undefined {
  if (!cameras || cameras.length === 0) return undefined;

  const backCameras = cameras.filter((c) => {
    const l = (c.label || '').toLowerCase();
    return (
      !l.includes('front') &&
      !l.includes('user') &&
      !l.includes('selfie') &&
      !l.includes('frontal') &&
      !l.includes('face')
    );
  });

  const list = backCameras.length > 0 ? backCameras : cameras;

  // 1. Procura câmera identificada como principal / 1x / primary
  const mainCamera = list.find((c) => {
    const l = (c.label || '').toLowerCase();
    return (
      l.includes('main') ||
      l.includes('primary') ||
      l.includes('principal') ||
      l.includes('1x') ||
      l.includes('back 0') ||
      l.includes('camera2 0')
    );
  });
  if (mainCamera) return mainCamera.id;

  // 2. Filtra qualquer uma que NÃO seja ultra-wide (0.5x)
  const nonUltraWide = list.filter((c) => {
    const l = (c.label || '').toLowerCase();
    return (
      !l.includes('ultra') &&
      !l.includes('0.5') &&
      !l.includes('wide-angle') &&
      !l.includes('wide angle')
    );
  });

  if (nonUltraWide.length > 0) return nonUltraWide[0].id;

  return list[0]?.id;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerElementId = 'html5-qrcode-reader-container';

  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [activeResolution, setActiveResolution] = useState<string | null>(null);

  // Zoom & Lanterna
  const [zoomSupported, setZoomSupported] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(0.5);
  const [maxZoom, setMaxZoom] = useState(3);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Foto & Entrada manual
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Controle de detecção e concorrência
  const hasScannedRef = useRef(false);
  const nativeScanActiveRef = useRef(false);
  const nativeTimerRef = useRef<number | null>(null);

  // Parada segura do scanner
  const handleStop = useCallback(async () => {
    nativeScanActiveRef.current = false;
    if (nativeTimerRef.current !== null) {
      window.clearTimeout(nativeTimerRef.current);
      nativeTimerRef.current = null;
    }
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Erro ao encerrar scanner:', e);
      }
    }
  }, []);

  // Fechamento imediato da interface e parada em background
  const handleClose = useCallback(() => {
    hasScannedRef.current = true;
    onClose();
    void handleStop();
  }, [onClose, handleStop]);

  // Varredura híbrida de ultra-alta sensibilidade e resolução direta no <video>
  // Resolve o problema de cupons fiscais pequenos/densos (NFC-e / SAT / SEFAZ):
  // 1. BarcodeDetector nativo de hardware (quando suportado)
  // 2. jsQR no Recorte Central 1:1 (Center Crop) em alta resolução (600x600 pixels nítidos sem distorção)
  // 3. jsQR no Frame Completo proporcional com suporte a inversão de cores/reflexo (attemptBoth)
  const startHighResLiveScanner = useCallback(
    (onSuccess: (code: string) => void) => {
      nativeScanActiveRef.current = true;

      // Canvas offscreen reutilizável para alta performance e zero memory-leaks
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      let nativeDetector: unknown = null;
      if ('BarcodeDetector' in window) {
        try {
          // @ts-expect-error BarcodeDetector is a modern web standard
          nativeDetector = new window.BarcodeDetector();
        } catch {
          nativeDetector = null;
        }
      }

      const scanLoop = async () => {
        if (!nativeScanActiveRef.current || hasScannedRef.current) return;

        const videoEl = document.querySelector<HTMLVideoElement>(
          `#${readerElementId} video`
        );

        if (
          videoEl &&
          !videoEl.paused &&
          !videoEl.ended &&
          videoEl.readyState >= 2 &&
          videoEl.videoWidth > 0 &&
          videoEl.videoHeight > 0
        ) {
          const vw = videoEl.videoWidth;
          const vh = videoEl.videoHeight;

          // 1. Tenta com BarcodeDetector nativo no elemento <video>
          if (nativeDetector) {
            try {
              // @ts-expect-error BarcodeDetector detect
              const barcodes = await nativeDetector.detect(videoEl);
              if (
                !hasScannedRef.current &&
                nativeScanActiveRef.current &&
                barcodes &&
                barcodes.length > 0 &&
                barcodes[0]?.rawValue
              ) {
                hasScannedRef.current = true;
                nativeScanActiveRef.current = false;
                onSuccess(barcodes[0].rawValue);
                return;
              }
            } catch {
              // segue para jsQR
            }
          }

          // 2. jsQR no Recorte Central de Alta Resolução (Center Crop 1:1)
          // Isso garante que mesmo um QR code pequeno no papel ocupe centenas de pixels nítidos
          // com proporção perfeitamente quadrada (1:1) sem a distorção do CSS.
          if (ctx) {
            try {
              const cropSize = Math.floor(Math.min(vw, vh) * 0.72);
              const targetSize = Math.min(cropSize, 640);
              const sx = Math.floor((vw - cropSize) / 2);
              const sy = Math.floor((vh - cropSize) / 2);

              canvas.width = targetSize;
              canvas.height = targetSize;
              ctx.drawImage(
                videoEl,
                sx,
                sy,
                cropSize,
                cropSize,
                0,
                0,
                targetSize,
                targetSize
              );

              const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
              const qr = jsQR(imgData.data, targetSize, targetSize, {
                inversionAttempts: 'attemptBoth',
              });

              if (
                qr &&
                qr.data &&
                !hasScannedRef.current &&
                nativeScanActiveRef.current
              ) {
                hasScannedRef.current = true;
                nativeScanActiveRef.current = false;
                onSuccess(qr.data);
                return;
              }
            } catch {
              // segue para o próximo passo
            }

            // 3. jsQR no Frame Proporcional Completo (caso o QR Code esteja mais perto da borda)
            try {
              const fullW = 480;
              const fullH = Math.floor((vh / vw) * fullW);
              canvas.width = fullW;
              canvas.height = fullH;
              ctx.drawImage(videoEl, 0, 0, vw, vh, 0, 0, fullW, fullH);

              const fullImgData = ctx.getImageData(0, 0, fullW, fullH);
              const fullQr = jsQR(fullImgData.data, fullW, fullH, {
                inversionAttempts: 'attemptBoth',
              });

              if (
                fullQr &&
                fullQr.data &&
                !hasScannedRef.current &&
                nativeScanActiveRef.current
              ) {
                hasScannedRef.current = true;
                nativeScanActiveRef.current = false;
                onSuccess(fullQr.data);
                return;
              }
            } catch {
              // segue para próximo ciclo
            }
          }
        }

        if (nativeScanActiveRef.current && !hasScannedRef.current) {
          nativeTimerRef.current = window.setTimeout(() => {
            void scanLoop();
          }, 85);
        }
      };

      void scanLoop();
    },
    [readerElementId]
  );

  // Enumeração segura de câmeras via API nativa do navegador (sem reabrir stream)
  const enumerateCameras = useCallback(async (): Promise<CameraDevice[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      return videoDevices.map((d, index) => ({
        id: d.deviceId,
        label: d.label || `Câmera ${index + 1}`,
      }));
    } catch (e) {
      console.warn('Erro ao enumerar dispositivos de vídeo:', e);
      return [];
    }
  }, []);

  // Inicia ou troca a câmera ativa com suporte a Alta Resolução (Full HD 1080p)
  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      try {
        setIsSwitchingCamera(true);
        setCameraError(null);
        hasScannedRef.current = false;

        // Se já está escaneando, para a câmera anterior e o scanner nativo
        nativeScanActiveRef.current = false;
        if (nativeTimerRef.current !== null) {
          window.clearTimeout(nativeTimerRef.current);
          nativeTimerRef.current = null;
        }

        if (scannerRef.current && scannerRef.current.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch {
            // Ignora erro de transição
          }
        }

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerElementId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
            ],
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
            },
            verbose: false,
          });
        }

        const scanner = scannerRef.current;

        const onScanHandler = (decodedText: string) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          nativeScanActiveRef.current = false;
          onScanSuccess(decodedText);
          handleClose();
        };

        // Escaneamento em Alta Resolução (Full HD 1080p / 4K):
        // Sem videoConstraints, browsers mobile abrem a câmera no padrão 640x480 (VGA),
        // o que destrói a nitidez de QR Codes fiscais densos.
        // Forçamos resolução Full HD ideal com fallback flexível para máxima nitidez e compatibilidade.
        let started = false;

        // 1. Tenta com preferredCameraId em Full HD (se informada)
        if (preferredCameraId) {
          try {
            const configWithPref: Html5QrcodeCameraScanConfig = {
              fps: 15,
              disableFlip: false,
              videoConstraints: {
                deviceId: { exact: preferredCameraId },
                width: { min: 640, ideal: 1920, max: 3840 },
                height: { min: 480, ideal: 1080, max: 2160 },
                advanced: [
                  { focusMode: 'continuous' } as unknown as MediaTrackConstraintSet,
                ],
              },
            };
            await scanner.start(
              preferredCameraId,
              configWithPref,
              onScanHandler,
              () => {}
            );
            started = true;
          } catch (prefErr) {
            console.warn(
              'Falha ao iniciar câmera preferida em alta resolução, tentando câmera traseira padrão...',
              prefErr
            );
            localStorage.removeItem(PREFERRED_CAMERA_KEY);
          }
        }

        // 2. Se não iniciou ainda, tenta câmera traseira (environment) em Full HD
        if (!started) {
          try {
            const configBackHD: Html5QrcodeCameraScanConfig = {
              fps: 15,
              disableFlip: false,
              videoConstraints: {
                facingMode: { ideal: 'environment' },
                width: { min: 640, ideal: 1920, max: 3840 },
                height: { min: 480, ideal: 1080, max: 2160 },
                advanced: [
                  { focusMode: 'continuous' } as unknown as MediaTrackConstraintSet,
                ],
              },
            };
            await scanner.start(
              { facingMode: 'environment' },
              configBackHD,
              onScanHandler,
              () => {}
            );
            started = true;
          } catch (hdErr) {
            console.warn(
              'Falha com constraints Full HD, tentando com resolução ideal flexível...',
              hdErr
            );
          }
        }

        // 3. Fallback resiliente para webcams ou aparelhos legados
        if (!started) {
          const configFallback: Html5QrcodeCameraScanConfig = {
            fps: 15,
            disableFlip: false,
            videoConstraints: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };
          await scanner.start(
            { facingMode: 'environment' },
            configFallback,
            onScanHandler,
            () => {}
          );
          started = true;
        }

        // Recupera e exibe a resolução real ativa da câmera
        try {
          const settings = scanner.getRunningTrackSettings();
          if (settings?.width && settings?.height) {
            setActiveResolution(`${settings.width}x${settings.height}`);
          }
        } catch {
          // Ignora se não puder ler settings do track
        }

        // Atualiza a lista de câmeras com segurança nativa
        const devs = await enumerateCameras();
        if (devs.length > 0) {
          setAvailableCameras(devs);

          // Tenta recuperar o ID exato da câmera ativa
          try {
            const settings = scanner.getRunningTrackSettings();
            if (settings?.deviceId) {
              setActiveCameraId(settings.deviceId);
              localStorage.setItem(PREFERRED_CAMERA_KEY, settings.deviceId);
            } else if (preferredCameraId) {
              setActiveCameraId(preferredCameraId);
              localStorage.setItem(PREFERRED_CAMERA_KEY, preferredCameraId);
            }
          } catch {
            if (preferredCameraId) {
              setActiveCameraId(preferredCameraId);
            }
          }
        }

        // Tenta aplicar foco contínuo no hardware
        try {
          await scanner.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          });
        } catch {
          // Foco contínuo pode não ser suportado pelo navegador
        }

        // Dispara varredura híbrida de alta resolução em tempo real (Center Crop 1:1 + Full Frame + jsQR + BarcodeDetector)
        startHighResLiveScanner(onScanHandler);

        // Detecta capacidades de Zoom e Lanterna da lente aberta
        try {
          const trackCaps =
            (
              scanner as unknown as {
                getRunningTrackCapabilities?: () => MediaTrackCapabilities;
              }
            ).getRunningTrackCapabilities?.() || {};

          if ('zoom' in trackCaps && (trackCaps as Record<string, unknown>).zoom) {
            const zCap = (
              trackCaps as unknown as { zoom: { min?: number; max?: number } }
            ).zoom;
            setZoomSupported(true);
            setMinZoom(Math.max(1, zCap?.min || 1));
            setMaxZoom(Math.min(5, zCap?.max || 3));
            setCurrentZoom(1);
          } else {
            const cameraCaps = scanner.getRunningTrackCameraCapabilities();
            const zoomFeature = cameraCaps?.zoomFeature?.();
            if (zoomFeature && zoomFeature.isSupported()) {
              setZoomSupported(true);
              setMinZoom(Math.max(1, zoomFeature.min()));
              setMaxZoom(Math.min(4, zoomFeature.max()));
              setCurrentZoom(zoomFeature.value() || 1);
            } else {
              setZoomSupported(false);
            }
          }

          const torchFeature = scanner
            .getRunningTrackCameraCapabilities()
            ?.torchFeature?.();
          if (torchFeature && torchFeature.isSupported()) {
            setTorchSupported(true);
            setIsTorchOn(torchFeature.value() || false);
          } else {
            setTorchSupported(false);
          }
        } catch {
          setZoomSupported(false);
          setTorchSupported(false);
        }
      } catch (err: unknown) {
        console.warn('Falha ao iniciar câmera:', err);
        const errorName = (err as Error)?.name;
        setCameraError(
          errorName === 'NotAllowedError'
            ? 'Permissão de acesso à câmera negada. Permita nas configurações do navegador.'
            : 'Dificuldade para acessar a câmera. Use o botão "Tirar Foto com Celular" ou digite a chave.'
        );
      } finally {
        setIsSwitchingCamera(false);
      }
    },
    [enumerateCameras, handleClose, onScanSuccess, startHighResLiveScanner]
  );

  // Inicialização e limpeza ao abrir/fechar o modal
  useEffect(() => {
    if (!isOpen) {
      void handleStop();
      return;
    }

    let isMounted = true;
    const savedCamId = localStorage.getItem(PREFERRED_CAMERA_KEY) || undefined;

    // Detecta câmeras e prioriza automaticamente a lente principal traseira (1x)
    void (async () => {
      const devs = await enumerateCameras();
      if (isMounted && devs.length > 0) {
        setAvailableCameras(devs);
      }
      const initialCameraId = savedCamId || findBestBackCamera(devs);
      if (isMounted) {
        void startCamera(initialCameraId);
      }
    })();

    return () => {
      isMounted = false;
      void handleStop();
      setCameraError(null);
      setManualInput('');
      setShowManualInput(false);
      setIsTorchOn(false);
      setCurrentZoom(1);
      setActiveResolution(null);
      hasScannedRef.current = false;
    };
  }, [isOpen, startCamera, handleStop, enumerateCameras]);

  // Atalho da tecla Escape para fechar
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
    localStorage.setItem(PREFERRED_CAMERA_KEY, newCameraId);
    await startCamera(newCameraId);
  };

  // Alterna ciclicamente entre as câmeras / lentes traseiras do celular
  const handleSwitchCameraCycle = async () => {
    if (availableCameras.length <= 1 || isSwitchingCamera) return;

    const backCameras = availableCameras.filter(
      (c) =>
        !c.label.toLowerCase().includes('front') &&
        !c.label.toLowerCase().includes('user') &&
        !c.label.toLowerCase().includes('selfie')
    );

    const list = backCameras.length > 1 ? backCameras : availableCameras;
    const currentIndex = list.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % list.length;
    const nextCamera = list[nextIndex];

    if (nextCamera) {
      await handleSelectCamera(nextCamera.id);
    }
  };

  // Re-detecta dispositivos manualmente caso o usuário queira
  const handleRefreshCameras = async () => {
    const devs = await enumerateCameras();
    if (devs.length > 0) {
      setAvailableCameras(devs);
    }
  };

  // Estado para efeito visual de foco no toque
  const [focusPulse, setFocusPulse] = useState<{ x: number; y: number } | null>(null);

  // Força re-foco do hardware e exibe feedback tátil/visual
  const handleRefocus = useCallback(async (e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      setFocusPulse({ x, y });
      setTimeout(() => setFocusPulse(null), 1000);
    }
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
      });
    } catch {
      // Ignora se hardware não expuser refocus manual
    }
  }, []);

  // Ajusta o nível de zoom (suporta WebRTC padrão e wrapper html5-qrcode)
  const handleApplyZoom = async (zoomValue: number) => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ zoom: zoomValue } as unknown as MediaTrackConstraintSet],
      });
      setCurrentZoom(zoomValue);
      return;
    } catch {
      // fallback
    }

    try {
      const caps = scannerRef.current.getRunningTrackCameraCapabilities();
      const zoom = caps?.zoomFeature?.();
      if (zoom && zoom.isSupported()) {
        await zoom.apply(zoomValue);
        setCurrentZoom(zoomValue);
      }
    } catch (e) {
      console.warn('Falha ao aplicar zoom:', e);
    }
  };

  // Liga/desliga lanterna
  const handleToggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const caps = scannerRef.current.getRunningTrackCameraCapabilities();
      const torch = caps?.torchFeature?.();
      if (torch && torch.isSupported()) {
        const nextState = !isTorchOn;
        await torch.apply(nextState);
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.warn('Falha ao acionar lanterna:', e);
    }
  };

  // Fallback: Tirar foto com o aplicativo oficial da câmera do celular (alta resolução + autofoco)
  const handleNativePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningPhoto(true);
    setCameraError(null);

    try {
      // 1. Decodificação de altíssima precisão com jsQR no bitmap da foto
      try {
        const bitmap = await createImageBitmap(file);
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
            onScanSuccess(qr.data);
            handleClose();
            return;
          }
        }
      } catch (photoErr) {
        console.warn('jsQR no bitmap da foto falhou:', photoErr);
      }

      // 2. BarcodeDetector nativo no bitmap
      if ('BarcodeDetector' in window) {
        try {
          const bitmap = await createImageBitmap(file);
          // @ts-expect-error BarcodeDetector is a web standard supported in Android Chrome
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(bitmap);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            onScanSuccess(barcodes[0].rawValue);
            handleClose();
            return;
          }
        } catch (detectorErr) {
          console.warn(
            'BarcodeDetector direto não encontrou, tentando Html5Qrcode...',
            detectorErr
          );
        }
      }

      // 3. Para a câmera antes de scanFile (requisito do Html5Qrcode)
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerElementId);
      }

      const decodedText = await scannerRef.current.scanFile(file, false);
      if (decodedText) {
        onScanSuccess(decodedText);
        handleClose();
      }
    } catch {
      setCameraError(
        'QR Code não identificado na foto. Certifique-se de aproximar bem a câmera do QR Code e garantir boa iluminação.'
      );
    } finally {
      setIsScanningPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScanSuccess(manualInput.trim());
    handleClose();
  };

  // REGRA CRÍTICA: Se isOpen for false, o componente não renderiza NADA no DOM
  if (!isOpen) {
    return null;
  }

  // Identifica a câmera atual formatada
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
        {/* BARRA DE SELEÇÃO DE CÂMERA (Visível sempre que a câmera estiver pronta ou detectando) */}
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
              <div id={readerElementId} className="w-full h-full" />

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
