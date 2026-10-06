# 01 - Setup Inicial & Ferramental (Tooling)

Este documento detalha o passo a passo exato para inicializar o repositório, instalar dependências e configurar o ambiente de desenvolvimento com Vite, Tailwind CSS, shadcn/ui e `vite-plugin-pwa`.

---

## 1. Comandos de Inicialização do Projeto

### 1.1 Criação da Estrutura Base
Como o diretório já existe, inicializamos o Vite com React e TypeScript no diretório raiz:

```bash
# 1. Inicializar Vite com React + TypeScript (modo não-interativo)
npm create vite@latest . -- --template react-ts

# 2. Instalar dependências base
npm install
```

### 1.2 Instalação das Dependências Principais
Instalamos as bibliotecas específicas exigidas pelo projeto:

```bash
# Dependências do Sistema de Domínio, Banco e Hardware
npm install dexie dexie-react-hooks zustand html5-qrcode browser-image-compression lucide-react

# Utilitários de Estilização e Componentes Primitivos (shadcn/ui)
npm install clsx tailwind-merge class-variance-authority @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-toast
```

### 1.3 Instalação de Dependências de Desenvolvimento & PWA
```bash
# Tailwind CSS e processadores
npm install -D tailwindcss postcss autoprefixer

# Plugin PWA para Vite
npm install -D vite-plugin-pwa

# Tipos e utilitários de path resolution
npm install -D @types/node
```

---

## 2. Configuração de Path Aliases (`@/*`)

### `tsconfig.json` / `tsconfig.app.json`
Certifique-se de mapear o `@/*` para `./src/*`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

---

## 3. Configuração do `vite.config.ts` (com PWA)

O arquivo `vite.config.ts` configura o alias `@` e as definições de PWA (manifest, service worker para cache offline):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Church Manager - Gestão de Notas e Cupons',
        short_name: 'ChurchNotas',
        description: 'Módulo Offline-First de Registro de Notas e Cupons Fiscais para Igrejas',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache para requisições externas de CNPJ quando disponíveis
            urlPattern: /^https:\/\/(brasilapi\.com\.br|minhareceita\.org)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cnpj-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 dias
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

---

## 4. Configuração do Tailwind CSS & Design System

### 4.1 Inicializar Tailwind:
```bash
npx tailwindcss init -p
```

### 4.2 `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

### 4.3 `src/index.css` (Design System & Dark Mode Moderno)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;

    --card: 217 33% 17%;
    --card-foreground: 210 40% 98%;

    --primary: 217 91% 60%;
    --primary-foreground: 222 47% 11%;

    --secondary: 217 19% 27%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217 19% 27%;
    --muted-foreground: 215 20% 65%;

    --accent: 217 91% 60%;
    --accent-foreground: 222 47% 11%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 210 40% 98%;

    --border: 217 19% 27%;
    --input: 217 19% 27%;
    --ring: 217 91% 60%;

    --radius: 0.75rem;
  }
}

body {
  @apply bg-background text-foreground antialiased min-h-screen selection:bg-primary/20 selection:text-primary;
  font-feature-settings: "rlig" 1, "calt" 1;
}

/* Custom styles for camera overlay & animations */
.scanner-laser-line {
  animation: scan-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes scan-pulse {
  0%, 100% {
    top: 5%;
    opacity: 0.8;
  }
  50% {
    top: 90%;
    opacity: 1;
  }
}
```

---

## 5. Scripts de Execução no `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```
