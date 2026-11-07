import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import RemoteImage from "./RemoteImage";

/**
 * BackdropBackground — Fondo cinematográfico para TV:
 * - Imagen completa de fondo a pantalla completa.
 * - Niebla oscura orgánica multicapa a pantalla completa (SIN cajas ni recortes rectangulares).
 * - Todas las capas usan StyleSheet.absoluteFill para que no exista ninguna línea de corte ni bordes geométricos.
 * - Fundido natural en el lateral izquierdo y la base inferior, manteniendo el tercio superior-derecho
 *   completamente nítido, despejado y brillante.
 */
function BackdropBackground({
  uri,
}: {
  uri?: string | null;
  variant?: "default" | "home";
}) {
  if (!uri) return <View style={s.layer} />;

  return (
    <View style={s.layer} pointerEvents="none">
      {/* 1. Imagen completa de fondo */}
      <RemoteImage
        uri={uri}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        transition={250}
        priority="high"
      />

      {/* 2. Niebla oscura lateral izquierda: profunda en el borde, difuminándose suavemente hacia el centro */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.96)",
          "rgba(8,8,8,0.85)",
          "rgba(8,8,8,0.55)",
          "rgba(8,8,8,0.22)",
          "rgba(8,8,8,0.04)",
          "transparent",
        ]}
        locations={[0, 0.15, 0.30, 0.44, 0.56, 0.68, 0.80]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 3. Niebla oscura inferior: base densa que acoge las tarjetas y se disipa hacia arriba de forma continua */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.95)",
          "rgba(8,8,8,0.80)",
          "rgba(8,8,8,0.48)",
          "rgba(8,8,8,0.18)",
          "rgba(8,8,8,0.03)",
          "transparent",
        ]}
        locations={[0, 0.12, 0.25, 0.38, 0.50, 0.62, 0.75]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4. Niebla diagonal orgánica: brota desde la esquina inferior-izquierda difuminándose sin formas rectas */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.92)",
          "rgba(8,8,8,0.70)",
          "rgba(8,8,8,0.38)",
          "rgba(8,8,8,0.12)",
          "transparent",
        ]}
        locations={[0, 0.20, 0.38, 0.55, 0.70, 0.85]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.85, y: 0.15 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 5. Velo de difusión suave envolvente para textura de humo realista */}
      <LinearGradient
        colors={[
          "rgba(8,8,8,0.65)",
          "rgba(8,8,8,0.35)",
          "rgba(8,8,8,0.10)",
          "transparent",
        ]}
        locations={[0, 0.32, 0.62, 1]}
        start={{ x: 0.05, y: 0.85 }}
        end={{ x: 0.65, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

export default memo(BackdropBackground);

const s = StyleSheet.create({
  layer: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 0,
    backgroundColor: "#080808",
    overflow: "hidden",
  },
});
