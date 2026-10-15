# CLAUDE.md — Orientações do Projeto Church Manager

Este arquivo contém as diretrizes e instruções de contexto para o **Claude** (Claude Code CLI, Claude Desktop e Claude Projects) ao trabalhar neste repositório.

---

## 🏛️ Visão Geral do Projeto

O **Church Manager** é uma aplicação PWA Single Page Application (SPA) **100% Offline-First** desenvolvida para simplificar a gestão e prestação de contas de notas fiscais (**NF-e**, modelo 55) e cupons fiscais (**NFC-e**, modelo 65) em igrejas e congregações.

### Principais Capacidades:
- Leitura de QR Code de NFC-e e Código de Barras de NF-e via câmera traseira nativa (WebRTC + `jsQR` e `BarcodeDetector`).
- Decomposição de chave de 44 dígitos e validação via algoritmo **Módulo 11**.
- Consulta resiliente de CNPJ com fallback sequencial (**Minha Receita** e **BrasilAPI**) e suporte a preenchimento manual imediato caso offline.
- Captura e compressão client-side de fotos de comprovantes (< 800 KB) armazenadas nativamente como `Blob` binário.
- Persistência local no navegador via **IndexedDB** com **Dexie.js**.

---

## 🛠️ Comandos Mais Usados

```bash
# Ambiente de desenvolvimento
npm run dev              # Inicia o servidor Vite local (HMR ativo)

# Testes e Qualidade
npm run test             # Executa a suíte de testes unitários com Vitest
npm run lint             # Executa o linter ESLint
npm run lint:fix         # Aplica correções automáticas do ESLint
npm run format           # Formata código com Prettier
npm run format:check     # Verifica formatação sem alterar arquivos

# Build & Produção
npm run build            # Checagem de tipos (tsc -b) e build PWA (vite build)
npm run preview          # Visualiza o build de produção localmente
```

---

## 📐 Diretrizes de Arquitetura & Camadas

O repositório adota rigorosamente o padrão **Ports & Adapters (Arquitetura Hexagonal)**:

| Camada | Caminho | Responsabilidade | Restrições |
| :--- | :--- | :--- | :--- |
| **Domínio Puro** | `src/domain/` | Entidades, validadores (Módulo 11), parsers de chave e URL | **Sem dependências externas**, sem React, sem APIs de I/O de navegador. |
| **Portas** | `src/ports/` | Contratos tipados (`ICnpjProvider`, `IInvoiceRepository`, `ISefazScraper`) | Apenas interfaces TypeScript puras. |
| **Adaptadores** | `src/adapters/` | Implementações de repositório Dexie, clientes HTTP de CNPJ, scrapers | Lidam com particularidades de terceiros, timeouts e rede. |
| **Estado** | `src/stores/` | Gerenciamento de estado transiente e formulários (Zustand) | Desacoplado da camada de visualização. |
| **Apresentação** | `src/components/`, `src/views/` | Componentes React 19, modais Radix UI, visualização e leitura por câmera | Utilizam Tailwind CSS e hooks do Zustand/Dexie. |

---

## 📝 Padrões de Código & Estilo

### TypeScript & Naming:
- **Strict Mode**: `strict: true` ativado no `tsconfig`. Proibido o uso de `any` implícito.
- **Path Aliases**: Utilize sempre `@/...` (configurado para `src/*`), evitando caminhos relativos longos como `../../..`.
- **Enums e Estados**: Prefira *String Union Types* (ex: `type SyncStatus = 'PENDING_SYNC' | 'SYNCED'`).
- **Arquivos**: Nomes em kebab-case (ex: `nfe-key-parser.ts`, `use-invoice-form-store.ts`, `qr-scanner-modal.tsx`).

### React 19 & Componentes:
- Componentes funcionais e tipados.
- Separe lógica de cálculo em funções puras dentro de `src/domain/services/` em vez de misturar com componentes visuais.
- **Prevenção de vazamento de memória**:
  - Sempre interrompa instâncias do scanner (`scanner.stop()`) no cleanup do `useEffect`.
  - Sempre revogue URLs de Blob criadas (`URL.revokeObjectURL(url)`) ao desmontar componentes que exibem fotos.

### Armazenamento & Dados:
- **Imagens**: Armazenar estritamente como **`Blob`** no IndexedDB. **Nunca converta fotos para Base64** para salvar no banco de dados.
- **Offline-First**: Nenhuma funcionalidade essencial pode depender obrigatoriamente de rede para salvar dados. Operações de rede devem ser assíncronas com fallback transparente.

### Estilização & UI:
- **Tailwind CSS 3.4**: Utilize variáveis semânticas do tema escuro (`bg-background`, `border-border`, `text-foreground`, `text-primary`, `bg-card`).
- Use o utilitário `cn(...)` em `@/lib/utils` para composição condicional de classes.

---

## 🧪 Testes Automatizados

- Testes unitários localizados em `tests/unit/`.
- Testes com IndexedDB utilizam `fake-indexeddb`.
- Sempre execute `npm run test` e `npm run lint` antes de concluir edições de código para garantir que nenhuma regressão foi introduzida.

---

## 📦 Padrão de Commits

Siga o padrão **Conventional Commits**:
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Alterações em documentação
- `refactor:` Refatoração de código sem alteração de comportamento
- `test:` Inclusão ou ajuste de testes
- `chore:` Tarefas de manutenção ou dependências
