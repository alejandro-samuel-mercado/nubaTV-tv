import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Clock,
  Film,
  Globe,
  Info,
  Play,
  Plus,
  Star,
  Tv,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Focusable from "../components/tv/Focusable";
import RemoteImage from "../components/tv/RemoteImage";
import { useSidebarHandle } from "../hooks/useNavThrottle";
import { scale } from "../lib/scale";
import { C } from "../lib/tvColors";
import {
  getContentDetail,
  NEXOPLAY_API_BASE,
  NexoContentItem,
} from "../services/nexoplay";

const { height: SH } = Dimensions.get("window");

const fmt = (mins?: number) => {
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
};
const pickTitle = (o: any, fb = "") =>
  o?.title || o?.translations?.[0]?.title || fb;

const CastItem = memo(function CastItem({ actor }: { actor: any }) {
  return (
    <Focusable style={s.castCard} focusedStyle={s.castCardFocused}>
      <RemoteImage uri={actor.photo || actor.profileUrl} style={s.castAvatar as any} />
      <View style={s.castInfo}>
        <Text style={s.castName} numberOfLines={1}>{actor.name}</Text>
        <Text style={s.castRole} numberOfLines={1}>{actor.character || actor.role || "Reparto"}</Text>
      </View>
    </Focusable>
  );
});

const RelatedCard = memo(function RelatedCard({
  item,
  onPress,
}: {
  item: NexoContentItem;
  onPress: (item: NexoContentItem) => void;
}) {
  return (
    <Focusable onPress={() => onPress(item)} style={s.relCard} focusedStyle={s.relCardFocused}>
      <RemoteImage uri={item.posterUrl || item.backdropUrl} style={s.relPoster as any} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={s.relGrad} />
      <View style={s.relInfo}>
        <Text style={s.relTitle} numberOfLines={2}>{item.title}</Text>
        {item.releaseYear ? <Text style={s.relYear}>{item.releaseYear}</Text> : null}
      </View>
    </Focusable>
  );
});

const EpCard = memo(function EpCard({
  ep,
  index,
  item,
  onPlay,
}: {
  ep: any;
  index: number;
  item: NexoContentItem;
  onPlay: (epId: string) => void;
}) {
  return (
    <Focusable onPress={() => onPlay(ep.id)} style={s.epCard} focusedStyle={s.epCardFocused}>
      <View style={s.epThumbWrap}>
        <RemoteImage
          uri={ep.thumbnailUrl || ep.stillUrl || item.backdropUrl || item.posterUrl}
          style={s.epThumb as any}
        />
        <View style={s.epPlayOverlay}>
          <Play size={scale(20)} color="#fff" fill="#fff" />
        </View>
        {ep.duration ? (
          <View style={s.epDurBadge}>
            <Text style={s.epDurText}>{fmt(ep.duration)}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.epMeta}>
        <Text style={s.epNum}>Ep. {ep.number ?? index + 1}</Text>
        <Text style={s.epTitle} numberOfLines={2}>
          {pickTitle(ep, `Episodio ${ep.number ?? index + 1}`)}
        </Text>
        {ep.description ? (
          <Text style={s.epDesc} numberOfLines={2}>{ep.description}</Text>
        ) : null}
      </View>
    </Focusable>
  );
});

const DetailRow = memo(function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[s.detRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.detLabel}>{label}</Text>
      <Text style={s.detValue}>{value}</Text>
    </View>
  );
});

