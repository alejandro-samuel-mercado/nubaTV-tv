import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import RemoteImage from "./RemoteImage";

/**
 * Fondo fijo a pantalla completa con fundido entre imágenes y degradados.
 * Aislado y memoizado: sólo se re-renderiza cuando cambia la URL.
 */
function BackdropBackground({
  uri,
  variant = "default",
}: {
  uri?: string | null;
  variant?: "default" | "home";
}) {
  return (
    <View style={s.layer} pointerEvents="none">
      <RemoteImage
        uri={uri}
        style={StyleSheet.absoluteFill as any}
        transition={450}
        priority="high"
      />
      <LinearGradient
        colors={
          variant === "home"
            ? [
                "rgba(8,8,8,0.55)",
                "rgba(8,8,8,0.15)",
                "rgba(8,8,8,0.35)",
                "rgba(8,8,8,0.85)",
              ]
            : [
                "rgba(10,10,10,0.6)",
                "rgba(10,10,10,0.35)",
                "rgba(10,10,10,0.6)",
                "rgba(10,10,10,0.94)",
              ]
        }
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(8,8,8,0.75)", "rgba(8,8,8,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.55, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default memo(BackdropBackground);

const s = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    backgroundColor: "#080808",
    overflow: "hidden",
  },
});
