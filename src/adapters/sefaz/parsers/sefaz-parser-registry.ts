import type { IStateSefazParser } from '@/ports/state-sefaz-parser.port';
import { sefazBaParser } from './sefaz-ba.parser';

/**
 * Registro e orquestrador de parsers estaduais da SEFAZ.
 * Implementa o padrão Registry / Strategy para resolução dinâmica por UF ou URL.
 */
export class SefazParserRegistry {
  private parsers: Map<string, IStateSefazParser> = new Map();

  constructor() {
    // Registra parsers nativos conhecidos
    this.register(sefazBaParser);
  }

  register(parser: IStateSefazParser): void {
    this.parsers.set(parser.uf.toUpperCase(), parser);
  }

  getParser(uf: string, url?: string): IStateSefazParser | undefined {
    const cleanUf = uf ? uf.toUpperCase().trim() : '';

    // 1. Busca por UF direta
    if (cleanUf && this.parsers.has(cleanUf)) {
      const parser = this.parsers.get(cleanUf);
      if (parser?.canHandle(cleanUf, url)) {
        return parser;
      }
    }

    // 2. Busca por URL nos parsers registrados
    if (url) {
      for (const parser of this.parsers.values()) {
        if (parser.canHandle(cleanUf, url)) {
          return parser;
        }
      }
    }

    return undefined;
  }

  listRegisteredUfs(): string[] {
    return Array.from(this.parsers.keys());
  }
}

export const sefazParserRegistry = new SefazParserRegistry();
