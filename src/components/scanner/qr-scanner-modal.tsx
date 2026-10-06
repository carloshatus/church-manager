import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
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
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
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

  // Zoom & Lanterna
  const [zoomSupported, setZoomSupported] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Foto & Entrada manual
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleStop = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Erro ao encerrar scanner:', e);
      }
    }
  }, []);

  // Inicia ou troca a câmera ativa
  const startCamera = useCallback(
    async (cameraIdOrConstraints?: string | MediaTrackConstraints) => {
      try {
        setIsSwitchingCamera(true);
        setCameraError(null);

        // Se já está escaneando, para a câmera anterior
        if (scannerRef.current && scannerRef.current.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch {
            // Ignora se já estiver parando
          }
        }

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerElementId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
            ],
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
            },
            verbose: false,
          });
        }

        const scanner = scannerRef.current;

        // Configuração com alta resolução e foco contínuo para evitar câmera desfocada
        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
          videoConstraints: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: { ideal: 'environment' },
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          },
        };

        const target = cameraIdOrConstraints || { facingMode: 'environment' };

        await scanner.start(
          target,
          config,
          (decodedText) => {
            onScanSuccess(decodedText);
            void handleStop();
            onClose();
          },
          () => {
            // Callback vazio para frames intermediários
          }
        );

        // Atualiza a lista de câmeras disponíveis para permitir troca de lentes
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            setAvailableCameras(cameras);
            if (typeof cameraIdOrConstraints === 'string') {
              setActiveCameraId(cameraIdOrConstraints);
            } else {
              // Tenta identificar se há câmera traseira padrão
              const backCameras = cameras.filter(
                (c) =>
                  !c.label.toLowerCase().includes('front') &&
                  !c.label.toLowerCase().includes('user') &&
                  !c.label.toLowerCase().includes('selfie')
              );
              if (backCameras.length > 0) {
                // Se a primeira câmera for ultra-wide (0.5x), prioriza a segunda se houver
                const isFirstUltraWide =
                  backCameras[0].label.toLowerCase().includes('ultra') ||
                  backCameras[0].label.toLowerCase().includes('0.5') ||
                  backCameras[0].label.toLowerCase().includes('wide-angle');

                if (isFirstUltraWide && backCameras.length > 1) {
                  setActiveCameraId(backCameras[1].id);
                } else {
                  setActiveCameraId(backCameras[0].id);
                }
              } else {
                setActiveCameraId(cameras[0].id);
              }
            }
          }
        } catch {
          // Ignora erro de enumeração
        }

        // Detecta capacidades de Zoom e Lanterna
        try {
          const cameraCaps = scanner.getRunningTrackCameraCapabilities();
          const zoomFeature = cameraCaps?.zoomFeature?.();
          if (zoomFeature && zoomFeature.isSupported()) {
            setZoomSupported(true);
            setMaxZoom(Math.min(zoomFeature.max(), 3));
            setCurrentZoom(zoomFeature.value() || 1);
          } else {
            setZoomSupported(false);
          }

          const torchFeature = cameraCaps?.torchFeature?.();
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
            : 'Não foi possível focar ou iniciar a câmera. Use o botão "Tirar Foto com Celular" ou digite a chave.'
        );
      } finally {
        setIsSwitchingCamera(false);
      }
    },
    [handleStop, onClose, onScanSuccess]
  );

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        void startCamera();
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      void handleStop();
      setCameraError(null);
      setManualInput('');
      setShowManualInput(false);
      setIsTorchOn(false);
      setCurrentZoom(1);
    };
  }, [isOpen, startCamera, handleStop]);

  // Alterna entre as câmeras / lentes traseiras do celular
  const handleSwitchCamera = async () => {
    if (availableCameras.length <= 1 || isSwitchingCamera) return;

    // Filtra traseiras se possível
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
      setActiveCameraId(nextCamera.id);
      await startCamera(nextCamera.id);
    }
  };

  // Ajusta o nível de zoom
  const handleApplyZoom = async (zoomValue: number) => {
    if (!scannerRef.current) return;
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

  // Fallback: Tirar foto com o aplicativo nativo da câmera do celular
  const handleNativePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningPhoto(true);
    setCameraError(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerElementId);
      }
      const decodedText = await scannerRef.current.scanFile(file, false);
      if (decodedText) {
        onScanSuccess(decodedText);
        void handleStop();
        onClose();
      }
    } catch {
      setCameraError(
        'QR Code não identificado na foto. Certifique-se de que o código esteja bem iluminado e nítido.'
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
    void handleStop();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Bar com Controles de Hardware */}
      <div className="w-full flex items-center justify-between max-w-md pt-1 px-1">
        <div className="flex items-center gap-2 text-white font-medium">
          <Camera className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm font-semibold">Leitor de QR Code Fiscal</span>
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

          {/* Botão de Trocar Câmera / Lente */}
          {availableCameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              disabled={isSwitchingCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 text-slate-200 hover:text-white text-xs font-medium border border-slate-700/60 transition disabled:opacity-50"
              title="Alternar entre lentes da câmera"
            >
              <SwitchCamera
                className={`w-4 h-4 text-primary ${isSwitchingCamera ? 'animate-spin' : ''}`}
              />
              <span className="hidden xs:inline">Trocar Lente</span>
            </button>
          )}

          {/* Botão Fechar */}
          <button
            type="button"
            onClick={() => {
              void handleStop();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition"
            aria-label="Fechar Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport do Scanner */}
      <div className="w-full max-w-sm flex flex-col items-center justify-center my-auto px-2">
        {!cameraError ? (
          <div className="relative w-full aspect-square overflow-hidden rounded-3xl border-2 border-primary/50 shadow-2xl bg-black">
            <div id={readerElementId} className="w-full h-full" />

            {/* Linha animada do Laser */}
            <div className="scanner-laser-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444]" />

            {/* Cantoneiras Visuais */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />

            {/* Feedback quando está trocando lente */}
            {isSwitchingCamera && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2 text-white text-xs font-medium backdrop-blur-sm">
                <RotateCw className="w-5 h-5 text-primary animate-spin" />
                <span>Alternando câmera...</span>
              </div>
            )}
          </div>
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

        {/* Controles de Zoom Rápido (1x / 1.5x / 2x) */}
        {zoomSupported && !cameraError && (
          <div className="flex items-center gap-2 mt-3 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px] mr-1">Zoom:</span>
            {[1, 1.5, 2].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => handleApplyZoom(lvl)}
                disabled={lvl > maxZoom}
                className={`px-2.5 py-0.5 rounded-full font-medium transition ${
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

      {/* Footer com Ações Alternativas: Foto com Foco ou Chave Manual */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2.5 pb-4">
        {/* Botão de Foto Nativa (Laser Autofocus) */}
        {!cameraError && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningPhoto}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-white transition shadow-sm"
          >
            {isScanningPhoto ? (
              <>
                <RotateCw className="w-4 h-4 text-primary animate-spin" />
                <span>Processando foto do cupom...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Tirar Foto com Câmera do Celular (Foco Perfeito)</span>
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
              Digitar chave manualmente
            </button>
          )}

          {availableCameras.length > 1 && !cameraError && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="inline-flex items-center gap-1.5 hover:text-primary transition underline underline-offset-4"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              Trocar lente (0.5x / 1x)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
