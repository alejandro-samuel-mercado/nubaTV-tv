import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// Diseño orientado a TV: escalamos más agresivamente para que el UI no se vea pequeño.
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

export const scale = (size: number): number => {
  const factorX = width / DESIGN_WIDTH;
  const factorY = height / DESIGN_HEIGHT;
  const factor = Math.max(factorX, factorY, 1);
  return Math.round(size * factor * 1.12);
};
