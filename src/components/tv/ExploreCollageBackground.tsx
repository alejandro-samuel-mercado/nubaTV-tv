import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { scale } from "../../lib/scale";
import { getContentList, NexoContentItem } from "../../services/nexoplay";
import RemoteImage, { prefetchImages } from "./RemoteImage";

const { width: SW, height: SH } = Dimensions.get("window");

// Dimensiones de las baldosas del collage
const TILE_W = scale(180);
const TILE_H = scale(115);
const COLS_PER_ROW = Math.ceil(SW / (TILE_W + scale(12))) + 2; // ~9 columnas
const NUM_ROWS = 4; // 4 filas para cubrir toda la pantalla con holgura
const TOTAL_TILES = COLS_PER_ROW * NUM_ROWS; // ~36 baldosas

/**
 * ExploreCollageBackground:
 * Fondo de collage / mosaico para la pantalla Explorar.
 * - Compuesto por portadas y banners reales con baja opacidad.
 * - Va cambiando periódicamente de forma aleatoria y suave (hardware cross-fade).
 * - Cubierto por degradados de niebla y viñeta para mantener excelente contraste y legibilidad.
 */
function ExploreCollageBackground({
  items,
}: {
  items?: NexoContentItem[];
}) {
  const [artworks, setArtworks] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);

  // Cargar un pool diverso de portadas y banners si no hay suficientes
  useEffect(() => {
    let cancelled = false;

    // Si ya tenemos items externos, extraer sus imágenes
    const initialUrls = (items || [])
      .flatMap((it) => [it.backdropUrl, it.posterUrl])
      .filter((u): u is string => Boolean(u));

    if (initialUrls.length >= 20) {
      setArtworks(initialUrls);
      prefetchImages(initialUrls.slice(0, 24));
      return;
    }

    // Si faltan, consultar API en paralelo para obtener ~60 imágenes reales
    Promise.all([
      getContentList({ sort: "popular", limit: 24 }),
      getContentList({ sort: "recent", limit: 24 }),
    ])
      .then(([pop, rec]) => {
        if (cancelled) return;
        const pool = [...pop, ...rec];
        const urls = pool
          .flatMap((it) => [it.backdropUrl, it.posterUrl])
          .filter((u): u is string => Boolean(u));
        // Mezclar aleatoriamente
        const shuffled = [...urls].sort(() => Math.random() - 0.5);
        setArtworks(shuffled);
        prefetchImages(shuffled.slice(0, 30));
      })
      .catch((e) => console.warn("Collage load error:", e));

    return () => {
      cancelled = true;
    };
  }, []);

  // Rotar o cambiar las portadas del collage cada 10 segundos
  useEffect(() => {
    if (artworks.length < 5) return;
    const interval = setInterval(() => {
      setSeed((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [artworks.length]);

  // Generar las baldosas organizadas en 4 filas desfasadas
  const rows = useMemo(() => {
    if (!artworks.length) return [];
    const res: { id: string; url: string }[][] = [];

    for (let r = 0; r < NUM_ROWS; r++) {
      const rowTiles: { id: string; url: string }[] = [];
      for (let c = 0; c < COLS_PER_ROW; c++) {
        const tileIdx = r * COLS_PER_ROW + c;
        // Fórmula de rotación suave con saltos pseudo-aleatorios
        const imgIdx = (tileIdx * 3 + seed * 7) % artworks.length;
        rowTiles.push({
          id: `r${r}-c${c}`,
          url: artworks[imgIdx] || "",
        });
      }
      res.push(rowTiles);
    }
    return res;
  }, [artworks, seed]);

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
                    transition={800}
                    priority="low"
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
