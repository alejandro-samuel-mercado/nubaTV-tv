import { Image, ImageContentFit } from "expo-image";
import React, { memo } from "react";
import { StyleProp } from "react-native";
import type { ImageStyle } from "expo-image";

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  priority?: "low" | "normal" | "high";
}

/**
 * Imagen remota con caché memoria+disco y fundido suave (expo-image).
 * Reemplaza al <Image> de RN: no parpadea, decodifica fuera del hilo de UI y
 * reutiliza lo ya descargado entre pantallas.
 */
function RemoteImage({
  uri,
  style,
  contentFit = "cover",
  transition = 220,
  priority = "normal",
}: Props) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={uri || undefined}
    />
  );
}

export default memo(RemoteImage);

/** Precarga imágenes en caché (no bloquea). */
export function prefetchImages(urls: (string | null | undefined)[]) {
  const list = urls.filter(Boolean) as string[];
  if (list.length) Image.prefetch(list, "memory-disk").catch(() => {});
}
