import React, { useMemo } from 'react';
import { ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';
import { validateRecipient } from '@/domain/services/recipient-validator.service';
import { useChurchSettingsStore } from '@/stores/use-church-settings-store';

interface RecipientStatusBadgeProps {
  recipientCpfCnpj?: string;
  showDetails?: boolean;
  className?: string;
}

export const RecipientStatusBadge: React.FC<RecipientStatusBadgeProps> = ({
  recipientCpfCnpj,
  showDetails = true,
  className = '',
}) => {
  const settings = useChurchSettingsStore((state) => state.settings);

  const validation = useMemo(() => {
    return validateRecipient(
      recipientCpfCnpj,
      settings.authorizedRecipients,
      settings.mainCnpj
    );
  }, [recipientCpfCnpj, settings.authorizedRecipients, settings.mainCnpj]);

  if (validation.status === 'UNIDENTIFIED') {
    return (
      <div className={`space-y-1 ${className}`}>
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300"
          title={validation.message}
        >
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Consumidor Não Identificado</span>
        </div>
        {showDetails && (
          <p className="text-[11px] text-slate-400">
            Conforme para prestação de contas (Compra de balcão sem CPF).
          </p>
        )}
      </div>
    );
  }

  if (validation.status === 'AUTHORIZED') {
    return (
      <div className={`space-y-1 ${className}`}>
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400"
          title={validation.message}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Destinatário Autorizado</span>
        </div>
        {showDetails && (
          <p className="text-[11px] text-emerald-400/90 font-medium">
            {validation.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300"
        title={validation.message}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>Destinatário Não Cadastrado</span>
      </div>
      {showDetails && (
        <p className="text-[11px] text-amber-300/90">
          {validation.message} Cadastre o CPF nas configurações caso seja líder ou
          voluntário autorizado.
        </p>
      )}
    </div>
  );
};
