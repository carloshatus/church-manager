Act as a Senior Frontend Architect. Create a detailed technical plan and execution steps to build the first module of a PWA React SPA called "church-manager".

# Project Context
- **Type:** Offline-first Single Page Application (SPA).
- **Core Stack:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui.
- **PWA & Offline:** `vite-plugin-pwa` for Service Worker and manifest.
- **Local Database:** Dexie.js (IndexedDB).
- **State Management:** Zustand.
- **Scanner Library:** `html5-qrcode`.
- **Image Compression:** `browser-image-compression`.
- **Architecture Pattern:** Adapter Pattern (Ports and Adapters) for external communications to ensure maintainability and decoupling.

# Domain: Invoice Management (Notas e Cupons Fiscais - NFe/NFCe)
The module scans QR Codes (URLs) or Barcodes (44-digit Access Key) and allows users to capture photos of physical receipts.
Workflow requirements:
1. **URL & Key Handling:** Identify if the scanned input is a URL or a raw 44-digit key. If it's a URL (usually NFCe), extract the 44-digit key from it and retain the `qrCodeUrl` for future client-side web scraping (targeting SEFAZ).
2. **CNPJ Enrichment:** Automatically resolve the extracted CNPJ to fetch the Issuer Name (Razão Social).
3. **Photo Capture:** Allow the user to take a picture of the invoice. Compress it on the client side and store it locally.

# API & Adapter Pattern Requirements
1. **CNPJ Resolution:**
   - Primary API: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
   - Fallback API: `https://minhareceita.org/{cnpj}`
   - **Implementation:** Define an `ICnpjProvider` interface. Implement `BrasilApiAdapter` and `MinhaReceitaAdapter`. Create a `CnpjService` that uses the primary API and automatically falls back to the secondary on failure.
2. **SEFAZ Scraper (Preparation):**
   - Define an `ISefazScraper` interface to establish the contract for the future web scraping implementation.

# Data Schema (Dexie.js)
Define `ChurchManagerDB` schema:
- `invoices`: `++id, accessKey, qrCodeUrl, type, emissionDate, issuerCnpj, issuerName, model, series, number, totalAmount, imageBlob, sefazDataStatus, syncStatus, createdAt, updatedAt`
*(Notes: `sefazDataStatus` enum: 'PENDING', 'SUCCESS', 'FAILED', 'MANUAL'. `syncStatus` enum: 'PENDING_SYNC', 'SYNCED'. `imageBlob` must store binary data, not Base64).*

# Required Features & Components
1. **Scanner & Parser Logic:** Extract info from 44-digit keys and NFCe URLs. Trigger the CNPJ Adapter service.
2. **Photo Capture Logic:** 
   - Use `<input type="file" accept="image/*" capture="environment" />`.
   - Compress the image using `browser-image-compression`.
   - Display a thumbnail using `URL.createObjectURL()`.
3. **Invoice Registration UI:**
   - Display parsed data (Key, CNPJ, Issuer Name, Date) and the photo thumbnail.
   - **Manual Override & Retry:** Provide a "Retry" button for API failures. All fields must be manually editable to bypass automation.
4. **Dashboard:** List saved invoices indicating their sync statuses and showing basic info.

# Task Instruction (Plan Mode)
Generate a comprehensive, step-by-step project breakdown to implement this architecture. Provide:
1. Initial setup commands (Vite, Tailwind, shadcn, PWA, dependencies).
2. The Adapter pattern implementation for CNPJ services (interfaces, adapters, fallback logic).
3. The parsing utility logic for raw keys and NFCe URLs.
4. Dexie.js database schema configuration and image compression flow.
5. Component hierarchy, detailing the Registration form (scanner, photo input, retries, overrides).
