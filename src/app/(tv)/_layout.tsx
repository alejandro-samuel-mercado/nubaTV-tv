import { Stack, usePathname, useRouter } from "expo-router";
import {
  Clapperboard,
  Compass,
  Film,
  Heart,
  Home,
  Settings,
  Tv,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const SIDEBAR_W = scale(64);
const SIDEBAR_EXPANDED_W = scale(220);

const NAV_ITEMS = [
  { key: "home", label: "Inicio", icon: Home, route: "/(tv)" },
  { key: "channels", label: "Canales TV", icon: Tv, route: "/(tv)/channels" },
  { key: "movies", label: "Películas", icon: Film, route: "/(tv)/movies" },
  { key: "series", label: "Series", icon: Clapperboard, route: "/(tv)/series" },
  { key: "explore", label: "Explorar", icon: Compass, route: "/(tv)/explore" },
  {
    key: "favorites",
    label: "Favoritos",
    icon: Heart,
    route: "/(tv)/favorites",
  },
  {
    key: "settings",
    label: "Ajustes",
    icon: Settings,
    route: "/(tv)/settings",
  },
];

function SidebarButton({
  item,
  isActive,
  isExpanded,
  onItemFocus,
  onItemBlur,
}: {
  item: (typeof NAV_ITEMS)[0];
  isActive: boolean;
  isExpanded: boolean;
  onItemFocus?: (key: string) => void;
  onItemBlur?: (key: string) => void;
}) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const Icon = item.icon;

  const handleFocus = () => {
    setFocused(true);
    onItemFocus?.(item.key);
  };

  const handleBlur = () => {
    setFocused(false);
    onItemBlur?.(item.key);
  };

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={() => router.push(item.route as any)}
      style={[
        s.navBtn,
        isExpanded && s.navBtnExpanded,
        isActive && !focused && s.navBtnActive,
        focused && s.navBtnFocused,
      ]}
    >
      <View style={[s.navBtnInner, isExpanded && s.navBtnInnerExpanded]}>
        {/* Contenedor fijo del ícono → evita blur por re-layout */}
        <View style={s.iconBox}>
          <Icon
            size={scale(22)}
            color={
              focused ? "#000" : isActive ? C.accent : "rgba(255,255,255,0.85)"
            }
            strokeWidth={focused || isActive ? 2.4 : 2}
          />
        </View>

        {isExpanded && (
          <Text
            numberOfLines={1}
            style={[
              s.navLabel,
              isActive && !focused && s.navLabelActive,
              focused && s.navLabelFocused,
            ]}
          >
            {item.label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function TVLayout() {
  const { loading } = useGlobal();
  const pathname = usePathname();
  const isPlayerScreen = pathname.includes("/player");
  const [focusedSidebarKey, setFocusedSidebarKey] = useState<string | null>(
    null,
  );
  const sidebarWidth = useRef(new Animated.Value(SIDEBAR_W)).current;
  const sidebarBg = useRef(new Animated.Value(0)).current;

  const isSidebarExpanded = focusedSidebarKey !== null;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarWidth, {
        toValue: isSidebarExpanded ? SIDEBAR_EXPANDED_W : SIDEBAR_W,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(sidebarBg, {
        toValue: isSidebarExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isSidebarExpanded, sidebarWidth, sidebarBg]);

  const bgColor = sidebarBg.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(8, 8, 8, 0.03)", "rgba(8, 8, 8, 0.84)"],
  });

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const getIsActive = (item: (typeof NAV_ITEMS)[0]) =>
    pathname === item.route || pathname === `${item.route}/`;

  return (
    <View style={s.root}>
      <View style={s.stackLayer}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
            animation: "none",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="channels" />
          <Stack.Screen name="movies" />
          <Stack.Screen name="series" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
        </Stack>
      </View>

      {!isPlayerScreen && (
        <Animated.View
          style={[
            s.sidebar,
            {
              width: sidebarWidth,
              backgroundColor: bgColor,
            },
          ]}
        >
          {/* Borde derecho sutil cuando está expandida */}
          <Animated.View
            style={[
              s.sidebarBorder,
              {
                opacity: sidebarBg,
              },
            ]}
          />

          <View style={s.brandArea}>
            <Text style={s.brandLetter}>N</Text>
          </View>

          <View style={s.navList}>
            {NAV_ITEMS.map((item) => (
              <SidebarButton
                key={item.key}
                item={item}
                isActive={getIsActive(item)}
                isExpanded={isSidebarExpanded}
                onItemFocus={(key) => setFocusedSidebarKey(key)}
                onItemBlur={(key) =>
                  setFocusedSidebarKey((current) =>
                    current === key ? null : current,
                  )
                }
              />
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    backgroundColor: "#080808",
  },
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#080808",
  },
  stackLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: "transparent",
  },

  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    elevation: 20,
    alignItems: "stretch",
    paddingTop: scale(48),
    paddingBottom: scale(24),
    // sin overflow hidden → evita recortes raros del ícono
  },
  sidebarBorder: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  brandArea: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: scale(20),
  },
  brandLetter: {
    fontSize: scale(20),
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.5,
  },

  navList: {
    flex: 1,
    justifyContent: "center",
    gap: scale(6),
    paddingHorizontal: scale(10),
  },

  navBtn: {
    height: scale(48),
    borderRadius: scale(12),
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  navBtnExpanded: {
    // solo cambia alineación del contenido interno
  },
  navBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  navBtnInnerExpanded: {
    justifyContent: "flex-start",
    paddingLeft: scale(4),
  },

  // Caja fija del ícono → tamaño estable, sin blur
  iconBox: {
    width: scale(44),
    height: scale(44),
    alignItems: "center",
    justifyContent: "center",
  },

  navLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: scale(14),
    fontWeight: "700",
    marginLeft: scale(4),
    flexShrink: 1,
  },
  navLabelActive: {
    color: C.accent,
  },
  navLabelFocused: {
    color: "#000",
  },

  navBtnActive: {
    backgroundColor: "rgba(255,183,3,0.18)",
    borderColor: C.accentBorder ?? "rgba(255,183,3,0.45)",
  },
  navBtnFocused: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
});
