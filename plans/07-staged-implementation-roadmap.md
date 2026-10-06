# 07 - Roteiro de Implementação em Etapas (Milestones & Checkpoints)

Este documento divide o desenvolvimento do **Módulo 1 do Church Manager** em etapas sequenciais e autocontidas. 

Cada etapa possui:
- **Objetivo Claro**
- **Arquivos & Entregáveis Criados**
- **Critério de Aceite / Definição de Pronto (Definition of Done - DoD)**
- **Como Pausar e Retomar com Segurança**

Caso o desenvolvimento precise ser interrompido a qualquer momento, o projeto permanecerá estável, compilando e com funcionalidades verificáveis até o último checkpoint concluído.

---

## Tabela Resumo das Etapas

| Etapa | Foco Principal | Dependência | Status / Testabilidade |
| :---: | :--- | :--- | :--- |
| **1** | Fundação do Projeto, PWA & Design System | Nenhuma | App rodando (`npm run dev`), layout e Service Worker ativos |
| **2** | Domínio Fiscal & Parsers (com Testes Vitest) | Etapa 1 | Testes unitários passando (`npx vitest run`) |
| **3** | IndexedDB (Dexie.js) & Compressão de Imagens | Etapa 2 | Testes de banco e compressão com Blobs binários |
| **4** | Ports & Adapters para CNPJ (Fallback Resiliente) | Etapa 1 | Testes de chamada e chaveamento automático de provedor |
| **5** | Captura Física: Scanner (html5-qrcode) & Câmera | Etapa 3 | Teste interativo de hardware da câmera e scanner |
| **6** | Formulário de Registro (Override Manual & Retry) | Etapas 2, 3, 4, 5 | Cadastro completo de notas gravando no IndexedDB |
| **7** | Dashboard, Métricas & Auditoria Offline/PWA | Etapa 6 | Aplicação completa, auditada e pronta para produção |

---

## Detalhamento das Etapas

### 🏁 ETAPA 1: Fundação do Projeto, PWA & Design System
**Objetivo**: Inicializar o projeto com todas as dependências, path aliases (`@/*`), Tailwind CSS no modo dark/moderno, ícones e infraestrutura básica do PWA com Service Worker.

#### Arquivos a Criar/Modificar:
- `package.json`
- `vite.config.ts` (com plugin PWA e path alias)
- `tsconfig.json` e `tsconfig.app.json`
- `tailwind.config.js` e `postcss.config.js`
- `src/index.css` (variáveis HSL, tema escuro, animação de laser)
- `src/components/layout/header.tsx` (exibe logo, status Online/Offline, badge PWA)
- `src/stores/use-network-store.ts` (listener de eventos `window.onLine`)
- `src/App.tsx` e `src/main.tsx`

#### Critérios de Aceite (DoD):
1. `npm install` executa sem conflito de dependências.
2. `npm run dev` inicia o servidor sem erros no console.
3. `npm run build` conclui com sucesso gerando a pasta `dist/` com `sw.js` e manifest.
4. Desconectar o Wi-Fi reflete visualmente no indicador de status do Header (Online/Offline).

> [!TIP]
> **Ponto de Parada Seguro**: O projeto está totalmente configurado e compila perfeitamente.

---

### 🏁 ETAPA 2: Domínio Fiscal & Parsers Puros (Vitest)
**Objetivo**: Implementar as regras fiscais de negócio puras (livres de framework UI), como o cálculo do dígito verificador módulo 11, decomposição da chave de 44 dígitos e extração de chaves a partir de URLs de portais SEFAZ (QR Codes de NFC-e).

#### Arquivos a Criar:
- `src/domain/entities/invoice.ts` (tipos, status enums)
- `src/domain/parsers/ufs.ts` (tabela de estados IBGE)
- `src/domain/validators/key-checksum.ts` (validação Módulo 11)
- `src/domain/parsers/nfe-key-parser.ts` (decomposição estruturada dos 44 dígitos)
- `src/domain/parsers/nfce-url-parser.ts` (extração de URLs SEFAZ com parâmetro `p=...|...` e `chNFe`)
- `tests/unit/parsers.test.ts` (suíte completa de testes com Vitest)

