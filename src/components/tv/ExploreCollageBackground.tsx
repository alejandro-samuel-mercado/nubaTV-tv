import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { scale } from "../../lib/scale";
import { getContentList, NexoContentItem } from "../../services/nexoplay";
import RemoteImage, { prefetchImages } from "./RemoteImage";

const { width: SW, height: SH } = Dimensions.get("window");

// Dimensiones de las baldosas del collage (optimizadas para mínimo uso de GPU/VRAM en TV)
const TILE_W = scale(240);
const TILE_H = scale(145);
const COLS_PER_ROW = Math.ceil(SW / (TILE_W + scale(12))) + 1; // ~5 columnas
const NUM_ROWS = 3; // 3 filas cubren la pantalla sin sobrecargar texturas
const TOTAL_TILES = COLS_PER_ROW * NUM_ROWS;

/**
 * ExploreCollageBackground:
 * Fondo de collage / mosaico ligero para la pantalla Explorar.
 * - Compuesto por portadas y banners reales con baja opacidad.
 * - Sin intervalos de re-renderizado que compitan con la navegación del catálogo.
 */
function ExploreCollageBackground({
  items,
}: {
  items?: NexoContentItem[];
}) {
  const [fallbackArtworks, setFallbackArtworks] = useState<string[]>([]);

  const itemUrls = useMemo(() => {
    return (items || [])
      .slice(0, 24)
      .map((it) => it.backdropUrl || it.posterUrl)
      .filter((u): u is string => Boolean(u));
  }, [items]);

  const artworks = itemUrls.length >= 6 ? itemUrls : fallbackArtworks;

  // Cargar un pool ligero solo si pasados 350ms no hay items externos
  useEffect(() => {
    if (itemUrls.length >= 6 || fallbackArtworks.length > 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getContentList({ sort: "popular", limit: 18 })
        .then((pop) => {
          if (cancelled) return;
          const urls = pop
            .map((it) => it.backdropUrl || it.posterUrl)
            .filter((u): u is string => Boolean(u));
          setFallbackArtworks(urls);
        })
        .catch(() => {});
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [itemUrls.length, fallbackArtworks.length]);

  // Generar las baldosas organizadas en 3 filas desfasadas
  const rows = useMemo(() => {
    if (!artworks.length) return [];
    const res: { id: string; url: string }[][] = [];

    for (let r = 0; r < NUM_ROWS; r++) {
      const rowTiles: { id: string; url: string }[] = [];
      for (let c = 0; c < COLS_PER_ROW; c++) {
        const tileIdx = r * COLS_PER_ROW + c;
        const imgIdx = (tileIdx * 3) % artworks.length;
        rowTiles.push({
          id: `r${r}-c${c}`,
          url: artworks[imgIdx] || "",
        });
      }
      res.push(rowTiles);
    }
    return res;
  }, [artworks]);

  return (
    <View style={s.root} pointerEvents="none">
      {/* 1. Mosaico de baldosas con portadas y banners opacos */}
      <View style={s.collageGrid}>
        {rows.map((row, rIdx) => {
          // Desfase en filas pares para crear efecto de ladrillo / collage dinámico
          const isShifted = rIdx % 2 === 1;
          return (
            <View
              key={`row-${rIdx}`}
              style={[
                s.collageRow,
                isShifted && { marginLeft: -TILE_W * 0.45 },
              ]}
            >
              {row.map((tile) => (
                <View key={tile.id} style={s.tile}>
                  <RemoteImage
                    uri={tile.url}
                    style={StyleSheet.absoluteFill as any}
                    contentFit="cover"
                    transition={200}
                    priority="low"
                    disableRecycling
                  />
                  {/* Tinte oscuro individual por baldosa */}
                  <View style={s.tileDarkener} />
                </View>
              ))}
            </View>
          );
        })}
      </View>

      {/* 2. Velo oscuro base (opacidad balanceada para que el collage sea visible pero discreto) */}
      <View style={s.darkOverlay} />

      {/* 3. Degradado horizontal (más denso a la izquierda para máxima legibilidad de la barra de filtros) */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.96)",
          "rgba(8,8,8,0.82)",
          "rgba(8,8,8,0.48)",
          "rgba(8,8,8,0.22)",
          "rgba(8,8,8,0.55)",
          "#080808",
        ]}
        locations={[0, 0.22, 0.38, 0.58, 0.78, 0.92, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4. Degradado vertical para viñeta superior e inferior */}
      <LinearGradient
        colors={[
          "rgba(8,8,8,0.85)",
          "rgba(8,8,8,0.20)",
          "rgba(8,8,8,0.15)",
          "rgba(8,8,8,0.65)",
          "#080808",
        ]}
        locations={[0, 0.15, 0.45, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

export default memo(ExploreCollageBackground);

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#080808",
    overflow: "hidden",
    zIndex: 0,
  },
  collageGrid: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    opacity: 0.28, // Visibilidad equilibrada: opaca pero reconocible
    transform: [{ scale: 1.05 }], // Ligeramente sobredimensionado para no mostrar bordes al desfasar
  },
  collageRow: {
    flexDirection: "row",
    marginBottom: scale(10),
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: scale(8),
    overflow: "hidden",
    backgroundColor: "#11141c",
    marginHorizontal: scale(5),
  },
  tileDarkener: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10, 14, 22, 0.25)",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8, 8, 8, 0.45)",
  },
});
