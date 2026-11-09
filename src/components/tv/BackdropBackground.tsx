import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import RemoteImage from "./RemoteImage";

/**
 * BackdropBackground — Fondo cinematográfico para TV:
 * - Capa ambiental difuminada de relleno para no dejar vacíos.
 * - Imagen principal en alta fidelidad ajustada al tamaño de pantalla sin sobre-escalar ni recortar.
 * - Niebla oscura orgánica multicapa a pantalla completa (SIN cajas ni recortes rectangulares).
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
      {/* 1. Capa ambiental difuminada de fondo: llena la pantalla suavemente sin vacíos */}
      <RemoteImage
        uri={uri}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        blurRadius={Platform.OS === "web" ? 35 : 25}
        transition={250}
        priority="low"
      />

      {/* 2. Imagen principal nítida ajustada exactamente al tamaño de pantalla (contain, sin sobre-escalar) */}
      <RemoteImage
        uri={uri}
        style={StyleSheet.absoluteFill as any}
        contentFit="contain"
        contentPosition="right"
        transition={250}
        priority="high"
      />

      {/* 3. Niebla oscura lateral izquierda: profunda en el borde, difuminándose suavemente hacia el centro */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.96)",
          "rgba(8,8,8,0.82)",
          "rgba(8,8,8,0.52)",
          "rgba(8,8,8,0.22)",
          "rgba(8,8,8,0.05)",
          "transparent",
        ]}
        locations={[0, 0.15, 0.32, 0.50, 0.68, 0.84, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4. Niebla oscura inferior: base densa que acoge las tarjetas y se disipa hacia arriba de forma continua */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.95)",
          "rgba(8,8,8,0.78)",
          "rgba(8,8,8,0.48)",
          "rgba(8,8,8,0.20)",
          "rgba(8,8,8,0.04)",
          "transparent",
        ]}
        locations={[0, 0.14, 0.30, 0.50, 0.70, 0.86, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 5. Niebla diagonal orgánica: brota desde la esquina inferior-izquierda difuminándose sin formas rectas */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.90)",
          "rgba(8,8,8,0.65)",
          "rgba(8,8,8,0.35)",
          "rgba(8,8,8,0.10)",
          "transparent",
        ]}
        locations={[0, 0.20, 0.42, 0.65, 0.85, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.85, y: 0.15 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 6. Velo de difusión suave envolvente para textura de humo realista */}
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