#### Critérios de Aceite (DoD):
1. `npx vitest run tests/unit/parsers.test.ts` passa com 100% de sucesso.
2. Testes cobrem:
   - Chave válida de NF-e (modelo 55).
   - Chave válida de NFC-e (modelo 65).
   - Chave com DV incorreto (detectada como inválida).
   - URLs de QR Code padrão nacional v2 (com pipe `|`).
   - URLs legadas com `chNFe`.
   - Digitação manual de 44 dígitos.

> [!TIP]
> **Ponto de Parada Seguro**: Toda a lógica fiscal está matematicamente blindada e documentada com testes unitários.

---

### 🏁 ETAPA 3: Banco Local IndexedDB & Otimização de Imagens
**Objetivo**: Configurar o armazenamento offline local com Dexie.js e a pipeline de compressão client-side de fotos de comprovantes salvando estritamente como `Blob` binário.

#### Arquivos a Criar:
- `src/adapters/storage/db.ts` (classe `ChurchManagerDB` estendendo `Dexie`)
- `src/ports/invoice-repository.port.ts` (interface `IInvoiceRepository`)
- `src/adapters/storage/dexie-invoice.repository.ts` (operações CRUD no IndexedDB)
- `src/services/image-compression.service.ts` (compressão Web Worker para < 800 KB e helpers de ObjectURL)
- `tests/unit/storage.test.ts` (testes com `fake-indexeddb`)

#### Critérios de Aceite (DoD):
1. Teste automatizado confirma gravação e leitura de um registro com `imageBlob` no IndexedDB.
2. O campo `imageBlob` armazena uma instância nativa de `Blob` (nunca Base64).
3. O repositório lista notas ordenadas por data de criação e filtra por `syncStatus === 'PENDING_SYNC'`.

> [!TIP]
> **Ponto de Parada Seguro**: Camada de persistência local concluída e desacoplada por interface.

---

### 🏁 ETAPA 4: Camada de Resiliência de CNPJ (Ports & Adapters)
**Objetivo**: Implementar a integração com as APIs de consulta de CNPJ com tolerância a falhas, timeout seguro, fallback automático e cache em memória.

#### Arquivos a Criar:
- `src/ports/cnpj-provider.port.ts` (interface `ICnpjProvider` e DTO `CnpjDto`)
- `src/adapters/cnpj/brasil-api.adapter.ts` (provedor primário com timeout via AbortController)
- `src/adapters/cnpj/minha-receita.adapter.ts` (provedor de contingência)
- `src/adapters/cnpj/cnpj-service.ts` (orquestrador com fallback e cache)
- `src/ports/sefaz-scraper.port.ts` & `src/adapters/sefaz/sefaz-scraper.stub.ts` (preparação futura)
- `tests/unit/cnpj-service.test.ts` (testes de fallback com mocks de `fetch`)

#### Critérios de Aceite (DoD):
1. Se a BrasilAPI falhar ou estourar timeout, a Minha Receita é chamada automaticamente e retorna os dados.
2. Se ambos falharem ou o app estiver offline, o erro é capturado limpamente para exibição no formulário.
3. Consultas subsequentes para o mesmo CNPJ são servidas instantaneamente do cache em memória.

> [!TIP]
> **Ponto de Parada Seguro**: Serviços externos padronizados, desacoplados e resilientes a indisponibilidades.

---

### 🏁 ETAPA 5: Captura Física (Scanner com Câmera & Foto de Comprovante)
**Objetivo**: Integrar os recursos de hardware do dispositivo (câmera para leitura do QR Code/código de barras e upload/foto do cupom físico).

#### Arquivos a Criar:
- `src/components/scanner/qr-scanner-modal.tsx` (overlay com `html5-qrcode`, câmera traseira e animação de mira laser)
- `src/components/photo/photo-uploader.tsx` (input com `capture="environment"`, indicador de compressão e preview com revoke de memória)
- `src/components/ui/dialog.tsx` e botões auxiliares

