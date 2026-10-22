import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface PairingQrCodeProps {
  payload: string;
  size?: number;
}

export const PairingQrCode: React.FC<PairingQrCodeProps> = ({
  payload,
  size = 220,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !payload) return;

    QRCode.toCanvas(
      canvasRef.current,
      payload,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#020617', // slate-950
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) {
          setError(err.message);
        } else {
          setError(null);
        }
      }
    );
  }, [payload, size]);

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 text-xs text-center">
        Erro ao gerar QR Code: {error}
      </div>
    );
  }

  return (
    <div className="bg-white p-3 rounded-2xl shadow-2xl shadow-primary/20 inline-flex flex-col items-center border border-slate-700/50">
      <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto block" />
    </div>
  );
};
