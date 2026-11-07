import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// Resolución base de diseño para TV (1280x720 720p / 1920x1080 1080p)
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

/**
 * 🎛️ MULTIPLICADOR DE ESCALA GLOBAL PARA TODA LA APP:
 * Modifica este único número para agrandar o achicar toda la interfaz a la vez:
 * - 1.20 o 1.25 : Todo más grande (para TVs lejanas o fuentes más grandes)
 * - 1.12        : Valor estándar recomendado actual
 * - 1.05 o 1.08 : Ligeramente más compacto
 */
export const GLOBAL_SCALE_MULTIPLIER = 0.94;

export const scale = (size: number): number => {
  const factorX = width / DESIGN_WIDTH;
  const factorY = height / DESIGN_HEIGHT;
  const factor = Math.max(factorX, factorY, 1);
  return Math.round(size * factor * GLOBAL_SCALE_MULTIPLIER);
};
