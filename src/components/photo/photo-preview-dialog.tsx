import React from 'react';
import { X, ZoomIn } from 'lucide-react';

interface PhotoPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export const PhotoPreviewDialog: React.FC<PhotoPreviewDialogProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Comprovante Fiscal',
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl flex items-center justify-between pb-3 text-white">
        <div className="flex items-center gap-2">
          <ZoomIn className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm sm:text-base">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition"
          aria-label="Fechar Visualização"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative max-w-2xl max-h-[80vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
        <img
          src={imageUrl}
          alt={title}
          className="max-h-[75vh] w-auto rounded-lg object-contain"
        />
      </div>
    </div>
  );
};
