# Planos de Arquitetura & Implementação: Church Manager

Este diretório contém o detalhamento técnico completo para a construção do primeiro módulo do **Church Manager** (Gestão de Notas e Cupons Fiscais - NF-e / NFC-e), uma PWA React SPA Offline-First.

## Índice dos Planos

1. [00 - Arquitetura Geral & Visão do Sistema](./00-overview-and-architecture.md)
   - Visão de produto, diagrama Hexagonal (Ports & Adapters), fluxo ponta a ponta e árvore de diretórios.
2. [01 - Setup Inicial & Ferramental (Tooling)](./01-setup-and-tooling.md)
   - Comandos de instalação, Vite + PWA, aliases TypeScript, Tailwind CSS e design system.
3. [02 - Camada de Dados & Armazenamento Local (Dexie.js & Blobs)](./02-database-and-storage.md)
   - Schema do IndexedDB, modelo de notas fiscais, repositório e compressão client-side de fotos como `Blob` binário.
4. [03 - Parsers de Domínio & Regras Fiscais (Chave 44 Dígitos & URLs NFC-e)](./03-domain-parsers-and-validation.md)
   - Decomposição dos 44 dígitos da chave, validação Módulo 11 e parser de URLs de QR Codes de portais SEFAZ estaduais.
5. [04 - Portas & Adaptadores (CNPJ Service, Fallback & SEFAZ Scraper)](./04-ports-and-adapters.md)
   - Padrão Ports & Adapters, BrasilAPI, Minha Receita, fallback resiliente, cache e contrato `ISefazScraper`.
6. [05 - Gerenciamento de Estado & Hierarquia de Componentes UI](./05-state-and-ui-components.md)
   - Stores Zustand, ciclo de vida do scanner com `html5-qrcode`, uploader de foto e formulário com suporte a override manual e retentativas.
7. [06 - Plano de Verificação, Testes & Garantia de Qualidade](./06-verification-and-testing-plan.md)
   - Testes unitários com Vitest, simulação offline, validação de câmera e roteiro de testes manuais.
8. [07 - Roteiro de Implementação em Etapas (Milestones & Checkpoints)](./07-staged-implementation-roadmap.md)
   - Divisão do desenvolvimento do Módulo 1 em 7 etapas incrementais com critérios de aceite (DoD) e guia de pausa/retomada segura.
9. [08 - Roteiro das Próximas Fases (Roadmap de Evolução)](./08-next-phases-roadmap.md)
   - Planejamento arquitetural das Fases 8 a 11: Motor de Sincronização Remota (Cloud Sync), Web Scraping SEFAZ & OCR, Centros de Custo (PDF/Excel) e Multi-Congregação/RBAC.

---
*Gerado a partir das especificações de `prompts/plan.md`.*

