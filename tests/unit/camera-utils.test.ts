import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFrontCamera,
  isUltraWideCamera,
  formatCameraLabel,
  scoreCamera,
  findBestCamera,
  sortCamerasForDisplay,
  getSavedCameraPreference,
  saveCameraPreference,
  CAMERA_PREFERENCE_STORAGE_KEY,
  CAMERA_PREFERENCE_LABEL_KEY,
  type CameraDevice,
} from '@/lib/camera-utils';

describe('Camera Utils: Detecção, Seleção e Persistência de Câmeras', () => {
  const mockCameras: CameraDevice[] = [
    { id: 'cam-ultra', label: 'Back Camera 0 (0.5x Ultra Wide)' },
    { id: 'cam-main', label: 'Back Camera 1 (1x Main)' },
    { id: 'cam-front', label: 'Front Camera (Selfie)' },
  ];

  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      const store = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      };
    } else {
      localStorage.clear();
    }
  });

  describe('Identificação de Tipos de Lente', () => {
    it('deve identificar câmeras frontais', () => {
      expect(isFrontCamera('front camera')).toBe(true);
      expect(isFrontCamera('Selfie Cam 0')).toBe(true);
      expect(isFrontCamera('Facing User')).toBe(true);
      expect(isFrontCamera('Câmera Frontal')).toBe(true);
      expect(isFrontCamera('Back Camera 1x')).toBe(false);
    });

    it('deve identificar lentes 0.5x grande angular (ultra-wide)', () => {
      expect(isUltraWideCamera('camera2 0 (0.5x)')).toBe(true);
      expect(isUltraWideCamera('Back Ultra-Wide Angle Camera')).toBe(true);
      expect(isUltraWideCamera('Super Wide Camera')).toBe(true);
      expect(isUltraWideCamera('Back 0.6x')).toBe(true);
      expect(isUltraWideCamera('Back Camera 1x Main')).toBe(false);
    });

    it('deve formatar rótulos amigáveis para exibição', () => {
      expect(formatCameraLabel('Back Camera (0.5x)', 0)).toContain('0.5x (Grande Angular)');
      expect(formatCameraLabel('Primary 1x', 1)).toContain('1x (Principal)');
      expect(formatCameraLabel('Front camera', 2)).toContain('Frontal (Selfie)');
      expect(formatCameraLabel('Telephoto 2x', 3)).toContain('Tele/Zoom');
    });
  });

  describe('Pontuação e Priorização de Lentes (scoreCamera)', () => {
    it('deve priorizar lente 1x Principal sobre lente 0.5x Ultra-Wide', () => {
      const mainCam: CameraDevice = { id: '1', label: 'Back Camera 1x Main' };
      const ultraCam: CameraDevice = { id: '0', label: 'Back Camera 0.5x Ultra Wide' };
      const frontCam: CameraDevice = { id: '2', label: 'Front Camera' };

      const scoreMain = scoreCamera(mainCam);
      const scoreUltra = scoreCamera(ultraCam);
      const scoreFront = scoreCamera(frontCam);

      expect(scoreMain).toBeGreaterThan(scoreUltra);
      expect(scoreUltra).toBeGreaterThan(scoreFront);
    });
  });

  describe('Seleção da Melhor Câmera (findBestCamera)', () => {
    it('deve selecionar a câmera 1x Principal por padrão (NUNCA a 0.5x) se não houver preferência salva', () => {
      const best = findBestCamera(mockCameras);
      expect(best).toBeDefined();
      expect(best?.id).toBe('cam-main');
      expect(best?.label).toContain('1x Main');
    });

    it('deve retornar a câmera salva pelo ID quando o ID existir na lista', () => {
      saveCameraPreference('cam-ultra', 'Back Camera 0 (0.5x Ultra Wide)');
      const pref = getSavedCameraPreference();

      const best = findBestCamera(mockCameras, pref.id, pref.label);
      expect(best).toBeDefined();
      expect(best?.id).toBe('cam-ultra');
    });

    it('deve retornar a câmera pelo rótulo salvo se o deviceId tiver rotacionado no navegador', () => {
      // Simula deviceId alterado após reinicialização do navegador
      const rotatedCameras: CameraDevice[] = [
        { id: 'cam-new-ultra-id', label: 'Back Camera 0 (0.5x Ultra Wide)' },
        { id: 'cam-new-main-id', label: 'Back Camera 1 (1x Main)' },
      ];

      // Salva a preferência antiga da 1x
      const oldSavedId = 'old-cam-main-id';
      const savedLabel = 'Back Camera 1 (1x Main)';

      const best = findBestCamera(rotatedCameras, oldSavedId, savedLabel);
      expect(best).toBeDefined();
      expect(best?.id).toBe('cam-new-main-id');
    });

    it('deve retornar undefined se a lista de dispositivos for vazia', () => {
      expect(findBestCamera([])).toBeUndefined();
    });
  });

  describe('Persistência no LocalStorage (getSavedCameraPreference / saveCameraPreference)', () => {
    it('deve persistir e recuperar o ID e o Label da câmera selecionada', () => {
      expect(getSavedCameraPreference()).toEqual({ id: null, label: null });

      saveCameraPreference('cam-123', 'Câmera Traseira Principal');

      const saved = getSavedCameraPreference();
      expect(saved.id).toBe('cam-123');
      expect(saved.label).toBe('Câmera Traseira Principal');

      expect(localStorage.getItem(CAMERA_PREFERENCE_STORAGE_KEY)).toBe('cam-123');
      expect(localStorage.getItem(CAMERA_PREFERENCE_LABEL_KEY)).toBe('Câmera Traseira Principal');
    });
  });

  describe('Ordenação para exibição (sortCamerasForDisplay)', () => {
    it('deve ordenar a câmera 1x no topo e frontal no fim', () => {
      const sorted = sortCamerasForDisplay(mockCameras);
      expect(sorted[0].id).toBe('cam-main');
      expect(sorted[sorted.length - 1].id).toBe('cam-front');
    });
  });
});
