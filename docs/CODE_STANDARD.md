# 📐 Padrões de Código & Guia de Estilo (Code Standard)

Este documento define os padrões arquiteturais, convenções de código, regras de tipagem e formatação obrigatórias para o repositório **Church Manager**.

---

## 1. Princípios Arquiteturais Gerais

1. **Arquitetura Hexagonal (Ports & Adapters)**:
   - **Domínio Puro (`src/domain/`)**: Regras fiscais e validações (Módulo 11, decomposição da chave) devem ser livres de frameworks (sem React, sem chamadas de rede ou I/O).
   - **Portas (`src/ports/`)**: Toda comunicação externa (APIs de CNPJ, scraper da SEFAZ, armazenamento local) deve ser exposta através de interfaces tipadas.
   - **Adaptadores (`src/adapters/`)**: Implementam as portas e lidam com as especificidades de rede, timeouts e bibliotecas de terceiros.

2. **Diretriz Offline-First**:
   - Dados locais são a fonte primária da verdade (`Single Source of Truth`).
   - Imagens de comprovantes **devem** ser gravadas como `Blob` binário no IndexedDB (Dexie.js), **nunca** serializadas como strings Base64.
   - Todo fluxo de automação (leitura de QR Code, busca de CNPJ) deve oferecer **fallback e override manual** transparente para não bloquear o usuário offline.

---

## 2. Padrões de TypeScript

- **Modo Strict Ativo**: Não utilizar `any` implícito. Em testes ou mocks onde tipos genéricos forem complexos, priorizar `unknown` com asserção explícita ou interfaces específicas.
- **Path Aliases**: Sempre importar arquivos a partir de `@/...` (ex: `import { db } from '@/adapters/storage/db'`), evitando caminhos relativos profundos como `../../../`.
- **Tipos de Entidade**:
  - Separar DTOs de APIs externas dos modelos de persistência interna.
  - Enums devem ser definidos preferencialmente como *String Union Types* (ex: `type SyncStatus = 'PENDING_SYNC' | 'SYNCED'`).

---

## 3. Padrões do React & Componentes

- **Componentes Funcionais**: Todos os componentes devem ser funcionais e tipados com `React.FC<Props>` ou assinaturas diretas.
- **Exportação Limpa**:
  - Evitar exportar funções utilitárias ou cálculos no mesmo arquivo de componentes visuais para preservar o Fast Refresh do Vite.
  - Funções de cálculo (ex: métricas) devem residir em arquivos de domínio ou módulos dedicados.
- **Ciclo de Vida & Hooks**:
  - Limpar sempre recursos de hardware e memória em `useEffect` (ex: `scanner.stop()`, `URL.revokeObjectURL(url)`).
  - Evitar chamadas diretas síncronas a `setState` desnecessárias dentro de efeitos quando os valores puderem ser derivados durante a renderização.

---

## 4. Estilização & Design System

- **Tailwind CSS**:
  - Utilizar classes utilitárias do Tailwind organizadas logicamente.
  - Para concatenação condicional de classes, utilizar o utilitário `cn(...)` em `@/lib/utils`.
  - Cores e bordas devem utilizar as variáveis semânticas do tema escuro (`bg-background`, `border-border`, `text-foreground`, `text-primary`).

---

## 5. Scripts de Verificação & Formatação

O projeto disponibiliza os seguintes comandos no `package.json`:

| Comando | Descrição |
| :--- | :--- |
| `npm run lint` | Executa o linter (ESLint) verificando regras de qualidade e React Hooks |
| `npm run lint:fix` | Corrige problemas automáticos de linting |
| `npm run format` | Formata todo o código de acordo com as regras do Prettier |
| `npm run format:check` | Verifica se os arquivos estão formatados sem alterá-los |
| `npm run test` | Executa a suíte de testes com Vitest |
| `npm run build` | Compila o TypeScript e gera o bundle de produção PWA |

---

## 6. Padrão de Mensagens de Commit (Conventional Commits)

Os commits no repositório devem seguir a convenção:

- `feat:` Nova funcionalidade ou módulo (ex: `feat: integrar scanner com camera`)
- `fix:` Correção de bug (ex: `fix: liberar memoria de preview apos exclusao`)
- `docs:` Alterações em documentação (ex: `docs: adicionar code standard`)
- `refactor:` Refatoração de código que não altera comportamento
- `test:` Adição ou correção de testes automatizados
- `chore:` Tarefas de manutenção, dependências ou configuração de build