#### Critérios de Aceite (DoD):
1. O modal do scanner abre a câmera traseira do celular ou webcam do computador sem travar a interface.
2. Ao detectar um código, o modal fecha automaticamente e dispara o callback de sucesso.
3. Ao fechar o modal manualmente, a câmera é desligada e os tracks de vídeo são liberados.
4. Ao capturar uma foto pesada, o uploader exibe o estado de compressão e renderiza a miniatura com suporte a exclusão/troca.

> [!TIP]
> **Ponto de Parada Seguro**: Componentes de entrada de dados físicos prontos e estáveis.

---

### 🏁 ETAPA 6: Formulário de Registro (Override Manual & Retry)
**Objetivo**: Construir a store do formulário no Zustand e a tela de cadastro, integrando o scanner, a foto, a resolução de CNPJ e os mecanismos de edição manual e retry.

#### Arquivos a Criar:
- `src/stores/use-invoice-form-store.ts` (fluxo de dados do formulário)
- `src/views/new-invoice-view.tsx` (tela completa de cadastro)
- `src/components/invoices/invoice-form.tsx` (campos de chave, CNPJ, Razão Social, valores e foto)
- `src/components/invoices/status-badge.tsx` (badges visuais de status)

#### Critérios de Aceite (DoD):
1. Escanear um QR Code preenche instantaneamente chave, data, modelo, série e número.
2. A Razão Social é preenchida automaticamente via API de CNPJ com indicação visual do provedor (`BrasilAPI` ou `MinhaReceita`).
3. Em caso de falha de rede/API, o formulário exibe o botão **"Tentar Novamente (Retry)"** e permite que o usuário digite a Razão Social manualmente.
4. Qualquer campo pode ser editado pelo usuário antes de salvar.
5. Clicar em "Salvar Nota Fiscal" persiste o registro com foto no Dexie.js e reseta o formulário.

> [!TIP]
> **Ponto de Parada Seguro**: O fluxo principal de registro está totalmente operacional do início ao fim.

---

### 🏁 ETAPA 7: Dashboard, Métricas & Auditoria Offline/PWA
**Objetivo**: Criar a tela principal de consulta e controle gerencial, consolidar métricas e validar a conformidade de execução offline.

#### Arquivos a Criar:
- `src/views/dashboard-view.tsx` (tela inicial com lista de notas cadastradas)
- `src/components/invoices/invoice-card.tsx` (card individual com foto, chave e status)
- `src/components/dashboard/metric-cards.tsx` (totalizadores: Qtd. Notas, Total em R$, Pendentes de Sincronização)
- `src/components/photo/photo-preview-dialog.tsx` (modal para ampliar a foto do comprovante)

#### Critérios de Aceite (DoD):
1. O Dashboard lista todas as notas armazenadas no IndexedDB ordenadas pela mais recente.
2. Filtros por texto (busca por Razão Social, CNPJ ou chave) e por status (`PENDING_SYNC`) funcionam em tempo real.
3. Teste em modo Offline no DevTools:
   - A página recarrega offline normalmente via Service Worker.
   - É possível cadastrar uma nota offline e vê-la no Dashboard com `syncStatus: 'PENDING_SYNC'`.
4. `npm run build` gera o pacote final sem erros ou alertas de tipagem TypeScript.

---

## Como Pausar e Retomar o Trabalho

Se o desenvolvimento precisar ser pausado ao término de qualquer etapa:
1. **Para Pausar**:
   - Execute `npm run build` para garantir que o TypeScript compila sem erros.
   - Execute os testes automatizados da etapa (`npx vitest run`).
   - O projeto estará em um estado commitável e funcional.
2. **Para Retomar**:
   - Consulte este documento (`plans/07-staged-implementation-roadmap.md`) para verificar a última etapa concluída.
   - Inicie a próxima etapa pelo seu objetivo e arquivos listados.
