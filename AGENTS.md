# 🏛️ Diretrizes para Agentes de IA — Church Manager

Este documento define o contexto, as regras de arquitetura, padrões de código e convenções essenciais para agentes autônomos de IA (Cursor, Windsurf, Antigravity, GitHub Copilot, Codex e outros) atuando no repositório **Church Manager**.

---

## 🎯 1. Visão Geral e Propósito do Projeto

O **Church Manager** é uma aplicação web **PWA (Progressive Web App) Single Page Application (SPA)**, com arquitetura estritamente **Offline-First**, criada para resolver o fluxo de prestação de contas de tesoureiros, voluntários e administradores de igrejas e congregações.

### Principais Casos de Uso:
1. **Captura Rápida de Comprovantes**: Fotografia de recibos físicos e cupons de compras operacionais com compressão automática (< 800 KB).
2. **Scanner de Notas Fiscais**: Leitura em tempo real pela câmera traseira (`environment`) de QR Code de **NFC-e** (modelo 65) e código de barras / chave de 44 dígitos de **NF-e** (modelo 55) via `html5-qrcode`.
3. **Decomposição e Validação Fiscal**: Parser da chave de 44 dígitos (UF, AAMM, CNPJ, modelo, série, número) com validação matemática de dígito verificador via **Módulo 11**.
4. **Enriquecimento de CNPJ Resiliente**: Busca automática de Razão Social via provedores externos (BrasilAPI e Minha Receita com orquestração de contingência) e suporte a preenchimento/edição manual transparente.
5. **Persistência Local e Sincronização**: Armazenamento em banco local do navegador (**IndexedDB** via **Dexie.js**) com controle de status de sincronização (`PENDING_SYNC` vs `SYNCED`).

---

## 🏗️ 2. Arquitetura do Sistema (Ports & Adapters / Hexagonal)

A estrutura do projeto isola completamente as regras fiscais e de negócio de frameworks, bibliotecas de UI e APIs externas:

```
src/
├── domain/            # NÚCLEO PURO (Core Domain): Sem React, sem I/O, sem libs externas
│   ├── entities/      # Entidades do negócio (ex: invoice.ts, Invoice, InvoiceType, SyncStatus)
│   ├── parsers/       # Parsers de chave de acesso (44 dígitos), URLs SEFAZ e UFs
│   ├── services/      # Lógica de cálculo (ex: métricas financeiras do dashboard)
│   └── validators/    # Validação fiscal (ex: algoritmo Módulo 11 para chave e CNPJ)
├── ports/             # INTERFACES/CONTRATOS: Especificações abstratas
│   ├── cnpj-provider.port.ts      # ICnpjProvider
│   ├── invoice-repository.port.ts # IInvoiceRepository
│   └── sefaz-scraper.port.ts      # ISefazScraper
├── adapters/          # IMPLEMENTAÇÕES CONCRETAS (Adapters)
│   ├── cnpj/          # BrasilApiAdapter, MinhaReceitaAdapter, CnpjService (Orquestrador)
│   ├── storage/       # db.ts (Dexie), dexie-invoice.repository.ts
│   └── sefaz/         # Scrapers e stubs SEFAZ
├── stores/            # ESTADO GLOBAL & TRANSIENTE (Zustand)
│   ├── use-invoice-form-store.ts  # Estado do fluxo de cadastro e contingência
│   └── use-network-store.ts       # Detecção de online/offline do navegador
├── components/        # COMPONENTES VISUAIS (React + Tailwind + Radix UI)
│   ├── dashboard/     # Cards de métricas, lista de notas, badge de status
│   ├── invoices/      # Formulário de cadastro, campos de chave e dados fiscais
│   ├── layout/        # Header, navegação, indicador de rede
│   ├── photo/         # Input de câmera, preview e compressão de fotos
│   └── scanner/       # Modal de scanner QR/código de barras (html5-qrcode)
├── views/             # PÁGINAS PRINCIPAIS (DashboardView, NewInvoiceView)
└── lib/               # UTILITÁRIOS GERAIS (cn para Tailwind, formatters)
```

---

## ⚠️ 3. Invariantes & Regras Inegociáveis (Golden Rules)

Ao propor ou modificar código, os agentes **DEVEM** respeitar as seguintes diretrizes:

