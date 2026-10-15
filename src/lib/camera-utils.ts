export interface CameraDevice {
  id: string;
  label: string;
}

export const CAMERA_PREFERENCE_STORAGE_KEY = 'church_manager_preferred_camera_id';
export const CAMERA_PREFERENCE_LABEL_KEY = 'church_manager_preferred_camera_label';

/**
 * Identifica se a câmera é frontal/selfie
 */
export function isFrontCamera(label: string): boolean {
  const clean = (label || '').toLowerCase();
  return (
    clean.includes('front') ||
    clean.includes('user') ||
    clean.includes('selfie') ||
    clean.includes('frontal') ||
    clean.includes('face')
  );
}

/**
 * Identifica se a lente é 0.5x / Grande Angular (Ultra-Wide), que tem foco inadequado para QR Code
 */
export function isUltraWideCamera(label: string): boolean {
  const clean = (label || '').toLowerCase();
  return (
    clean.includes('0.5') ||
    clean.includes('0.6') ||
    clean.includes('ultra') ||
    clean.includes('wide-angle') ||
    clean.includes('wide angle') ||
    clean.includes('super wide')
  );
}

/**
 * Formata o rótulo da câmera para exibição amigável no seletor de lentes
 */
export function formatCameraLabel(label: string, index: number): string {
  const clean = (label || '').trim();
  const lower = clean.toLowerCase();

  if (isFrontCamera(lower)) {
    return `Frontal (Selfie) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  if (isUltraWideCamera(lower)) {
    return `Traseira 0.5x (Grande Angular) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isTele =
    lower.includes('tele') ||
    lower.includes('zoom') ||
    lower.includes('2x') ||
    lower.includes('3x');

  if (isTele) {
    return `Traseira Tele/Zoom ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isMain =
    lower.includes('main') ||
    lower.includes('primary') ||
    lower.includes('principal') ||
    lower.includes('1x');

  if (isMain) {
    return `Traseira 1x (Principal) ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  const isGenericBack =
    lower.includes('back') ||
    lower.includes('rear') ||
    lower.includes('environment') ||
    lower.includes('traseira');

  if (isGenericBack) {
    return `Traseira ${clean ? `• ${clean}` : `#${index + 1}`}`;
  }

  return `Câmera #${index + 1} ${clean ? `• ${clean}` : ''}`;
}

/**
 * Atribui uma pontuação de adequação para leitura de QR Code.
 * Favorece fortemente câmeras traseiras 1x / principais e penaliza 0.5x ultra-wide e frontais.
 */
export function scoreCamera(device: CameraDevice): number {
  const label = (device.label || '').toLowerCase();
  let score = 100;

  // Frontal: penalização máxima
  if (isFrontCamera(label)) {
    return -1000;
  }

  // 0.5x / Ultra-wide: PENALIZAÇÃO SEVERA para evitar que seja selecionada automaticamente
  if (isUltraWideCamera(label)) {
    score -= 600;
  }

  // Macro / Profundidade: penalização
  if (label.includes('macro') || label.includes('depth')) {
    score -= 400;
  }

  // Tele / Zoom: penalização leve
  if (label.includes('tele') || label.includes('2x') || label.includes('3x')) {
    score -= 100;
  }

  // Câmera Principal / 1x / Standard: BÔNUS ALTO
  if (
    label.includes('main') ||
    label.includes('principal') ||
    label.includes('primary') ||
    label.includes('1x') ||
    label.includes('standard')
  ) {
    score += 500;
  }

  // Câmera traseira genérica
  if (
    label.includes('back') ||
    label.includes('traseira') ||
    label.includes('rear') ||
    label.includes('environment')
  ) {
    score += 200;
  }

  // No Android, a câmera 0 costuma ser a principal: "camera2 0" ou "camera 0"
  if (
    label.includes('camera2 0') ||
    label.includes('camera 0') ||
    label.includes('back 0')
  ) {
    score += 300;
  }

  return score;
}

/**
 * Encontra a melhor câmera disponível:
 * 1º Verifica se o deviceId salvo ainda existe na lista de dispositivos.
 * 2º Se não achar por deviceId (rotacionado pelo browser), busca pela label salva.
 * 3º Se não houver preferência salva, seleciona a melhor câmera traseira (1x / Principal),
 *    descartando deliberadamente 0.5x ultra-wide e frontais.
 */
export function findBestCamera(
  devices: CameraDevice[],
  savedId?: string | null,
  savedLabel?: string | null
): CameraDevice | undefined {
  if (!devices || devices.length === 0) return undefined;

  // 1. Tenta encontrar a câmera salva por deviceId exato
  if (savedId) {
    const exact = devices.find((d) => d.id === savedId);
    if (exact) return exact;
  }

  // 2. Tenta encontrar por label salva (caso o deviceId tenha rotacionado no navegador)
  if (savedLabel) {
    const cleanSaved = savedLabel.trim().toLowerCase();
    const byLabel = devices.find(
      (d) => d.label && d.label.trim().toLowerCase() === cleanSaved
    );
    if (byLabel) return byLabel;
  }

  // 3. Filtra apenas câmeras traseiras (exclui frontais se houver traseiras)
  const rearCameras = devices.filter((d) => !isFrontCamera(d.label));
  const pool = rearCameras.length > 0 ? rearCameras : devices;

  // 4. Ordena por pontuação (1x principal no topo, 0.5x ultra-wide e macro no fim)
  const sorted = [...pool].sort((a, b) => scoreCamera(b) - scoreCamera(a));
  return sorted[0];
}

/**
 * Ordena as câmeras para exibição no dropdown (traseiras 1x primeiro, 0.5x depois, frontais no fim)
 */
export function sortCamerasForDisplay(devices: CameraDevice[]): CameraDevice[] {
  return [...devices].sort((a, b) => scoreCamera(b) - scoreCamera(a));
}

/**
 * Recupera a preferência de câmera salva no localStorage
 */
export function getSavedCameraPreference(): {
  id: string | null;
  label: string | null;
} {
  try {
    if (typeof localStorage === 'undefined') {
      return { id: null, label: null };
    }
    const id = localStorage.getItem(CAMERA_PREFERENCE_STORAGE_KEY);
    const label = localStorage.getItem(CAMERA_PREFERENCE_LABEL_KEY);
    return { id, label };
  } catch {
    return { id: null, label: null };
  }
}

/**
 * Salva a preferência de câmera no localStorage
 */
export function saveCameraPreference(id: string, label?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CAMERA_PREFERENCE_STORAGE_KEY, id);
    if (label) {
      localStorage.setItem(CAMERA_PREFERENCE_LABEL_KEY, label);
    }
  } catch (e) {
    console.warn('Falha ao salvar preferência de câmera no localStorage:', e);
  }
}
