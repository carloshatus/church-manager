import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle, Keyboard } from 'lucide-react';

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
  const readerElementId = 'html5-qrcode-reader-container';

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCameraError(null);
      setManualInput('');
      setShowManualInput(false);
      return;
    }

    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        setCameraError(null);
        scannerInstance = new Html5Qrcode(readerElementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });

        scannerRef.current = scannerInstance;

        await scannerInstance.start(
          { facingMode: 'environment' }, // Prioriza câmera traseira em celulares
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
              handleStop();
              onClose();
            }
          },
          () => {
            // Callback vazio para frames em que nenhum código foi detectado
          }
        );
      } catch (err: any) {
        if (isMounted) {
          console.warn('Não foi possível iniciar a câmera:', err);
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Permissão de acesso à câmera negada. Permita o uso da câmera nas configurações do navegador.'
              : 'Nenhuma câmera compatível encontrada ou acesso não seguro (requer HTTPS).'
          );
          setShowManualInput(true);
        }
      }
    };

    // Pequeno delay para garantir que a div esteja renderizada no DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    const handleStop = async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          console.warn('Erro ao encerrar scanner:', e);
        }
      }
    };

    return () => {
      isMounted = false;
      clearTimeout(timer);
      handleStop();
    };
  }, [isOpen, onClose, onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScanSuccess(manualInput.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between max-w-md pt-2 px-2">
        <div className="flex items-center gap-2 text-white font-medium">
          <Camera className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm sm:text-base">Escanear QR Code ou Código</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition"
          aria-label="Fechar Scanner"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main View Area */}
      <div className="w-full max-w-sm flex flex-col items-center justify-center my-auto">
        {!cameraError ? (
          <div className="relative w-full aspect-square overflow-hidden rounded-2xl border-2 border-primary/50 shadow-2xl bg-black">
            <div id={readerElementId} className="w-full h-full" />
            {/* Linha animada do Laser */}
            <div className="scanner-laser-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444]" />
            {/* Cantoneiras Visuais */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-primary" />
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-red-500/30 bg-red-950/20 p-5 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-semibold text-sm mb-1">Câmera Indisponível</h4>
            <p className="text-slate-400 text-xs mb-4">{cameraError}</p>
          </div>
        )}

        {/* Formulário de Digitação Manual / Alternativa */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="w-full mt-4 space-y-2">
            <label className="text-xs text-slate-300 block text-left">
              Cole a URL do QR Code ou a Chave de 44 dígitos:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="https://... ou 3526..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
              >
                Inserir
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer / Opção de Chavear para Entrada Manual */}
      <div className="w-full max-w-sm flex flex-col items-center gap-3 pb-6">
        <p className="text-slate-400 text-xs text-center">
          Centralize o QR Code do cupom ou o código de barras da nota fiscal no quadrado acima.
        </p>

        {!showManualInput && !cameraError && (
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-primary transition underline underline-offset-4"
          >
            <Keyboard className="w-3.5 h-3.5" />
            Digitar ou colar chave manualmente
          </button>
        )}
      </div>
    </div>
  );
};
