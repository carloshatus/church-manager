import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  Users,
  Globe,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useChurchSettingsStore } from '@/stores/use-church-settings-store';
import type { RecipientRole } from '@/domain/entities/church-settings';
import { formatRecipientRole } from '@/domain/services/recipient-validator.service';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES: { value: RecipientRole; label: string }[] = [
  { value: 'CHURCH_HEADQUARTERS', label: 'Igreja Matriz' },
  { value: 'CHURCH_BRANCH', label: 'Congregação / Filial' },
  { value: 'PASTOR', label: 'Pastor(a)' },
  { value: 'TREASURER', label: 'Tesoureiro(a)' },
  { value: 'BUYER', label: 'Comprador(a) / Líder' },
  { value: 'OTHER', label: 'Outro Autorizado' },
];

interface SettingsDialogContentProps {
  settings: import('@/domain/entities/church-settings').ChurchSettings;
  onClose: () => void;
}

const SettingsDialogContent: React.FC<SettingsDialogContentProps> = ({
  settings,
  onClose,
}) => {
  const { updateSettings, addAuthorizedRecipient, removeAuthorizedRecipient, isLoading } =
    useChurchSettingsStore();

  const [activeTab, setActiveTab] = useState<'general' | 'recipients' | 'scraping'>(
    'general'
  );

  // Form states inicializados diretamente das props
  const [churchName, setChurchName] = useState(settings.churchName || '');
  const [mainCnpj, setMainCnpj] = useState(settings.mainCnpj || '');
  const [corsProxyUrl, setCorsProxyUrl] = useState(settings.corsProxyUrl || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New recipient form state
  const [newRecName, setNewRecName] = useState('');
  const [newRecDoc, setNewRecDoc] = useState('');
  const [newRecRole, setNewRecRole] = useState<RecipientRole>('PASTOR');
  const [recError, setRecError] = useState<string | null>(null);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    await updateSettings({
      churchName: churchName.trim(),
      mainCnpj: mainCnpj.replace(/\D/g, ''),
      corsProxyUrl: corsProxyUrl.trim(),
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);

    const cleanDoc = newRecDoc.replace(/\D/g, '');
    if (!newRecName.trim()) {
      setRecError('Informe o nome do destinatário autorizado.');
      return;
    }

    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setRecError('O CPF deve ter 11 dígitos ou o CNPJ deve ter 14 dígitos.');
      return;
    }

    await addAuthorizedRecipient({
      name: newRecName.trim(),
      cpfCnpj: cleanDoc,
      role: newRecRole,
    });

    setNewRecName('');
    setNewRecDoc('');
    setNewRecRole('PASTOR');
  };

  const handleResetProxy = () => {
    setCorsProxyUrl('https://api.allorigins.win/raw?url=');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header do Diálogo */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Configurações Fiscais da Igreja
              </h2>
              <p className="text-xs text-slate-400">
                Auditoria de conformidade, dados da matriz e contingência SEFAZ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Navegação Interna */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-6 pt-2 bg-slate-900/30">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Dados da Igreja</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recipients')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'recipients'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              Destinatários Autorizados ({settings.authorizedRecipients.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scraping')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'scraping'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Proxy & Scraping SEFAZ</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Desativado
            </span>
          </button>
        </div>

        {/* Feedback de Salvamento */}
        {saveSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Configurações salvas com sucesso no banco de dados local!</span>
          </div>
        )}

        {/* Conteúdo das Abas com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ABA 1: DADOS GERAIS */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Nome Oficial da Igreja / Congregação
                </label>
                <input
                  type="text"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="Ex: Primeira Igreja Batista"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  CNPJ Principal da Igreja Matriz
                </label>
                <input
                  type="text"
                  value={mainCnpj}
                  onChange={(e) => setMainCnpj(e.target.value)}
                  placeholder="00000000000000 (Apenas números)"
                  maxLength={18}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Notas fiscais emitidas neste CNPJ serão automaticamente aprovadas como
                  Destinatário Autorizado.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-primary/90 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Dados
                </button>
              </div>
            </form>
          )}

          {/* ABA 2: DESTINATÁRIOS AUTORIZADOS */}
          {activeTab === 'recipients' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Adicionar Novo Destinatário Autorizado
                </h3>

                {recError && (
                  <p className="text-xs text-red-400 font-medium">{recError}</p>
                )}

                <form
                  onSubmit={handleAddRecipient}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Nome / Descrição
                    </label>
                    <input
                      type="text"
                      value={newRecName}
                      onChange={(e) => setNewRecName(e.target.value)}
                      placeholder="Ex: Pr. Carlos Santos"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      CPF ou CNPJ
                    </label>
                    <input
                      type="text"
                      value={newRecDoc}
                      onChange={(e) => setNewRecDoc(e.target.value)}
                      placeholder="CPF ou CNPJ"
                      maxLength={18}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Função / Papel
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newRecRole}
                        onChange={(e) => setNewRecRole(e.target.value as RecipientRole)}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="p-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition shadow-sm"
                        title="Adicionar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Lista dos Autorizados */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 block">
                  Líderes, Filiais e Voluntários Cadastrados
                </span>

                {settings.authorizedRecipients.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 text-center text-xs text-slate-500">
                    Nenhum destinatário cadastrado ainda. Compras com CPF de líderes
                    emitirão alerta até que sejam cadastrados.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
                    {settings.authorizedRecipients.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between p-3 text-xs hover:bg-slate-900/40 transition"
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{rec.name}</span>
                            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary font-medium">
                              {formatRecipientRole(rec.role)}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400">
                            {rec.cpfCnpj.length === 11 ? 'CPF' : 'CNPJ'}: {rec.cpfCnpj}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAuthorizedRecipient(rec.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                          title="Remover destinatário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: PROXY & SCRAPING SEFAZ */}
          {activeTab === 'scraping' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
                <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Busca na SEFAZ Temporariamente Desativada
                </p>
                <p>
                  A consulta automática e scraping via proxies CORS foram desativados temporariamente devido à instabilidade dos proxies frente às restrições dos portais da SEFAZ.
                </p>
                <p className="text-slate-400">
                  No futuro, novas alternativas de integração serão disponibilizadas. Para importar produtos e totais sem digitação, utilize a opção <strong>&quot;Colar HTML&quot;</strong> no formulário de notas.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2 opacity-60">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-primary" />
                  Como funcionava o Scraping SEFAZ no PWA?
                </p>
                <p>
                  Servidores estaduais da SEFAZ bloqueiam requisições diretas de
                  navegadores por restrições de CORS. O Church Manager utilizava um proxy
                  para obter o HTML do DANFE diretamente no seu aparelho.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    URL do Proxy CORS
                  </label>
                  <button
                    type="button"
                    onClick={handleResetProxy}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar Padrão
                  </button>
                </div>
                <input
                  type="text"
                  value={corsProxyUrl}
                  onChange={(e) => setCorsProxyUrl(e.target.value)}
                  placeholder="https://api.allorigins.win/raw?url="
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Você pode utilizar seu próprio Cloudflare Worker ou manter o padrão
                  público AllOrigins.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-primary/90 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Proxy
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="border-t border-slate-800/80 px-6 py-3.5 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>Armazenamento local criptografado via IndexedDB</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const settings = useChurchSettingsStore((state) => state.settings);
  const loadSettings = useChurchSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    if (isOpen) {
      void loadSettings();
    }
  }, [isOpen, loadSettings]);

  if (!isOpen) return null;

  return (
    <SettingsDialogContent
      key={`${settings.updatedAt}-${isOpen}`}
      settings={settings}
      onClose={onClose}
    />
  );
};
