import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getContentList, NexoContentItem } from "../../services/nexoplay";

const CARD_W = scale(150);
const CARD_H = scale(220);
const SIDEBAR_OFFSET = scale(64);

export default function SeriesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NexoContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getContentList({ type: "SERIES", limit: 24, sort: "recent" })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const heroItem = items[0] || null;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Fondo fijo a pantalla completa */}
      {heroItem ? (
        <ImageBackground
          source={{ uri: heroItem.backdropUrl || heroItem.posterUrl || "" }}
          style={s.bg}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              "rgba(10,10,10,0.55)",
              "rgba(10,10,10,0.35)",
              "rgba(10,10,10,0.55)",
              "rgba(10,10,10,0.92)",
            ]}
            style={StyleSheet.absoluteFillObject}
          />
        </ImageBackground>
      ) : (
        <View style={[s.bg, { backgroundColor: "#080808" }]} />
      )}

      {/* Contenido sobre el fondo fijo */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {heroItem ? (
          <View style={s.heroContent}>
            <View style={s.heroLeft}>
              <Text style={s.heroTitle}>{heroItem.title}</Text>
              <Text style={s.heroMeta}>
                {heroItem.type === "SERIES" ? "Serie" : "Contenido"} •{" "}
                {heroItem.genres?.[0]?.name || "Drama"} •{" "}
                {heroItem.duration
                  ? `${Math.floor(heroItem.duration / 60)}h ${
                      heroItem.duration % 60
                    }m`
                  : "1h 48m"}
              </Text>

              <View style={s.badgeRow}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {heroItem.contentRating || "12"} | ESTRENADA
                  </Text>
                </View>
                <View style={[s.badge, s.badgeImdb]}>
                  <Text style={[s.badgeText, s.badgeImdbText]}>
                    IMDb {heroItem.rating?.toFixed(1) || "8.0"}
                  </Text>
                </View>
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {heroItem.language?.toUpperCase() || "ES"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.heroRight}>
              <Image
                source={{
                  uri: heroItem.posterUrl || heroItem.backdropUrl || "",
                }}
                style={s.heroPoster}
                resizeMode="cover"
              />
            </View>
          </View>
        ) : null}

        <View style={s.sectionWrap}>
          <Text style={s.sectionTitle}>Series recién agregadas</Text>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.grid}
            renderItem={({ item }) => (
              <Pressable
                focusable
                onPress={() =>
                  router.push({
                    pathname: "/player",
                    params: { slug: item.slug },
                  } as any)
                }
                style={({ focused }: any) => [s.card, focused && s.cardFocused]}
              >
                <Image
                  source={{ uri: item.posterUrl || item.backdropUrl || "" }}
                  style={s.img}
                  resizeMode="cover"
                />
                {item.rating ? (
                  <View style={s.rating}>
                    <Star size={scale(9)} color={C.accent} fill={C.accent} />
                    <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.75)"]}
                  style={s.grad}
                >
                  <Text style={s.name} numberOfLines={2}>
                    {item.title}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  bg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scale(32),
  },

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
  heroRight: {
    width: scale(220),
    alignItems: "center",
    justifyContent: "center",
  },
  heroPoster: {
    width: "100%",
    height: scale(250),
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
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
    marginBottom: scale(14),
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: scale(8),
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
  badgeImdb: { backgroundColor: "#f5c518" },
  badgeImdbText: { color: "#000" },

  sectionWrap: {
    paddingTop: scale(8),
    paddingBottom: scale(24),
  },
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
    gap: scale(12),
    paddingBottom: scale(10),
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardFocused: {
    borderWidth: 2,
    borderColor: C.accent,
    transform: [{ scale: 1.03 }],
  },
  img: { ...StyleSheet.absoluteFillObject },
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(8),
  },
  name: { fontSize: scale(10), fontWeight: "700", color: "#fff" },
  rating: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  ratingText: { fontSize: scale(9), fontWeight: "800", color: C.accent },
});
