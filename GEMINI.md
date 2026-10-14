# 🤖 Regras do Workspace para Gemini — Church Manager

Este arquivo define as instruções mandatórias e o contexto operacional para o **Google Gemini** e o assistente **Antigravity** neste repositório.

---

## 🏛️ Contexto e Arquitetura do Projeto

O **Church Manager** é uma aplicação PWA Offline-First para controle e digitalização de comprovantes fiscais (NF-e modelo 55 e NFC-e modelo 65) em igrejas.

O projeto utiliza **Arquitetura Hexagonal (Ports & Adapters)** com separação estrita de camadas:

- **`src/domain/`**: Regras de negócio e validações puras (Módulo 11, parsers de chaves e URLs).
  - **PROIBIDO**: Importar React, hooks, APIs do navegador (IndexedDB, fetch, localStorage) ou bibliotecas de terceiros neste diretório.
- **`src/ports/`**: Contratos/interfaces tipadas (`ICnpjProvider`, `IInvoiceRepository`, `ISefazScraper`).
- **`src/adapters/`**: Implementações concretas (Dexie/IndexedDB, BrasilAPI, Minha Receita).
- **`src/stores/`**: Gerenciamento de estado transiente e de formulários com Zustand (`useInvoiceFormStore`, `useNetworkStore`).
- **`src/components/` & `src/views/`**: Camada de apresentação em React 19 + Tailwind CSS + Radix UI.

---

## ⚡ Regras Operacionais Mandatórias para Gemini

### 1. Offline-First & Persistência Local
- **Fonte da Verdade**: IndexedDB via Dexie.js (`db.ts`). Todas as ações do usuário devem persistir localmente antes de qualquer tentativa de sincronização remota.
- **Armazenamento de Imagens**: Comprovantes fotográficos **DEVEM SEMPRE** ser persistidos como binário `Blob`. **NUNCA use strings Base64** no banco ou estado global persistente.
- **Degradação Graciosa**: A aplicação nunca pode quebrar por falta de internet. Se uma consulta externa (ex: CNPJ na Receita) falhar ou estiver sem rede, permita a inserção e edição manual imediatamente.

### 2. Ciclo de Vida e Prevenção de Vazamento de Memória
- **Câmera e Scanner**: Ao utilizar `html5-qrcode` ou streams de mídia da câmera, garanta que a instância seja interrompida e liberada na função de limpeza do `useEffect`:
  ```tsx
  useEffect(() => {
    // Inicialização
    return () => {
      // Parada obrigatória de scanner e liberação de tracks de vídeo
      scanner.stop().catch(console.error);
    };
  }, []);
  ```
- **Object URLs**: Ao criar URLs temporárias para visualização de `Blob` com `URL.createObjectURL(blob)`, garanta a chamada de `URL.revokeObjectURL(url)` assim que a imagem for desmontada ou substituída.

### 3. Padrões de Código e Tipagem
- **TypeScript**: Modo strict ativo. Não utilize `any`. Utilize unions literais para estados (ex: `InvoiceType`, `SefazDataStatus`, `SyncStatus`).
- **Path Aliases**: Utilize sempre o alias `@/...` para importações internas (ex: `@/domain/...`, `@/adapters/...`, `@/components/...`).
- **Estilização**:
  - Utilize classes utilitárias do Tailwind com as variáveis semânticas do tema escuro (`bg-background`, `border-border`, `text-foreground`, `text-primary`, `bg-card`).
  - Para concatenação de classes dinâmicas, utilize `cn(...)` de `@/lib/utils`.

### 4. Validação Contínua (Check de Qualidade)
Após realizar alterações no código, valide sempre a integridade da aplicação executando:
```bash
npm run test  # Executa todos os testes unitários (Vitest)
npm run lint  # Verifica regras do linter ESLint
```
Se encontrar falhas de lint ou testes quebrados após uma alteração, corrija-os antes de apresentar a solução final.

---

## 📚 Referências no Repositório
- [Padrões de Código Detalhados](file:///home/carloshatus/Hatus/church-manager/docs/CODE_STANDARD.md)
- [Planos e Roadmaps de Arquitetura](file:///home/carloshatus/Hatus/church-manager/plans/)
- [Modelos de Domínio](file:///home/carloshatus/Hatus/church-manager/src/domain/entities/invoice.ts)
