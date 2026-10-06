import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';
import { PhotoPreviewDialog } from './photo-preview-dialog';

export const PhotoUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { imagePreviewUrl, isCompressingPhoto, handlePhotoSelected, removePhoto } =
    useInvoiceFormStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoSelected(file);
    }
    // Reseta o valor do input para permitir selecionar o mesmo arquivo se desejar
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">
          Foto do Cupom / Comprovante Físico
        </label>
        {isCompressingPhoto && (
          <span className="text-xs text-primary flex items-center gap-1.5 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Otimizando imagem (&lt; 800 KB)...
          </span>
        )}
      </div>

      {/* Input nativo de captura de câmera traseira do smartphone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {imagePreviewUrl ? (
        <div className="relative group w-full h-48 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 flex items-center justify-center transition-all">
          <img
            src={imagePreviewUrl}
            alt="Comprovante da Nota"
            className="w-full h-full object-cover object-center"
          />

          {/* Overlay de Ações ao passar o mouse ou no celular */}
          <div className="absolute inset-0 bg-slate-950/70 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="p-2.5 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-medium"
              title="Visualizar em Tela Cheia"
            >
              <Eye className="w-4 h-4 text-primary" />
              Ampliar
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-medium"
              title="Trocar Foto"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              Trocar
            </button>
            <button
              type="button"
              onClick={removePhoto}
              className="p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 hover:bg-red-900 transition flex items-center gap-1.5 text-xs font-medium"
              title="Remover Foto"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressingPhoto}
          className="w-full h-36 border-2 border-dashed border-slate-800 hover:border-primary/60 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary transition bg-slate-900/30 group active:scale-[0.99]"
        >
          <div className="p-3 rounded-xl bg-slate-800/80 text-primary group-hover:bg-primary group-hover:text-white transition">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-slate-200">
            Fotografar Cupom Físico
          </span>
          <span className="text-xs text-slate-500">
            Comprime automaticamente com Web Worker para menos de 800 KB
          </span>
        </button>
      )}

      {/* Modal de visualização ampliada */}
      <PhotoPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={imagePreviewUrl}
      />
    </div>
  );
};
