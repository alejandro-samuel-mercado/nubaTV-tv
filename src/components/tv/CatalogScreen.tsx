import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getContentList, NexoContentItem } from "../../services/nexoplay";
import BackdropBackground from "./BackdropBackground";
import PosterCard from "./PosterCard";
import RemoteImage, { prefetchImages } from "./RemoteImage";

const CARD_W = scale(150);
const CARD_H = scale(220);
const SIDEBAR_OFFSET = scale(64);

const formatDuration = (mins?: number) => {
  if (!mins) return "";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const keyById = (i: NexoContentItem) => i.id;

const Hero = memo(function Hero({
  item,
  typeLabel,
}: {
  item: NexoContentItem;
  typeLabel: string;
}) {
  const meta = [
    typeLabel,
    item.genres?.[0]?.name,
    item.releaseYear,
    formatDuration(item.duration),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={s.heroContent} pointerEvents="none">
      <View style={s.heroLeft}>
        <Text style={s.heroTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={s.heroMeta}>{meta}</Text>
        <View style={s.badgeRow}>
          {item.contentRating ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.contentRating}</Text>
            </View>
          ) : null}
          {item.language ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.language.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        {item.description ? (
          <Text style={s.heroDesc} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <View style={s.heroRight}>
        <RemoteImage
          uri={item.posterUrl || item.backdropUrl}
          style={s.heroPoster as any}
          transition={300}
        />
      </View>
    </View>
  );
});

/**
 * Pantalla de catálogo (Películas / Series).
 * - Fondo y hero siguen al item enfocado (con debounce → sin lag).
 * - Cada card abre sus DETALLES.
 */
export default function CatalogScreen({
  type,
  typeLabel,
  sectionTitle,
}: {
  type: "MOVIE" | "SERIES";
  typeLabel: string;
  sectionTitle: string;
}) {
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const [items, setItems] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedItem, setFocusedItem] = useState<NexoContentItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    getContentList({ type, limit: 24, sort: "recent" })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        prefetchImages(data.slice(0, 10).map((d) => d.backdropUrl));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type]);

  const target = focusedItem ?? items[0] ?? null;
  const heroItem = useDebouncedValue(target, 250);

  const openDetail = useCallback(
    (item: NexoContentItem) =>
      router.push({ pathname: "/detail", params: { slug: item.slug } } as any),
    [router],
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <BackdropBackground uri={heroItem?.backdropUrl || heroItem?.posterUrl} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {heroItem ? <Hero item={heroItem} typeLabel={typeLabel} /> : null}

        <View style={s.sectionWrap}>
          <Text style={s.sectionTitle}>{sectionTitle}</Text>
          <FlatList
            data={items}
            keyExtractor={keyById}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.grid}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={5}
            renderItem={({ item, index }) => (
              <PosterCard
                item={item}
                width={CARD_W}
                height={CARD_H}
                onPressItem={openDetail}
                onFocusItem={setFocusedItem}
                nextFocusLeft={index === 0 ? sidebarHandle ?? undefined : undefined}
                hasTVPreferredFocus={index === 0}
              />
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080808",
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: scale(32) },

  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: SIDEBAR_OFFSET + scale(28),
    paddingRight: scale(28),
    paddingTop: scale(28),
    paddingBottom: scale(24),
    minHeight: scale(360),
  },
  heroLeft: { flex: 1, maxWidth: "58%" },
  heroRight: { width: scale(220), alignItems: "center" },
  heroPoster: {
    width: "100%",
    height: scale(250),
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: C.bgCard,
  },
  heroTitle: {
    fontSize: scale(28),
    fontWeight: "900",
    color: "#f7d94c",
    lineHeight: scale(32),
    marginBottom: scale(12),
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  heroMeta: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.82)",
    marginBottom: scale(12),
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: scale(8),
    marginBottom: scale(12),
  },
  badge: {
    backgroundColor: "rgba(31,31,31,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(5),
  },
  badgeText: { fontSize: scale(11), fontWeight: "800", color: "#fff" },
  heroDesc: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.75)",
    lineHeight: scale(18),
  },

  sectionWrap: { paddingTop: scale(8), paddingBottom: scale(24) },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: "800",
    color: C.textPrimary,
    marginLeft: SIDEBAR_OFFSET + scale(24),
    marginBottom: scale(12),
  },
  grid: {
    paddingLeft: SIDEBAR_OFFSET + scale(24),
    paddingRight: scale(24),
    paddingVertical: scale(8),
    gap: scale(12),
  },
});
