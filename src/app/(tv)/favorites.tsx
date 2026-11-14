import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useGlobal, Channel } from "../../contexts/GlobalContext";
import { useRouter } from "expo-router";
import { Heart, Film, Tv, Trash2 } from "lucide-react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import ChannelCard from "../../components/tv/ChannelCard";
import PosterCard from "../../components/tv/PosterCard";
import Focusable from "../../components/tv/Focusable";
import ScreenBackground from "../../components/tv/ScreenBackground";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { NexoContentItem } from "../../services/nexoplay";

const POSTER_W = scale(134);
const POSTER_H = scale(194);
const CHANNEL_W = scale(154);

type FilterTab = "all" | "vod" | "channels";

export default function FavoritesTvScreen() {
  const {
    favoriteChannelItems,
    toggleFavorite,
    activeChannel,
    setActiveChannel,
    vodFavorites,
    toggleVodFavorite,
  } = useGlobal();
  const router = useRouter();
  const sidebarHandle = useSidebarHandle();
  const [tab, setTab] = useState<FilterTab>("all");

  const totalCount = vodFavorites.length + favoriteChannelItems.length;

  const showVod = tab === "all" || tab === "vod";
  const showChannels = tab === "all" || tab === "channels";

  const handlePlayChannel = (ch: Channel) => {
    setActiveChannel(ch);
    router.push({
      pathname: "/player",
      params: { channelId: ch.id, channelUrl: ch.url },
    } as any);
  };

  const handleOpenVod = (item: NexoContentItem) => {
    router.push({
      pathname: "/detail",
      params: { slug: item.slug },
    } as any);
  };

  const isEmpty = useMemo(() => {
    if (tab === "vod") return vodFavorites.length === 0;
    if (tab === "channels") return favoriteChannelItems.length === 0;
    return totalCount === 0;
  }, [tab, vodFavorites.length, favoriteChannelItems.length, totalCount]);

  return (
    <View style={s.root}>
      <ScreenBackground />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <View style={s.titleRow}>
              <Heart size={scale(30)} color={C.live} fill={C.live} style={s.icon} />
              <Text style={s.title}>Mis Favoritos</Text>
            </View>
            <Text style={s.subtitle}>
              {totalCount}{" "}
              {totalCount === 1 ? "contenido guardado" : "contenidos guardados"} (
              {vodFavorites.length} títulos · {favoriteChannelItems.length} canales)
            </Text>
          </View>

          {/* Pestañas de filtro */}
          <View style={s.tabsRow}>
            <Focusable
              hasTVPreferredFocus={totalCount === 0}
              nextFocusLeft={sidebarHandle ?? undefined}
              onPress={() => setTab("all")}
              style={[s.tabBtn, tab === "all" && s.tabBtnActive]}
              focusedStyle={s.tabBtnFocused}
            >
              {({ focused }) => (
                <Text
                  style={[
                    s.tabTxt,
                    tab === "all" && s.tabTxtActive,
                    focused && s.tabTxtFocused,
                  ]}
                >
                  Todos ({totalCount})
                </Text>
              )}
            </Focusable>

            <Focusable
              onPress={() => setTab("vod")}
              style={[s.tabBtn, tab === "vod" && s.tabBtnActive]}
              focusedStyle={s.tabBtnFocused}
            >
              {({ focused }) => (
                <>
                  <Film
                    size={scale(13)}
                    color={focused ? "#000" : tab === "vod" ? "#000" : "#fff"}
                  />
                  <Text
                    style={[
                      s.tabTxt,
                      tab === "vod" && s.tabTxtActive,
                      focused && s.tabTxtFocused,
                    ]}
                  >
                    Películas y Series ({vodFavorites.length})
                  </Text>
                </>
              )}
            </Focusable>

            <Focusable
              trapFocusRight
              onPress={() => setTab("channels")}
              style={[s.tabBtn, tab === "channels" && s.tabBtnActive]}
              focusedStyle={s.tabBtnFocused}
            >
              {({ focused }) => (
                <>
                  <Tv
                    size={scale(13)}
                    color={focused ? "#000" : tab === "channels" ? "#000" : "#fff"}
                  />
                  <Text
                    style={[
                      s.tabTxt,
                      tab === "channels" && s.tabTxtActive,
                      focused && s.tabTxtFocused,
                    ]}
                  >
                    Canales TV ({favoriteChannelItems.length})
                  </Text>
                </>
              )}
            </Focusable>
          </View>
        </View>
      </View>

      {isEmpty ? (
        <View style={s.empty}>
          <Heart
            size={scale(60)}
            color={C.borderMedium}
            strokeWidth={1.2}
            style={{ marginBottom: scale(16) }}
          />
          <Text style={s.emptyText}>No tienes contenido favorito en esta sección.</Text>
          <Text style={s.emptySub}>
            Presiona el ícono de corazón en cualquier película, serie o canal en vivo para guardarlo aquí.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sección 1: Películas, Series y Anime */}
          {showVod && vodFavorites.length > 0 && (
            <View style={s.sectionBlock}>
              <View style={s.sectionHeader}>
                <Film size={scale(16)} color={C.accent} />
                <Text style={s.sectionTitle}>Películas, Series y Anime</Text>
                <Text style={s.sectionCount}>{vodFavorites.length}</Text>
              </View>

              <View style={s.gridWrap}>
                {vodFavorites.map((item, idx) => (
                  <View key={item.id || item.slug} style={s.vodCardWrap}>
                    <PosterCard
                      item={item}
                      width={POSTER_W}
                      height={POSTER_H}
                      hasTVPreferredFocus={idx === 0}
                      nextFocusLeft={idx % 6 === 0 ? sidebarHandle ?? undefined : undefined}
                      trapFocusRight={idx % 6 === 5 || idx === vodFavorites.length - 1}
                      onPressItem={handleOpenVod}
                    />
                    <Focusable
                      onPress={() => toggleVodFavorite(item)}
                      style={s.removePill}
                      focusedStyle={s.removePillFocused}
                    >
                      {({ focused }) => (
                        <>
                          <Trash2 size={scale(11)} color={focused ? "#000" : "#ff4d6d"} />
                          <Text style={[s.removePillTxt, focused && { color: "#000" }]}>
                            Quitar
                          </Text>
                        </>
                      )}
                    </Focusable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Sección 2: Canales de TV en Vivo */}
          {showChannels && favoriteChannelItems.length > 0 && (
            <View style={s.sectionBlock}>
              <View style={s.sectionHeader}>
                <Tv size={scale(16)} color="#00f59b" />
                <Text style={s.sectionTitle}>Canales de TV en Vivo</Text>
                <Text style={s.sectionCount}>{favoriteChannelItems.length}</Text>
              </View>

              <View style={s.gridWrap}>
                {favoriteChannelItems.map((ch, idx) => (
                  <View key={ch.id} style={s.channelCardWrap}>
                    <ChannelCard
                      channel={ch}
                      isActive={activeChannel?.id === ch.id}
                      isFav={true}
                      hasTVPreferredFocus={vodFavorites.length === 0 && idx === 0}
                      nextFocusLeft={idx % 5 === 0 ? sidebarHandle ?? undefined : undefined}
                      trapFocusRight={
                        idx % 5 === 4 || idx === favoriteChannelItems.length - 1
                      }
                      onPress={() => handlePlayChannel(ch)}
                      onToggleFav={() => toggleFavorite(ch)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080808",
    paddingLeft: scale(110),
    paddingRight: scale(40),
    paddingTop: scale(32),
  },
  header: {
    marginBottom: scale(22),
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: scale(16),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(4),
  },
  icon: {
    marginRight: scale(12),
  },
  title: {
    fontSize: scale(32),
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: scale(13.5),
    color: C.textSecondary,
    fontWeight: "600",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  tabBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  tabBtnFocused: {
    backgroundColor: "#ffffff",
    borderColor: C.accent,
  },
  tabTxt: {
    fontSize: scale(12),
    fontWeight: "800",
    color: "#ffffff",
  },
  tabTxtActive: {
    color: "#000000",
  },
  tabTxtFocused: {
    color: "#000000",
  },
  scrollContent: {
    paddingTop: scale(6),
    paddingHorizontal: scale(6),
    paddingBottom: scale(90),
    gap: scale(28),
  },
  sectionBlock: {
    gap: scale(14),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: "900",
    color: "#ffffff",
  },
  sectionCount: {
    fontSize: scale(12),
    fontWeight: "800",
    color: C.accent,
    backgroundColor: "rgba(255,183,3,0.15)",
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(16),
  },
  vodCardWrap: {
    width: POSTER_W,
    alignItems: "center",
    gap: scale(6),
  },
  removePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(4),
    width: "100%",
    paddingVertical: scale(4),
    borderRadius: scale(7),
    backgroundColor: "rgba(255,77,109,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,109,0.3)",
  },
  removePillFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#ff4d6d",
  },
  removePillTxt: {
    fontSize: scale(10.5),
    fontWeight: "800",
    color: "#ff4d6d",
  },
  channelCardWrap: {
    width: CHANNEL_W,
    height: scale(196),
  },
  empty: {
    paddingTop: scale(90),
    alignItems: "center",
  },
  emptyText: {
    fontSize: scale(19),
    color: C.textSecondary,
    fontWeight: "700",
    marginBottom: scale(6),
  },
  emptySub: {
    fontSize: scale(13),
    color: C.textMuted,
    textAlign: "center",
    maxWidth: scale(460),
  },
});