export default function DetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();

  const [item, setItem] = useState<NexoContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [inMyList, setInMyList] = useState(false);
  const [related, setRelated] = useState<NexoContentItem[]>([]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    setItem(null);
    setRelated([]);
    setSeasonIdx(0);

    getContentDetail(String(slug))
      .then((d) => { if (on) setItem(d); })
      .finally(() => { if (on) setLoading(false); });

    fetch(`${NEXOPLAY_API_BASE}/api/content/${slug}/related`)
      .then((r) => r.json())
      .then((j) => {
        if (on && j?.success && Array.isArray(j.data)) setRelated(j.data);
      })
      .catch(() => {});

    return () => { on = false; };
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
        params: episodeId ? { slug: String(slug), episodeId } : { slug: String(slug) },
      } as any),
    [router, slug],
  );

  const handleRelated = useCallback(
    (r: NexoContentItem) =>
      router.replace({ pathname: "/detail", params: { slug: r.slug } } as any),
    [router],
  );

  const c: any = item || {};
  const title = item?.title || "";
  const tagline = item?.tagline || "";
  const backdrop = item?.backdropUrl || item?.posterUrl;
  const genres = item?.genres?.map((g) => g.name).join(" • ") || "";
  const year = item?.releaseYear || "";
  const durationStr = fmt(item?.duration);
  const rating = item?.rating ? Number(item.rating).toFixed(1) : null;
  const ageRating = c.ageRating || item?.contentRating || "";
  const directors: string =
    Array.isArray(c.directors) && c.directors.length > 0
      ? c.directors.map((d: any) => d?.name || d).join(", ")
      : "";
  const cast: any[] =
    Array.isArray(c.actors) && c.actors.length > 0 ? c.actors : [];

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadTxt}>Cargando...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={s.center}>
        <Info size={scale(40)} color={C.textMuted} />
        <Text style={s.empty}>No se pudo cargar el contenido</Text>
        <Focusable
          hasTVPreferredFocus
          onPress={() => router.back()}
          style={s.btnBack}
          focusedStyle={s.btnBackFocused}
          nextFocusLeft={sidebarHandle ?? undefined}
        >
          <ArrowLeft size={scale(16)} color="#fff" />
          <Text style={s.btnBackTxt}>Volver</Text>
        </Focusable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Full-screen backdrop */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RemoteImage uri={backdrop} style={StyleSheet.absoluteFill as any} priority="high" transition={400} />
        <LinearGradient
          colors={["rgba(8,8,8,0.25)", "rgba(8,8,8,0.5)", "#080808"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(8,8,8,0.92)", "rgba(8,8,8,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0.45, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Focusable
              hasTVPreferredFocus
              onPress={() => router.back()}
              style={s.backBtn}
              focusedStyle={s.backBtnFocused}
              nextFocusLeft={sidebarHandle ?? undefined}
            >
              <ArrowLeft size={scale(16)} color="#fff" />
              <Text style={s.backTxt}>Volver</Text>
            </Focusable>

            <Text style={s.title} numberOfLines={3}>{title}</Text>
            {!!tagline && <Text style={s.tagline} numberOfLines={2}>{tagline}</Text>}

            {/* Meta chips */}
            <View style={s.chips}>
              {!!year && (
                <View style={s.chip}>
                  <Text style={s.chipTxt}>{year}</Text>
                </View>
              )}
              {!!durationStr && (
                <View style={s.chip}>
                  <Clock size={scale(11)} color="rgba(255,255,255,0.8)" />
                  <Text style={s.chipTxt}>{durationStr}</Text>
                </View>
              )}
              {!!ageRating && (
                <View style={[s.chip, s.chipBorder]}>
                  <Text style={s.chipTxt}>{ageRating}</Text>
                </View>
              )}
              {rating ? (
                <View style={[s.chip, s.chipImdb]}>
                  <Star size={scale(11)} color="#000" fill="#000" />
                  <Text style={s.chipImdbTxt}>{rating}</Text>
                </View>
              ) : null}
              {isSeries && (
                <View style={s.chip}>
                  <Tv size={scale(11)} color="rgba(255,255,255,0.8)" />
                  <Text style={s.chipTxt}>{seasons.length} temp.</Text>
                </View>
              )}
            </View>

            {!!genres && <Text style={s.genres} numberOfLines={2}>{genres}</Text>}

            {item.description ? (
              <Text style={s.desc} numberOfLines={5}>{item.description}</Text>
            ) : null}

            {!!directors && (
              <Text style={s.director}>
                <Text style={s.directorLabel}>Dirección: </Text>
                {directors}
              </Text>
            )}

            <View style={s.buttons}>
              <Focusable
                onPress={() => play(isSeries ? firstEpisode?.id : undefined)}
                style={s.btnPlay}
                focusedStyle={s.btnPlayFocused}
              >
                <Play size={scale(18)} color="#000" fill="#000" />
                <Text style={s.btnPlayTxt}>{isSeries ? "Reproducir T1 E1" : "Reproducir"}</Text>
              </Focusable>
              <Focusable
                onPress={() => setInMyList((v) => !v)}
                style={[s.btnIcon, inMyList && s.btnIconActive]}
                focusedStyle={s.btnIconFocused}
              >
                {inMyList ? (
                  <Check size={scale(20)} color={C.accent} />
                ) : (
                  <Plus size={scale(20)} color="#fff" />
                )}
              </Focusable>
            </View>
          </View>

          {/* Poster */}
          <View style={s.heroRight}>
            <RemoteImage uri={item.posterUrl || item.backdropUrl} style={s.poster as any} />
            <LinearGradient
              colors={["transparent", "rgba(8,8,8,0.4)"]}
              style={s.posterShad}
            />
          </View>
        </View>

        {/* CAST */}
        {cast.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionAccent, { backgroundColor: C.accent }]} />
              <Text style={s.sectionTitle}>Reparto</Text>
            </View>
            <FlatList
              data={cast}
              keyExtractor={(a, i) => String(a.id ?? i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.castList}
              initialNumToRender={6}
              windowSize={4}
              renderItem={({ item: actor }) => <CastItem actor={actor} />}
            />
          </View>
        )}

        {/* DETAILS TABLE */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.sectionAccent, { backgroundColor: C.accentOrange }]} />
            <Text style={s.sectionTitle}>
              {item.type === "SERIES" ? "Detalles de la serie" : "Detalles de la película"}
            </Text>
          </View>
          <View style={s.detTable}>
            <DetailRow label="Tipo" value={TYPE_LABEL[item.type] || item.type} />
            {!!year && <DetailRow label="Año de estreno" value={String(year)} />}
            {!!durationStr && <DetailRow label="Duración" value={durationStr} />}
            {isSeries && <DetailRow label="Temporadas" value={String(seasons.length)} />}
            {!!ageRating && <DetailRow label="Clasificación" value={ageRating} />}
            {!!(c.country || c.originCountry) && (
              <DetailRow label="País de origen" value={c.country || c.originCountry} />
            )}
            {!!(c.originalLanguage || item.language) && (
              <DetailRow
                label="Idioma original"
                value={(c.originalLanguage || item.language || "").toUpperCase()}
                last
              />
            )}
          </View>
        </View>

        {/* SEASONS + EPISODES */}
        {isSeries && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionAccent, { backgroundColor: C.accentFire }]} />
              <Text style={s.sectionTitle}>Episodios</Text>
            </View>
            {seasons.length > 1 && (
              <FlatList
                data={seasons}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(se, i) => String(se.id ?? i)}
                contentContainerStyle={s.seasonList}
                extraData={seasonIdx}
                renderItem={({ item: se, index }) => {
                  const on = index === seasonIdx;
                  return (
                    <Focusable
                      onPress={() => setSeasonIdx(index)}
                      onFocus={() => setSeasonIdx(index)}
                      style={[s.seasonChip, on && s.seasonChipOn]}
                      focusedStyle={s.seasonChipFocused}
                    >
                      <Text style={[s.seasonTxt, on && s.seasonTxtOn]}>
                        Temporada {se.number ?? index + 1}
                      </Text>
                    </Focusable>
                  );
                }}
              />
            )}
            <FlatList
              data={currentSeason?.episodes || []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(e: any, i) => String(e.id ?? i)}
              contentContainerStyle={s.epList}
              initialNumToRender={5}
              windowSize={4}
              renderItem={({ item: ep, index }: any) => (
                <EpCard ep={ep} index={index} item={item} onPlay={play} />
              )}
            />
          </View>
        )}

        {/* RELATED */}
        {related.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionAccent, { backgroundColor: "#8b5cf6" }]} />
              <Text style={s.sectionTitle}>Relacionados</Text>
            </View>
            <FlatList
              data={related}
              keyExtractor={(r: any) => String(r.id || r.slug)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.relList}
              initialNumToRender={6}
              windowSize={4}
              renderItem={({ item: r }: any) => <RelatedCard item={r} onPress={handleRelated} />}
            />
          </View>
        )}

        <View style={{ height: scale(60) }} />
      </ScrollView>
    </View>
  );
}

