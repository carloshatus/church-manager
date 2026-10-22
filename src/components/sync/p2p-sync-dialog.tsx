import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/adapters/storage/db';
import { useP2PSyncStore } from '@/stores/use-p2p-sync-store';
import { PairingQrCode } from './pairing-qr-code';
import { QrScannerModal } from '@/components/scanner/qr-scanner-modal';
import {
  X,
  Radio,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Wifi,
} from 'lucide-react';

export const P2PSyncDialog: React.FC = () => {
  const {
    isOpen,
    mode,
    status,
    peerId,
    qrPayload,
    progress,
    errorMessage,
    syncedCount,
    isScannerActive,
    closeSyncDialog,
    setMode,
    startHostSession,
    connectAndSendFromPayload,
    setIsScannerActive,
    reset,
  } = useP2PSyncStore();

  const [copied, setCopied] = React.useState(false);

  // Escuta tecla Escape para fechar modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSyncDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSyncDialog]);

  // Consulta notas locais para exibição estatística no modo de envio
  const allInvoicesCount = useLiveQuery(() => db.invoices.count(), [], 0);
  const pendingCount = useLiveQuery(
    () => db.invoices.where('syncStatus').equals('PENDING_SYNC').count(),
    [],
    0
  );

  const handleCopyPeerId = () => {
    if (!peerId) return;
    void navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isHost = mode === 'HOST_RECEIVE';
  const isTransferring = status === 'TRANSFERRING' || status === 'CONNECTING';

  return (
    <>
      {/* Backdrop e Container Central */}
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Top Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Sincronização P2P Local
                  <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold">
                    Zero Nuvem
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Transferência direta na rede Wi-Fi via WebRTC DataChannel
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeSyncDialog}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas Seletoras de Modo */}
          <div className="px-5 pt-4 pb-2 bg-slate-950/20">
            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('HOST_RECEIVE')}
                disabled={isTransferring}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  isHost
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                } ${isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Receber Notas (PC)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('CLIENT_SEND')}
                disabled={isTransferring}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  !isHost
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                } ${isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Enviar Notas (Celular)</span>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Corpo do Modal */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* MODO 1: RECEBER NOTAS (HOST / PC) */}
            {isHost && (
              <div className="flex flex-col items-center text-center space-y-4">
                {status === 'GENERATING_QR' && (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs text-slate-400">
                      Iniciando canal WebRTC e gerando QR Code de pareamento...
                    </p>
                  </div>
                )}

                {status === 'WAITING_PEER' && qrPayload && (
                  <>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">
                        Aponte a Câmera do Celular para Parear
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        No smartphone do voluntário, selecione a aba{' '}
                        <strong>&ldquo;Enviar Notas&rdquo;</strong> e escaneie o código
                        abaixo:
                      </p>
                    </div>

                    {/* QR Code Canvas */}
                    <div className="py-1 animate-in zoom-in-95 duration-200">
                      <PairingQrCode payload={qrPayload} size={220} />
                    </div>

                    {/* Sala & Radar */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
                      <div className="flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 border border-slate-800 text-slate-300">
                        <span className="text-slate-500 font-medium">Sala:</span>
                        <code className="font-mono font-bold text-primary">
                          {peerId}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyPeerId}
                          className="ml-1 p-0.5 text-slate-400 hover:text-white transition"
                          title="Copiar ID da sala"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/30 text-emerald-400 font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Aguardando celular no Wi-Fi...</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Status: TRANSFERRING (Host recebendo dados) */}
                {status === 'TRANSFERRING' && (
                  <div className="w-full py-8 space-y-4 flex flex-col items-center">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                      <Download className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-semibold text-white">
                        Recebendo Notas Fiscais e Comprovantes
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {progress.message || 'Transferindo dados e fotos em chunks...'}
                      </p>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="w-full max-w-xs space-y-1.5">
                      <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-300"
                          style={{
                            width: `${
                              progress.total > 0
                                ? Math.min(
                                    100,
                                    Math.round((progress.current / progress.total) * 100)
                                  )
                                : 45
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Fase: {progress.phase}</span>
                        {progress.total > 0 && (
                          <span>
                            {progress.current} / {progress.total}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status: COMPLETED (Host) */}
                {status === 'COMPLETED' && (
                  <div className="w-full py-6 flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-base font-bold text-white">
                        Sincronização Concluída!
                      </h4>
                      <p className="text-xs text-slate-300 max-w-sm">
                        {syncedCount > 0
                          ? `${syncedCount} nota${syncedCount > 1 ? 's' : ''} e comprovantes foram transferidos e salvos no banco de dados local.`
                          : 'Todas as notas fiscais já estavam perfeitamente sincronizadas.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={closeSyncDialog}
                        className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                      >
                        Fechar Janela
                      </button>
                      <button
                        type="button"
                        onClick={() => void startHostSession()}
                        className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                      >
                        Aguardar Próximo Celular
                      </button>
                    </div>
                  </div>
                )}

                {/* Status: FAILED (Host) */}
                {status === 'FAILED' && (
                  <div className="w-full py-6 flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertCircle className="w-10 h-10" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-semibold text-white">
                        Ocorreu uma Falha na Conexão P2P
                      </h4>
                      <p className="text-xs text-red-400 max-w-sm">
                        {errorMessage || 'Não foi possível estabelecer o canal WebRTC.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void startHostSession()}
                      className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MODO 2: ENVIAR NOTAS (CLIENT / CELULAR) */}
            {!isHost && (
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Indicador de Resumo Local */}
                <div className="w-full grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-left">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Total Cadastrado
                    </span>
                    <p className="text-lg font-bold text-white mt-0.5">
                      {allInvoicesCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-left">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Pendentes de Envio
                    </span>
                    <p className="text-lg font-bold text-amber-400 mt-0.5">
                      {pendingCount}
                    </p>
                  </div>
                </div>

                {(status === 'IDLE' || status === 'WAITING_PEER') && (
                  <div className="py-4 space-y-4 flex flex-col items-center">
                    <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
                      <Upload className="w-10 h-10" />
                    </div>

                    <div className="space-y-1 text-center">
                      <h4 className="text-base font-bold text-white">
                        Enviar Comprovantes à Tesouraria
                      </h4>
                      <p className="text-xs text-slate-400 max-w-xs">
                        Abra a tela &ldquo;Receber Notas&rdquo; no computador da igreja e
                        escaneie o QR Code exibido.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsScannerActive(true)}
                      className="w-full max-w-xs inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary to-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-primary/25 hover:opacity-95 transition active:scale-95"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Escanear QR Code no PC</span>
                    </button>
                  </div>
                )}

                {/* Status: CONNECTING / TRANSFERRING (Client enviando dados) */}
                {isTransferring && (
                  <div className="w-full py-8 space-y-4 flex flex-col items-center">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                      <Upload className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-semibold text-white">
                        Transmitindo Notas e Comprovantes
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {progress.message || 'Enviando dados via Wi-Fi local...'}
                      </p>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="w-full max-w-xs space-y-1.5">
                      <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-300"
                          style={{
                            width: `${
                              progress.total > 0
                                ? Math.min(
                                    100,
                                    Math.round((progress.current / progress.total) * 100)
                                  )
                                : 60
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Fase: {progress.phase}</span>
                        {progress.total > 0 && (
                          <span>
                            {progress.current} / {progress.total}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status: COMPLETED (Client) */}
                {status === 'COMPLETED' && (
                  <div className="w-full py-6 flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-base font-bold text-white">
                        Notas Enviadas com Sucesso!
                      </h4>
                      <p className="text-xs text-slate-300 max-w-sm">
                        {syncedCount > 0
                          ? `${syncedCount} nota${syncedCount > 1 ? 's' : ''} foram transmitidas e marcadas como sincronizadas no seu aparelho.`
                          : 'Todas as notas já estavam em dia com a tesouraria.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeSyncDialog}
                      className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                    >
                      Concluir
                    </button>
                  </div>
                )}

                {/* Status: FAILED (Client) */}
                {status === 'FAILED' && (
                  <div className="w-full py-6 flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertCircle className="w-10 h-10" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-semibold text-white">
                        Falha no Envio das Notas
                      </h4>
                      <p className="text-xs text-red-400 max-w-sm">
                        {errorMessage || 'Erro ao conectar ao receptor da tesouraria.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          reset();
                          setIsScannerActive(true);
                        }}
                        className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                      >
                        Escanear Novamente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé Informativo */}
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Criptografia P2P Ponta a Ponta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rede Wi-Fi Local</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Scanner de Câmera para Leitura do QR Code de Pareamento */}
      <QrScannerModal
        isOpen={isScannerActive}
        onClose={() => setIsScannerActive(false)}
        title="Pareamento P2P • Escanear QR Code"
        onScanSuccess={(decodedText) => {
          void connectAndSendFromPayload(decodedText);
        }}
      />
    </>
  );
};
