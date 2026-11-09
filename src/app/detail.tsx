import { Bangers_400Regular, useFonts } from "@expo-google-fonts/bangers";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Award,
  Calendar,
  Clock,
  Film,
  Globe,
  Heart,
  Info,
  MonitorPlay,
  Play,
  Sparkles,
  Star,
  Tag,
  Tv,
  Volume2,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BackdropBackground from "../components/tv/BackdropBackground";
import Focusable from "../components/tv/Focusable";
import RemoteImage from "../components/tv/RemoteImage";
import ViewAllCard from "../components/tv/ViewAllCard";
import { useSidebarHandle } from "../hooks/useNavThrottle";
import { scale } from "../lib/scale";
import { C } from "../lib/tvColors";
import {
  getContentDetail,
  getHomepage,
  NEXOPLAY_API_BASE,
  NexoContentItem,
} from "../services/nexoplay";
import { getItemAsync, setItemAsync } from "../utils/storage";

const { height: SH, width: SW } = Dimensions.get("window");

// ── Medidas estandarizadas y curvadas ─────────────────────────────────────────
const POSTER_W = scale(125);
const POSTER_H = scale(180);
const CARD_GAP = scale(14);

const fmtDuration = (mins?: number) => {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
};

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
  DOCUMENTARY: "Documental",
  ANIME: "Anime",
  NOVELA: "Telenovela",
  REALITY_SHOW: "Reality",
};

const pickTitle = (o: any, fb = "") =>
  o?.title || o?.translations?.[0]?.title || fb;

// ── Card de Contenido Curvada para Carruseles ────────────────────────────────
const CurvedPosterCard = memo(function CurvedPosterCard({
  item,
  onPress,
  accentColor = C.accent,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
  accentColor?: string;
}) {
  return (
    <Focusable
      onPress={() => onPress(item)}
      style={s.card}
      focusedStyle={[s.cardFocused, { borderColor: accentColor, shadowColor: accentColor }]}
      scaleFocused={1.02}
    >
      <RemoteImage
        uri={item.posterUrl || item.backdropUrl}
        style={StyleSheet.absoluteFill as any}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={["transparent", "rgba(5,5,8,0.92)"]}
        style={s.cardGrad}
      />

      {item.rating ? (
        <View style={[s.cardRating, { backgroundColor: accentColor }]}>
          <Star size={scale(9)} color="#000" fill="#000" />
          <Text style={s.cardRatingTxt}>{Number(item.rating).toFixed(1)}</Text>
        </View>
      ) : null}

      <View style={s.cardInfo}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[s.cardMeta, { color: accentColor }]}>
          {TYPE_LABEL[item.type] || item.type}
          {item.releaseYear ? ` • ${item.releaseYear}` : ""}
        </Text>
      </View>
    </Focusable>
  );
});

// ── Card de Reparto Circular y Orgánica ──────────────────────────────────────
const CastAvatarCard = memo(function CastAvatarCard({ actor }: { actor: any }) {
  const photo = actor.photo || actor.photoUrl || actor.profileUrl;
  return (
    <Focusable
      style={s.castCard}
      focusedStyle={s.castCardFocused}
      scaleFocused={1.02}
    >
      <View style={s.castAvatarRing}>
        {photo ? (
          <RemoteImage uri={photo} style={s.castAvatarImg as any} contentFit="cover" />
        ) : (
          <Film size={scale(20)} color="rgba(255,255,255,0.4)" />
        )}
      </View>
      <Text style={s.castName} numberOfLines={1}>
        {actor.name}
      </Text>
      <Text style={s.castRole} numberOfLines={1}>
        {actor.character || actor.role || "Reparto"}
      </Text>
    </Focusable>
  );
});

