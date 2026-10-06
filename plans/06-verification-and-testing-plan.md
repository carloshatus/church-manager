# 06 - Plano de Verificação, Testes & Garantia de Qualidade

Este documento define os procedimentos de testes automatizados, verificação offline e validação de ponta a ponta do primeiro módulo do **church-manager**.

---

## 1. Testes Automatizados (Vitest + Testing Library)

### 1.1 Configuração do Ambiente de Testes
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom fake-indexeddb
```

### 1.2 Casos de Teste Unitário Essenciais

#### A. Parser de Chave NF-e (44 Dígitos) e Módulo 11
- **Chave Válida (Modelo 55 - NF-e)**:
  - Input: `35261012345678000199550010000000011000000014`
  - Validar: UF = `35` (SP), Data = `2026-10`, CNPJ = `12345678000199`, Modelo = `55`, Série = `1`, Número = `1`, DV = `4`, `isValidChecksum` = `true`.
- **Chave Válida (Modelo 65 - NFC-e)**:
  - Validar se `type` é identificado como `'NFCE'`.
- **Chave com Menos/Mais de 44 Dígitos**:
  - Deve lançar erro explicativo.
- **Dígito Verificador Inválido**:
  - `validateNFeKeyChecksum` deve retornar `false`.

#### B. Parser de URLs de QR Code da NFC-e
- **Padrão Nacional v2 com Pipe (`p=...|2|1|1|...`)**:
  - URL típica do RS, SP, PR.
  - Verificar se a chave de 44 dígitos é extraída com precisão e o `qrCodeUrl` original é preservado.
- **Padrão com `chNFe=...`**:
  - Extração correta do parâmetro de busca.
- **Entrada Bruta de Chave**:
  - Reconhecer que não é URL (`isUrl: false`) e manter a chave.

#### C. Fallback do `CnpjService` (Ports & Adapters)
- **Cenário 1 (Primário Sucesso)**: BrasilAPI responde 200 -> Retorna dados com `provider: 'BrasilAPI'`, MinhaReceita não é chamada.
- **Cenário 2 (Primário Falha, Fallback Sucesso)**: BrasilAPI retorna 500 ou Timeout -> MinhaReceita responde 200 -> Retorna dados com `provider: 'MinhaReceita'`.
- **Cenário 3 (Ambos Falham / Offline)**: Lança exceção amigável orientando o preenchimento manual sem travar a aplicação.
- **Cenário 4 (Cache)**: Segunda chamada para o mesmo CNPJ não realiza requisição de rede.

#### D. Repositório Dexie (IndexedDB)
- Inserir nota com `imageBlob`.
- Buscar nota por ID e por `accessKey`.
- Validar se o `imageBlob` armazenado é uma instância de `Blob` com tamanho > 0 bytes.
- Listar notas pendentes de sincronização (`syncStatus === 'PENDING_SYNC'`).

---

## 2. Roteiro de Verificação Manual

### 2.1 Teste do Scanner & Camera
1. Iniciar o app (`npm run dev`).
2. Abrir a tela de Nova Nota no celular ou no desktop.
3. Clicar em **"Escanear QR / Código de Barras"**.
4. Apontar para um QR Code de NFC-e impresso ou na tela.
5. **Critério de Sucesso**: O modal fecha automaticamente, os campos de chave, UF, data, modelo e número são preenchidos instantaneamente, e o badge do CNPJ exibe status de carregamento.

### 2.2 Teste do Fallback de CNPJ & Edição Manual
1. Inserir uma chave com CNPJ fictício ou desconectar o Wi-Fi.
2. Observar a tentativa da BrasilAPI e em seguida da Minha Receita.
3. Na falha, verificar se o banner exibe: *"Não foi possível consultar o CNPJ. Insira a Razão Social manualmente"* com o botão **"Tentar Novamente (Retry)"**.
4. Digitar manualmente a Razão Social *"Mercado das Frutas Ltda"*.
5. Clicar em **"Salvar Nota Fiscal"**.
6. **Critério de Sucesso**: O formulário salva com sucesso no IndexedDB mesmo sem internet e sem resposta da API.

### 2.3 Teste de Captura e Compressão de Foto
1. Clicar no botão **"Fotografar Cupom Físico"**.
2. Selecionar ou tirar uma foto pesada (5MB+).
3. Verificar a indicação *"Otimizando imagem..."*.
4. Verificar se a thumbnail aparece com opções de visualizar e trocar.
5. Inspecionar o DevTools (Application > IndexedDB > ChurchManagerDB > invoices):
   - O campo `imageBlob` deve conter um `Blob` (ex: `Blob { size: 654210, type: "image/jpeg" }`).

### 2.4 Teste de Navegação Offline (PWA)
1. Instalar o PWA ou rodar no navegador.
2. Na aba DevTools > Network, mudar para **Offline**.
3. Recarregar a página (F5).
4. O app deve carregar instantaneamente a partir do Service Worker.
5. O header deve exibir o badge amarelo/laranja: `OFFLINE`.
6. Cadastrar uma nova nota.
7. Verificar se a nota aparece no Dashboard com o status `PENDING_SYNC`.
8. Retornar a conexão para **Online**:
   - O badge do header atualiza para `ONLINE`.