const EP_W = scale(240);
const REL_W = scale(130);
const REL_H = scale(190);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(16),
    backgroundColor: "#080808",
  },
  loadTxt: { color: C.textSecondary, fontSize: scale(14) },
  empty: { color: C.textMuted, fontSize: scale(16) },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { paddingBottom: scale(40), paddingLeft: scale(72) },

  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: scale(24),
    paddingRight: scale(48),
    paddingBottom: scale(16),
    minHeight: SH * 0.55,
  },
  heroLeft: { flex: 1, maxWidth: "58%", paddingRight: scale(32) },
  heroRight: { width: scale(220), alignItems: "center" },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    alignSelf: "flex-start",
    marginBottom: scale(18),
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: scale(14),
    height: scale(34),
    borderRadius: 99,
      },
  backBtnFocused: { backgroundColor: "rgba(255,255,255,0.2)" },
  backTxt: { color: "#fff", fontSize: scale(13), fontWeight: "700" },

  title: {
    fontSize: scale(38),
    fontWeight: "900",
    color: C.accent,
    lineHeight: scale(44),
    marginBottom: scale(6),
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
    marginBottom: scale(12),
    letterSpacing: 0.5,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: scale(8), marginBottom: scale(10) },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 99,
  },
  chipBorder: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  chipTxt: { color: "#fff", fontSize: scale(12), fontWeight: "700" },
  chipImdb: { backgroundColor: "#f5c518" },
  chipImdbTxt: { color: "#000", fontSize: scale(12), fontWeight: "900" },

  genres: { fontSize: scale(13), color: "rgba(255,255,255,0.6)", marginBottom: scale(10) },
  desc: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.82)",
    lineHeight: scale(20),
    marginBottom: scale(10),
  },
  director: { fontSize: scale(13), color: "rgba(255,255,255,0.75)", marginBottom: scale(16) },
  directorLabel: { color: "rgba(255,255,255,0.45)" },

  buttons: { flexDirection: "row", gap: scale(12), marginTop: scale(4) },
  btnPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: C.accent,
    paddingHorizontal: scale(26),
    height: scale(46),
    borderRadius: scale(12),
  },
  btnPlayFocused: { backgroundColor: "#fff", elevation: 8 },
  btnPlayTxt: { color: "#000", fontSize: scale(15), fontWeight: "900" },
  btnIcon: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(12),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  btnIconActive: { backgroundColor: "rgba(255,183,3,0.15)" },
  btnIconFocused: { backgroundColor: "rgba(255,255,255,0.2)" },

  btnBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: scale(20),
    height: scale(44),
    borderRadius: scale(10),
  },
  btnBackFocused: { backgroundColor: "#fff" },
  btnBackTxt: { color: "#fff", fontSize: scale(14), fontWeight: "800" },

  poster: {
    width: scale(220),
    height: scale(315),
    borderRadius: scale(18),
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  posterShad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(80),
    borderBottomLeftRadius: scale(18),
    borderBottomRightRadius: scale(18),
  },

  section: { marginBottom: scale(10) },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(12),
    marginTop: scale(6),
    paddingRight: scale(48),
  },
  sectionAccent: { width: scale(4), height: scale(20), borderRadius: scale(2), marginRight: scale(10) },
  sectionTitle: { fontSize: scale(18), fontWeight: "800", color: C.textPrimary },

  castList: { gap: scale(14), paddingRight: scale(48), paddingVertical: scale(4) },
  castCard: {
    width: scale(90),
    alignItems: "center",
    borderRadius: scale(12),
    padding: scale(6),
  },
  castCardFocused: { backgroundColor: "rgba(255,255,255,0.1)" },
  castAvatar: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: C.bgCard,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  castInfo: { marginTop: scale(6), alignItems: "center" },
  castName: { color: "#fff", fontSize: scale(11), fontWeight: "700", textAlign: "center" },
  castRole: { color: "rgba(255,255,255,0.5)", fontSize: scale(10), textAlign: "center", marginTop: scale(2) },

  detTable: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginRight: scale(48),
    maxWidth: scale(600),
  },
  detRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(18),
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  detLabel: { flex: 1, color: "rgba(255,255,255,0.5)", fontSize: scale(13), fontWeight: "600" },
  detValue: { color: "#fff", fontSize: scale(13), fontWeight: "700", maxWidth: "55%", textAlign: "right" },

  seasonList: { gap: scale(10), paddingVertical: scale(4), paddingRight: scale(48) },
  seasonChip: {
    height: scale(38),
    paddingHorizontal: scale(20),
    borderRadius: 99,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  seasonChipOn: { backgroundColor: "rgba(255,183,3,0.22)" },
  seasonChipFocused: { backgroundColor: "rgba(255,255,255,0.18)" },
  seasonTxt: { color: "#fff", fontSize: scale(13), fontWeight: "700" },
  seasonTxtOn: { color: C.accent },

  epList: { gap: scale(14), paddingVertical: scale(8), paddingRight: scale(48), marginTop: scale(10) },
  epCard: {
    width: EP_W,
    borderRadius: scale(14),
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3, borderLeftColor: "transparent",
  },
  epCardFocused: { borderLeftColor: C.accent, backgroundColor: "rgba(255,255,255,0.1)" },
  epThumbWrap: { position: "relative", width: "100%", height: EP_W * 0.56 },
  epThumb: { width: "100%", height: "100%", backgroundColor: "#15100a" },
  epPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  epDurBadge: {
    position: "absolute",
    bottom: scale(6),
    right: scale(6),
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  epDurText: { color: "#fff", fontSize: scale(10), fontWeight: "700" },
  epMeta: { padding: scale(10) },
  epNum: { color: C.accent, fontSize: scale(10), fontWeight: "800" },
  epTitle: { color: "#fff", fontSize: scale(13), fontWeight: "700", marginTop: scale(3) },
  epDesc: { color: "rgba(255,255,255,0.5)", fontSize: scale(11), marginTop: scale(4), lineHeight: scale(15) },

  relList: { gap: scale(12), paddingVertical: scale(4), paddingRight: scale(48) },
  relCard: {
    width: REL_W,
    height: REL_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.06)",
  },
  relCardFocused: { backgroundColor: "rgba(255,255,255,0.1)" },
  relPoster: { width: "100%", height: "100%" },
  relGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: REL_H * 0.5 },
  relInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: scale(8) },
  relTitle: { color: "#fff", fontSize: scale(11), fontWeight: "700" },
  relYear: { color: "rgba(255,255,255,0.6)", fontSize: scale(10), marginTop: scale(2) },
});