// ── Card de Episodio Curvada Panorámica 16:9 ─────────────────────────────────
const EpisodeCard = memo(function EpisodeCard({
  ep,
  index,
  item,
  currentSeasonNumber,
  onPlay,
}: {
  ep: any;
  index: number;
  item: NexoContentItem;
  currentSeasonNumber: number;
  onPlay: (epId: string) => void;
}) {
  const epThumb =
    ep.thumbnailUrl || ep.stillUrl || item.backdropUrl || item.posterUrl;
  const num = ep.number ?? index + 1;

  return (
    <Focusable
      onPress={() => onPlay(ep.id)}
      style={s.epCard}
      focusedStyle={s.epCardFocused}
      scaleFocused={1.02}
    >
      <View style={s.epThumbWrap}>
        <RemoteImage
          uri={epThumb}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
          transition={150}
        />
        <LinearGradient
          colors={["transparent", "rgba(5,5,8,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.epPlayOverlay}>
          <View style={s.epPlayCircle}>
            <Play size={scale(15)} color="#000" fill="#000" />
          </View>
        </View>
        {ep.duration ? (
          <View style={s.epDurBadge}>
            <Text style={s.epDurText}>{fmtDuration(ep.duration)}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.epMeta}>
        <Text style={s.epBadge}>
          T{currentSeasonNumber} • Ep. {num}
        </Text>
        <Text style={s.epTitle} numberOfLines={1}>
          {pickTitle(ep, `Episodio ${num}`)}
        </Text>
        {ep.description ? (
          <Text style={s.epDesc} numberOfLines={2}>
            {ep.description}
          </Text>
        ) : null}
      </View>
    </Focusable>
  );
});

// ── Cabecera de Sección Curvada con Línea Neón Divisoria ──────────────────────
function SectionHead({
  title,
  subtitle,
  accentColor,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  icon?: any;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={[s.sectionAccentBar, { backgroundColor: accentColor }]} />
      {Icon && <Icon size={scale(16)} color={accentColor} style={{ marginRight: scale(6) }} />}
      <View style={{ marginRight: scale(14) }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      <LinearGradient
        colors={[`${accentColor}80`, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.sectionDividerLine}
      />
    </View>
  );
}

// ── Bento Spec Tile Curvada con Marca de Agua Geométrica ─────────────────────
const BentoTile = memo(function BentoTile({
  icon: Icon,
  title,
  line1,
  line2,
  accent,
}: {
  icon: any;
  title: string;
  line1: string;
  line2?: string;
  accent: string;
}) {
  return (
    <View style={s.bentoTile}>
      {/* Línea Neón Superior */}
      <View style={[s.bentoTileTopGlow, { backgroundColor: accent }]} />
      {/* Marca de Agua Geométrica de fondo */}
      <View style={s.bentoWatermark} pointerEvents="none">
        <Icon size={scale(68)} color={accent} />
      </View>
      <View style={s.bentoTileInner}>
        <View
          style={[
            s.bentoTileIconWrap,
            { backgroundColor: `${accent}20`, borderColor: `${accent}50` },
          ]}
        >
          <Icon size={scale(17)} color={accent} />
        </View>
        <View style={s.bentoTileBody}>
          <Text style={[s.bentoTileTitle, { color: accent }]}>{title}</Text>
          <Text style={s.bentoTileL1} numberOfLines={1}>
            {line1}
          </Text>
          {line2 ? (
            <Text style={s.bentoTileL2} numberOfLines={1}>
              {line2}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
});

export default function DetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const [fontsLoaded] = useFonts({
    Bangers: Bangers_400Regular,
  });

  const [item, setItem] = useState<NexoContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [inMyList, setInMyList] = useState(false);

  // Secciones adicionales
  const [related, setRelated] = useState<NexoContentItem[]>([]);
  const [trending, setTrending] = useState<NexoContentItem[]>([]);

  // Cargar estado de favoritos
  useEffect(() => {
    if (!slug) return;
    getItemAsync("local_favorites").then((raw) => {
      try {
        const list = JSON.parse(raw || "[]");
        if (list.includes(String(slug))) setInMyList(true);
      } catch {}
    });
  }, [slug]);

  const toggleFavorite = useCallback(async () => {
    if (!slug) return;
    try {
      const raw = await getItemAsync("local_favorites");
      let list: string[] = JSON.parse(raw || "[]");
      const next = !inMyList;
      if (next) {
        if (!list.includes(String(slug))) list.push(String(slug));
      } else {
        list = list.filter((x: string) => x !== String(slug));
      }
      await setItemAsync("local_favorites", JSON.stringify(list));
      setInMyList(next);
    } catch {}
  }, [slug, inMyList]);

  // Cargar Detalle y Colecciones Curadas
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItem(null);
    setRelated([]);
    setTrending([]);
    setSeasonIdx(0);

    (async () => {
      try {
        const [mainData, homeData, relData] = await Promise.all([
          getContentDetail(String(slug)),
          getHomepage().catch(() => null),
          fetch(`${NEXOPLAY_API_BASE}/api/content/${slug}/related`)
            .then((r) => r.json())
            .then((j) => (j?.success && Array.isArray(j.data) ? j.data : []))
            .catch(() => []),
        ]);

        if (cancelled) return;
        setItem(mainData);

        const seenIds = new Set<string>();
        if (mainData?.id) seenIds.add(mainData.id);
        if (mainData?.slug) seenIds.add(mainData.slug);

        // 1. Relacionados
        let relList: NexoContentItem[] = [];
        if (Array.isArray(relData) && relData.length > 0) {
          relList = relData.filter(
            (r: any) => !seenIds.has(r.id) && !seenIds.has(r.slug),
          );
        }
        // Fallback si la API no devolvió relacionados directos
        if (relList.length === 0 && homeData) {
          const currentGenres = (mainData?.genres || []).map((g: any) =>
            (g.name || g.slug || "").toLowerCase(),
          );
          const candidates = [
            ...(homeData.recent || []),
            ...(homeData.trending || []),
            ...(homeData.featured || []),
          ];
          relList = candidates
            .filter((cand: any) => {
              if (seenIds.has(cand.id) || seenIds.has(cand.slug)) return false;
              const candGenres = (cand.genres || []).map((g: any) =>
                (g.name || g.slug || "").toLowerCase(),
              );
              return candGenres.some((cg: string) =>
                currentGenres.includes(cg),
              );
            })
            .slice(0, 15);
        }
        relList.forEach((r) => {
          if (r.id) seenIds.add(r.id);
          if (r.slug) seenIds.add(r.slug);
        });
        setRelated(relList);

        // 2. Tendencias en NubaTV (excluyendo vistos)
        if (homeData && Array.isArray(homeData.trending)) {
          const trendList = homeData.trending.filter(
            (r: any) => !seenIds.has(r.id) && !seenIds.has(r.slug),
          );
          setTrending(trendList.slice(0, 15));
        }
      } catch (err) {
        console.warn("Error cargando detalle:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const seasons: any[] = useMemo(
    () => (item?.seasons || []).filter((s: any) => s?.episodes?.length),
    [item],
  );
  const isSeries = seasons.length > 0 && item?.type !== "MOVIE";
  const currentSeason = seasons[seasonIdx];
  const firstEpisode = seasons[0]?.episodes?.[0];

  const play = useCallback(
    (episodeId?: string) =>
      router.push({
        pathname: "/player",
        params: episodeId
          ? { slug: String(slug), episodeId }
          : { slug: String(slug) },
      } as any),
    [router, slug],
  );

  const handleTrailer = useCallback(() => {
    const trailer = (item as any)?.trailerUrl;
    if (trailer) {
      Linking.openURL(trailer).catch(() => {});
    }
  }, [item]);

  const handleContentPress = useCallback(
    (target: NexoContentItem) =>
      router.replace({ pathname: "/detail", params: { slug: target.slug } } as any),
    [router],
  );

  const c: any = item || {};
  const title = item?.title || "";
  const tagline = item?.tagline || "";
  const backdrop = item?.backdropUrl || item?.posterUrl;
  const poster = item?.posterUrl || item?.backdropUrl;
  const genres = item?.genres || [];
  const year = item?.releaseYear || "";
  const durationStr = fmtDuration(item?.duration);
  const rating = item?.rating ? Number(item.rating).toFixed(1) : null;
  const ageRating =
    typeof c.ageRating === "object"
      ? c.ageRating?.code
      : c.ageRating || item?.contentRating || "ATP";
  const directors: string =
    Array.isArray(c.directors) && c.directors.length > 0
      ? c.directors.map((d: any) => d?.name || d).join(", ")
      : "";
  const cast: any[] =
    Array.isArray(c.actors) && c.actors.length > 0 ? c.actors : [];
  const tags: any[] =
    Array.isArray(c.tags) && c.tags.length > 0 ? c.tags : [];
  const originLang = (
    c.originalLanguage ||
    item?.language ||
    (item as any)?.languages?.[0] ||
    "ES"
  ).toUpperCase();
  const country = c.country || c.originCountry || "Internacional";
  const trailerUrl = c.trailerUrl;

  if (loading) {
    return (
      <View style={s.centerScreen}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingLabel}>Cargando…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={s.centerScreen}>
        <Info size={scale(48)} color={C.textMuted} />
        <Text style={s.errorLabel}>No se encontró el contenido</Text>
        <Focusable
          hasTVPreferredFocus
          onPress={() => router.back()}
          style={s.backActionBtn}
          focusedStyle={s.backActionBtnFocused}
          nextFocusLeft={sidebarHandle ?? undefined}
        >
          <ArrowLeft size={scale(16)} color="#000" />
          <Text style={s.backActionTxt}>Volver</Text>
        </Focusable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo cinematográfico con niebla orgánica */}
      <BackdropBackground uri={backdrop} variant="home" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── BOTÓN VOLVER CURVADO Y DISCRETO ── */}
        <Focusable
          onPress={() => router.back()}
          style={s.backBtn}
          focusedStyle={s.backBtnFocused}
          scaleFocused={1.06}
          nextFocusLeft={sidebarHandle ?? undefined}
        >
          <ArrowLeft size={scale(13)} color="rgba(255,255,255,0.85)" />
          <Text style={s.backBtnTxt}>Volver</Text>
        </Focusable>

        {/* ── HERO SPOTLIGHT ASIMÉTRICO: PORTADA EMPUJADA A LA DERECHA CON EFECTOS 3D ── */}
        <View style={s.heroPod}>
          {/* Módulo Izquierdo: Información limpia sobre el fondo cinematográfico */}
          <View style={s.heroLeft}>
            {/* Tagline / Chip de Categoría */}
            <View style={s.categoryChip}>
              <Sparkles size={scale(11)} color={C.accent} />
              <Text style={s.categoryChipTxt}>
                {tagline || (TYPE_LABEL[item.type] || item.type).toUpperCase()}
              </Text>
            </View>

            {/* Título Principal */}
            <Text
              style={[
                s.heroTitle,
                fontsLoaded && { fontFamily: "Bangers", letterSpacing: 1 },
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>

            {/* Cápsulas Curvadas de Metadatos con Iconos */}
            <View style={s.metaCapsules}>
              {!!year && (
                <View style={s.metaCapsule}>
                  <Calendar size={scale(11)} color="rgba(255,255,255,0.7)" />
                  <Text style={s.metaCapsuleTxt}>{year}</Text>
                </View>
              )}

              {!!durationStr && (
                <View style={s.metaCapsule}>
                  <Clock size={scale(11)} color="rgba(255,255,255,0.7)" />
                  <Text style={s.metaCapsuleTxt}>{durationStr}</Text>
                </View>
              )}

              {isSeries && (
                <View style={s.metaCapsule}>
                  <Tv size={scale(11)} color="rgba(255,255,255,0.7)" />
                  <Text style={s.metaCapsuleTxt}>
                    {seasons.length} {seasons.length === 1 ? "Temp" : "Temps"}
                  </Text>
                </View>
              )}

              {!!ageRating && (
                <View style={[s.metaCapsule, s.metaCapsuleAge]}>
                  <Text style={s.metaCapsuleTxt}>{ageRating}</Text>
                </View>
              )}

              {rating ? (
                <View style={[s.metaCapsule, s.metaCapsuleImdb]}>
                  <Star size={scale(10)} color="#000" fill="#000" />
                  <Text style={s.metaCapsuleImdbTxt}>{rating}</Text>
                </View>
              ) : null}
            </View>

            {/* Burbujas Curvadas de Géneros */}
            {genres.length > 0 && (
              <View style={s.genresRow}>
                {genres.slice(0, 3).map((g, i) => (
                  <View key={g.id ?? i} style={s.genreBubble}>
                    <Text style={s.genreBubbleTxt}>{g.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Sinopsis Cómoda */}
            {item.description ? (
              <Text style={s.heroDesc} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}

            {/* Dirección */}
            {!!directors && (
              <Text style={s.heroDirector}>
                <Text style={s.heroDirectorStrong}>Dirección: </Text>
                {directors}
              </Text>
            )}

            {/* Botones de Acción Curvados con Relieve */}
            <View style={s.buttonsRow}>
              {/* Botón Reproducir */}
              <Focusable
                hasTVPreferredFocus
                onPress={() => play(isSeries ? firstEpisode?.id : undefined)}
                style={s.btnPlay}
                focusedStyle={s.btnPlayFocused}
                nextFocusLeft={sidebarHandle ?? undefined}
              >
                <Play size={scale(16)} color="#000" fill="#000" />
                <Text style={s.btnPlayTxt}>
                  {isSeries ? "Reproducir T1 E1" : "Reproducir"}
                </Text>
              </Focusable>

              {/* Botón Tráiler */}
              {!!trailerUrl && (
                <Focusable
                  onPress={handleTrailer}
                  style={s.btnTrailer}
                  focusedStyle={s.btnTrailerFocused}
                >
                  <MonitorPlay size={scale(16)} color="#ffffff" />
                  <Text style={s.btnTrailerTxt}>Tráiler</Text>
                </Focusable>
              )}

              {/* Botón Favorito Curvado */}
              <Focusable
                onPress={toggleFavorite}
                style={[s.btnIcon, inMyList && s.btnIconActive]}
                focusedStyle={s.btnIconFocused}
              >
                <Heart
                  size={scale(18)}
                  color={inMyList ? C.accent : "#ffffff"}
                  fill={inMyList ? C.accent : "none"}
                />
              </Focusable>
            </View>
          </View>

          {/* Módulo Derecho: Portada Empujada a la Derecha con Halo de Luz y Marco 3D */}
          <View style={s.heroRight}>
            {poster ? (
              <View style={s.posterPodWrap}>
                {/* 1. Halo de Luz Ambiental Radiante Detrás de la Portada */}
                <View style={s.posterGlowAura} pointerEvents="none" />

                {/* 2. Marco Geométrico Decorativo Angulado (Forma Tridimensional) */}
                <View style={s.posterBackFrame} pointerEvents="none" />

                {/* 3. Pod Principal de Portada */}
                <View style={s.posterPod}>
                  <RemoteImage
                    uri={poster}
                    style={s.posterPodImg as any}
                    contentFit="cover"
                    transition={200}
                    priority="high"
                  />
                  {/* Reflejo Especular Superior de Cristal */}
                  <LinearGradient
                    colors={["rgba(255,255,255,0.22)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.7, y: 0.7 }}
                    style={s.posterGlassSheen}
                    pointerEvents="none"
                  />
                  {/* Sombra Inferior Suave */}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.65)"]}
                    style={s.posterPodShad}
                    pointerEvents="none"
                  />
                  {/* Badge Holográfico Flotante */}
                  <View style={s.posterCornerBadge}>
                    <Sparkles size={scale(10)} color={C.accent} />
                    <Text style={s.posterCornerBadgeTxt}>4K HDR10+</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── REPARTO PRINCIPAL (AVATARES CIRCULARES CON DOBLE ANILLO) ── */}
        {cast.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Reparto Principal" accentColor="#ffb703" />
            <FlatList
              data={cast.slice(0, 16)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(a, i) => String(a.id ?? i)}
              contentContainerStyle={s.castRow}
              renderItem={({ item: actor }) => <CastAvatarCard actor={actor} />}
            />
          </View>
        )}

        {/* ── BENTO MOSAICO: FICHA TÉCNICA CON MARCAS DE AGUA Y EFECTOS ── */}
        <View style={s.section}>
          <SectionHead
            title={isSeries ? "Ficha de la Serie" : "Ficha de la Película"}
            accentColor="#ff9100"
          />
          <View style={s.bentoGrid}>
            <BentoTile
              icon={Film}
              title="Producción"
              line1={directors ? `Dir. ${directors}` : TYPE_LABEL[item.type] || item.type}
              line2={item.originalTitle && item.originalTitle !== item.title ? `Orig: ${item.originalTitle}` : `Categoría: ${TYPE_LABEL[item.type] || item.type}`}
              accent="#ff9100"
            />
            <BentoTile
              icon={Globe}
              title="Audio & Origen"
              line1={`País: ${country}`}
              line2={`Idioma Original: ${originLang}`}
              accent="#00f0ff"
            />
            <BentoTile
              icon={Clock}
              title="Formato & Métricas"
              line1={`Duración: ${durationStr || `${seasons.length} Temporadas`}`}
              line2={`Estreno: ${year || "Reciente"} • Edad: ${ageRating}`}
              accent="#ff5500"
            />
            <BentoTile
              icon={Star}
              title="Valoración"
              line1={rating ? `★ ${rating} IMDb` : "Excelente recepción"}
              line2="Disponible en Audio Dolby 5.1"
              accent="#ffb703"
            />
          </View>

          {/* Tags con Burbujas Curvadas Neón */}
          {tags.length > 0 && (
            <View style={s.tagsDock}>
              {tags.slice(0, 8).map((t, idx) => (
                <View key={t.id ?? idx} style={s.tagBubble}>
                  <Tag size={scale(9)} color={C.accent} />
                  <Text style={s.tagBubbleTxt}>{t.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── EPISODIOS Y TEMPORADAS (PARA SERIES) ── */}
        {isSeries && (
          <View style={s.section}>
            <SectionHead
              title="Episodios y Temporadas"
              subtitle={`${seasons.length} ${
                seasons.length === 1 ? "temporada" : "temporadas"
              } • ${seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0)} episodios`}
              accentColor="#ff5500"
            />

            {/* Selector de Temporadas en Cápsulas Curvadas */}
            {seasons.length > 1 && (
              <FlatList
                data={seasons}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(s, i) => String(s.id ?? i)}
                contentContainerStyle={s.seasonList}
                extraData={seasonIdx}
                renderItem={({ item: se, index }) => {
                  const on = index === seasonIdx;
                  const epCount = se.episodes?.length || 0;
                  return (
                    <Focusable
                      onPress={() => setSeasonIdx(index)}
                      style={[s.seasonCapsule, on && s.seasonCapsuleActive]}
                      focusedStyle={s.seasonCapsuleFocused}
                      scaleFocused={1.04}
                    >
                      <Text style={[s.seasonCapsuleTxt, on && s.seasonCapsuleTxtActive]}>
                        {se.title || `Temporada ${se.number ?? index + 1}`}
                      </Text>
                      <View style={[s.seasonCountBadge, on && s.seasonCountBadgeActive]}>
                        <Text style={[s.seasonCountBadgeTxt, on && s.seasonCountBadgeTxtActive]}>
                          {epCount}
                        </Text>
                      </View>
                    </Focusable>
                  );
                }}
              />
            )}

            {/* Carrusel 16:9 de Episodios con Bordes Curvados */}
            <FlatList
              data={currentSeason?.episodes || []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(ep, i) => String(ep.id ?? i)}
              contentContainerStyle={s.epList}
              renderItem={({ item: ep, index }) => (
                <EpisodeCard
                  ep={ep}
                  index={index}
                  item={item}
                  currentSeasonNumber={currentSeason?.number || 1}
                  onPlay={play}
                />
              )}
            />
          </View>
        )}

        {/* ── TÍTULOS SIMILARES Y RECOMENDADOS (CURADOS, SIN RELLENO) ── */}
        {related.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Títulos Similares" accentColor="#ffba08" />
            <FlatList
              data={related}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(r, i) => String(r.id ?? i)}
              contentContainerStyle={s.rowTrack}
              renderItem={({ item: r }) => (
                <CurvedPosterCard
                  item={r}
                  onPress={handleContentPress}
                  accentColor="#ffba08"
                />
              )}
              ListFooterComponent={
                <View style={{ marginLeft: CARD_GAP }}>
                  <ViewAllCard
                    width={POSTER_W}
                    height={POSTER_H}
                    onPress={() =>
                      router.push({
                        pathname: "/(tv)/explore",
                        params: item.genres?.[0]?.name
                          ? { genre: item.genres[0].name }
                          : { type: item.type },
                      } as any)
                    }
                    label="Ver todo"
                    sublabel="Relacionados"
                    accentColor="#ffba08"
                  />
                </View>
              }
            />
          </View>
        )}

        {/* ── TENDENCIAS EN NUBATV (SOLO SI EXISTEN Y DIFERENTES) ── */}
        {trending.length > 0 && (
          <View style={s.section}>
            <SectionHead
              title="Tendencias en Nuba TV"
              accentColor="#ef4444"
              icon={Sparkles}
            />
            <FlatList
              data={trending}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(r, i) => String(r.id ?? i)}
              contentContainerStyle={s.rowTrack}
              renderItem={({ item: r }) => (
                <CurvedPosterCard
                  item={r}
                  onPress={handleContentPress}
                  accentColor="#ef4444"
                />
              )}
              ListFooterComponent={
                <View style={{ marginLeft: CARD_GAP }}>
                  <ViewAllCard
                    width={POSTER_W}
                    height={POSTER_H}
                    onPress={() =>
                      router.push({
                        pathname: "/(tv)/explore",
                        params: { sort: "popular" },
                      } as any)
                    }
                    label="Ver todo"
                    sublabel="Tendencias"
                    accentColor="#ef4444"
                  />
                </View>
              }
            />
          </View>
        )}

        <View style={{ height: scale(48) }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scale(52),
    paddingTop: scale(36),
    paddingBottom: scale(36),
  },
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#080808",
    gap: scale(14),
  },
  loadingLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(15),
    fontWeight: "600",
  },
  errorLabel: {
    color: "#ffffff",
    fontSize: scale(18),
    fontWeight: "700",
  },
  backActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: scale(16),
  },
  backActionBtnFocused: {
    backgroundColor: "#ffffff",
  },
  backActionTxt: {
    color: "#000",
    fontWeight: "800",
    fontSize: scale(13),
  },

  // ── BOTÓN VOLVER (CÁPSULA CURVADA) ─────────────────────────────────────────
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: scale(14),
    paddingVertical: scale(6.5),
    borderRadius: scale(18),
    marginBottom: scale(20),
  },
  backBtnFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderColor: "#ffffff",
  },
  backBtnTxt: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: scale(12),
    fontWeight: "700",
  },

  // ── HERO POD: ASIMÉTRICO, PORTADA A LA DERECHA CON EFECTOS 3D ─────────────
  heroPod: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(44),
  },
  heroLeft: {
    flex: 1,
    maxWidth: scale(660),
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.3)",
    paddingHorizontal: scale(12),
    paddingVertical: scale(4.5),
    borderRadius: scale(16),
    alignSelf: "flex-start",
    marginBottom: scale(10),
  },
  categoryChipTxt: {
    color: C.accent,
    fontSize: scale(11.5),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: scale(42),
    fontWeight: "900",
    lineHeight: scale(48),
    marginBottom: scale(10),
    textShadowColor: "rgba(255, 183, 3, 0.25)",
    textShadowOffset: { width: 0, height: scale(2) },
    textShadowRadius: scale(10),
  },
  metaCapsules: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: scale(8),
    marginBottom: scale(12),
  },
  metaCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(14),
  },
  metaCapsuleAge: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  metaCapsuleImdb: {
    backgroundColor: "#f5c518",
    borderColor: "#f5c518",
  },
  metaCapsuleTxt: {
    color: "rgba(255,255,255,0.88)",
    fontSize: scale(11.5),
    fontWeight: "700",
  },
  metaCapsuleImdbTxt: {
    color: "#000000",
    fontSize: scale(11.5),
    fontWeight: "900",
  },
  genresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
    marginBottom: scale(12),
  },
  genreBubble: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(3.5),
    borderRadius: scale(12),
  },
  genreBubbleTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(11.5),
    fontWeight: "600",
  },
  heroDesc: {
    fontSize: scale(14),
    lineHeight: scale(22),
    color: "rgba(255,255,255,0.8)",
    marginBottom: scale(12),
  },
  heroDirector: {
    fontSize: scale(12.5),
    color: "rgba(255,255,255,0.6)",
    marginBottom: scale(16),
  },
  heroDirectorStrong: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "800",
  },

  // ── BOTONES DE ACCIÓN CURVADOS ─────────────────────────────────────────────
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    backgroundColor: C.accent,
    paddingHorizontal: scale(28),
    height: scale(48),
    borderRadius: scale(24),
  },
  btnPlayFocused: {
    backgroundColor: "#ffffff",
    transform: [{ scale: 1.05 }],
    shadowColor: "#ffffff",
    shadowRadius: scale(14),
    shadowOpacity: 0.6,
  },
  btnPlayTxt: {
    color: "#000000",
    fontSize: scale(14),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  btnTrailer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: scale(18),
    height: scale(48),
    borderRadius: scale(24),
  },
  btnTrailerFocused: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "#ffffff",
  },
  btnTrailerTxt: {
    color: "#ffffff",
    fontSize: scale(13),
    fontWeight: "800",
  },
  btnIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnIconActive: {
    backgroundColor: "rgba(255,183,3,0.15)",
    borderColor: C.accent,
  },
  btnIconFocused: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "#ffffff",
  },

  // ── MÓDULO DERECHO: PORTADA 3D CON HALO Y FORMA ANGULADA ──────────────────
  heroRight: {
    marginLeft: scale(36),
    alignItems: "center",
    justifyContent: "center",
  },
  posterPodWrap: {
    position: "relative",
    width: scale(235),
    height: scale(345),
    justifyContent: "center",
    alignItems: "center",
  },
  posterGlowAura: {
    position: "absolute",
    top: scale(-12),
    left: scale(-12),
    right: scale(-12),
    bottom: scale(-12),
    borderRadius: scale(32),
    backgroundColor: C.accent,
    opacity: 0.22,
    shadowColor: C.accent,
    shadowRadius: scale(36),
    shadowOpacity: 0.9,
  },
  posterBackFrame: {
    position: "absolute",
    width: scale(230),
    height: scale(340),
    borderRadius: scale(24),
    backgroundColor: "rgba(255, 183, 3, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.35)",
    transform: [{ rotate: "3.5deg" }],
  },
  posterPod: {
    width: scale(235),
    height: scale(345),
    borderRadius: scale(24),
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "#0d0b14",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: scale(12) },
    shadowOpacity: 0.85,
    shadowRadius: scale(24),
  },
  posterPodImg: {
    width: "100%",
    height: "100%",
  },
  posterGlassSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  posterPodShad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  posterCornerBadge: {
    position: "absolute",
    top: scale(12),
    right: scale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.5)",
    paddingHorizontal: scale(9),
    paddingVertical: scale(4),
    borderRadius: scale(10),
  },
  posterCornerBadgeTxt: {
    color: C.accent,
    fontSize: scale(9.5),
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // ── SECCIÓN ────────────────────────────────────────────────────────────────
  section: {
    marginBottom: scale(38),
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(16),
  },
  sectionAccentBar: {
    width: scale(4),
    height: scale(20),
    borderRadius: scale(2),
    marginRight: scale(10),
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: scale(20),
    fontWeight: "800",
  },
  sectionSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: scale(12),
    marginTop: scale(2),
  },
  sectionDividerLine: {
    flex: 1,
    height: 1.5,
    borderRadius: 1,
  },

  // ── REPARTO (CIRCULAR CON DOBLE ANILLO) ────────────────────────────────────
  castRow: {
    gap: scale(18),
    paddingRight: scale(36),
  },
  castCard: {
    width: scale(88),
    alignItems: "center",
  },
  castCardFocused: {
    transform: [{ scale: 1.08 }],
  },
  castAvatarRing: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "rgba(255, 183, 3, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: scale(8),
  },
  castAvatarImg: {
    width: "100%",
    height: "100%",
  },
  castName: {
    color: "#ffffff",
    fontSize: scale(11.5),
    fontWeight: "700",
    textAlign: "center",
  },
  castRole: {
    color: "rgba(255, 183, 3, 0.8)",
    fontSize: scale(10),
    fontWeight: "600",
    textAlign: "center",
    marginTop: scale(2),
  },

  // ── BENTO MOSAICO: FICHA TÉCNICA CON MARCAS DE AGUA ────────────────────────
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(12),
  },
  bentoTile: {
    width: (SW - scale(104) - scale(36)) / 4,
    minWidth: scale(180),
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(14, 12, 20, 0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: scale(18),
    padding: scale(14),
  },
  bentoTileTopGlow: {
    position: "absolute",
    top: 0,
    left: scale(20),
    right: scale(20),
    height: scale(2),
    borderRadius: scale(1),
  },
  bentoWatermark: {
    position: "absolute",
    right: scale(-12),
    bottom: scale(-12),
    opacity: 0.07,
  },
  bentoTileInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  bentoTileIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(14),
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bentoTileBody: {
    flex: 1,
  },
  bentoTileTitle: {
    fontSize: scale(10.5),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: scale(2),
  },
  bentoTileL1: {
    color: "#ffffff",
    fontSize: scale(12.5),
    fontWeight: "700",
  },
  bentoTileL2: {
    color: "rgba(255,255,255,0.55)",
    fontSize: scale(11),
    fontWeight: "500",
    marginTop: scale(1),
  },
  tagsDock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
    marginTop: scale(14),
  },
  tagBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    backgroundColor: "rgba(255, 183, 3, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.25)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(4.5),
    borderRadius: scale(12),
  },
  tagBubbleTxt: {
    color: "#ffe082",
    fontSize: scale(11),
    fontWeight: "700",
  },

  // ── EPISODIOS Y TEMPORADAS ─────────────────────────────────────────────────
  seasonList: {
    gap: scale(10),
    marginBottom: scale(14),
  },
  seasonCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(14),
    paddingVertical: scale(7),
    borderRadius: scale(20),
  },
  seasonCapsuleActive: {
    backgroundColor: "rgba(255,183,3,0.18)",
    borderColor: C.accent,
  },
  seasonCapsuleFocused: {
    borderColor: C.accent,
    backgroundColor: "rgba(255,183,3,0.3)",
  },
  seasonCapsuleTxt: {
    color: "rgba(255,255,255,0.8)",
    fontSize: scale(12),
    fontWeight: "700",
  },
  seasonCapsuleTxtActive: {
    color: C.accent,
    fontWeight: "900",
  },
  seasonCountBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  seasonCountBadgeActive: {
    backgroundColor: C.accent,
  },
  seasonCountBadgeTxt: {
    color: "#ffffff",
    fontSize: scale(10),
    fontWeight: "800",
  },
  seasonCountBadgeTxtActive: {
    color: "#000000",
    fontWeight: "900",
  },
  epList: {
    gap: scale(16),
    paddingRight: scale(36),
  },
  epCard: {
    width: scale(240),
    borderRadius: scale(16),
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  epCardFocused: {
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowRadius: scale(12),
    shadowOpacity: 0.8,
  },
  epThumbWrap: {
    width: "100%",
    height: scale(135),
    position: "relative",
    backgroundColor: "#111116",
  },
  epPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  epPlayCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: scale(2),
  },
  epDurBadge: {
    position: "absolute",
    bottom: scale(6),
    right: scale(6),
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(6),
  },
  epDurText: {
    color: "#ffffff",
    fontSize: scale(10),
    fontWeight: "700",
  },
  epMeta: {
    padding: scale(10),
  },
  epBadge: {
    color: C.accent,
    fontSize: scale(10),
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: scale(2),
  },
  epTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: scale(12),
    marginBottom: scale(2),
  },
  epDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: scale(10.5),
    lineHeight: scale(14),
  },

  // ── FILAS DE CONTENIDO (CARRUSELES) ────────────────────────────────────────
  rowTrack: {
    gap: CARD_GAP,
    paddingVertical: scale(14),
    paddingRight: scale(36),
  },
  card: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: scale(14),
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardFocused: {
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowRadius: scale(10),
    shadowOpacity: 0.8,
  },
  cardGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  cardRating: {
    position: "absolute",
    top: scale(7),
    right: scale(7),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(6),
  },
  cardRatingTxt: {
    color: "#000",
    fontWeight: "900",
    fontSize: scale(9.5),
  },
  cardInfo: {
    position: "absolute",
    left: scale(8),
    right: scale(8),
    bottom: scale(8),
  },
  cardTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: scale(11.5),
    lineHeight: scale(15),
    marginBottom: scale(2),
  },
  cardMeta: {
    fontSize: scale(9.5),
    fontWeight: "600",
  },
});