1. **Pureza do Domínio (`src/domain/`)**:
   - Nunca importe React, hooks (`useState`, `useEffect`), bibliotecas de rede (`fetch`, `axios`) ou banco (`dexie`) dentro de `src/domain/`.
   - O domínio deve ser 100% determinístico e testável sem mocks de ambiente.

2. **Offline-First Absoluto**:
   - O banco local IndexedDB (`db.ts`) é a **Única Fonte da Verdade** (`Single Source of Truth`).
   - A aplicação nunca pode travar ou bloquear a experiência se o dispositivo estiver offline.
   - Qualquer falha de requisição externa (ex: busca de CNPJ) deve oferecer fallback silencioso para entrada manual.

3. **Armazenamento de Imagens estritamente em `Blob`**:
   - Comprovantes de despesa são comprimidos com `browser-image-compression` e salvos no Dexie como **`Blob` binário nativo**.
   - **NUNCA** converta ou armazene imagens como strings Base64 no banco de dados (evita esgotamento de memória RAM e sobrecarga de serialização).

4. **Gerenciamento de Recursos & Prevenção de Leaks de Memória**:
   - Câmera e Scanner: Sempre desativar e parar tracks de vídeo e instâncias de `Html5Qrcode` no desmontar do componente (`return () => { scanner.stop(); }`).
   - Object URLs: Sempre liberar URLs de preview criadas com `URL.createObjectURL(blob)` chamando `URL.revokeObjectURL(url)` ao desmontar ou substituir imagens.

5. **Design System & Estilização (Tailwind CSS)**:
   - Utilizar variáveis semânticas do tema escuro (`bg-background`, `border-border`, `text-foreground`, `text-primary`, `bg-card`).
   - Interpolação de classes condicionais deve usar a função utilitária `cn(...)` de `@/lib/utils`.

---

## 💻 4. Stack Tecnológica e Comandos Principais

| Tecnologia | Versão | Função Principal |
| :--- | :--- | :--- |
| **React** | 19.x | Biblioteca de UI declarativa |
| **TypeScript** | 5.8+ / ~6.0 | Tipagem estática rigorosa |
| **Vite** | 8.x | Bundler & Dev Server rápido com suporte PWA |
| **Tailwind CSS** | 3.4.x | Estilização utilitária moderna |
| **Dexie.js** | 4.4.x | Abstração elegante sobre IndexedDB com `dexie-react-hooks` |
| **Zustand** | 5.0.x | Gerenciamento de estado leve e desacoplado |
| **Radix UI** | 1.x / 2.x | Primitivos acessíveis de UI (Dialog, Label, Slot) |
| **html5-qrcode** | 2.3.x | Decodificação de QR Code e Barcode via WebRTC |
| **Vitest** | 5.x | Suíte de testes unitários ultrarrápida |

### Comandos de Desenvolvimento:
```bash
# Iniciar servidor de desenvolvimento local
npm run dev

# Executar suíte de testes unitários
npm run test

# Executar linter ESLint
npm run lint

# Corrigir problemas automáticos de linting
npm run lint:fix

# Verificar formatação com Prettier
npm run format:check

# Aplicar formatação com Prettier
npm run format

# Compilar TypeScript e gerar bundle PWA de produção
npm run build
```

---

## 🧪 5. Convenções de Testes

- Todos os testes residem no diretório `tests/` (subdividido em `tests/unit/`).
- Para testes envolvendo IndexedDB / Dexie, utilizamos `fake-indexeddb` configurado em memória.
- Testes de domínio e validadores devem cobrir casos de borda:
  - Chaves de 44 dígitos válidas e inválidas (dígito verificador incorreto).
  - URLs de NFC-e de diferentes estados (formato nacional v2, parâmetros `chNFe` e `p=`).
  - Orquestração de contingência do `CnpjService` (sucesso primário, fallback, falha total com modo manual).
- **Antes de concluir qualquer tarefa de código, execute `npm run test` e `npm run lint`.**

---

## 📝 6. Padrão de Commits

Siga rigorosamente a convenção do **Conventional Commits**:
- `feat:` Nova funcionalidade ou módulo (ex: `feat: integrar scanner com camera`)
- `fix:` Correção de bug (ex: `fix: liberar memoria de preview apos exclusao`)
- `docs:` Alterações em documentação (ex: `docs: adicionar code standard`)
- `refactor:` Refatoração de código que não altera comportamento
- `test:` Adição ou correção de testes automatizados
- `chore:` Tarefas de manutenção, dependências ou configuração de build
