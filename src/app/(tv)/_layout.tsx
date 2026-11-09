import { Stack, usePathname, useRouter } from "expo-router";

import {
      Clapperboard,
      Compass,
      Film,
      Flame,
      Heart,
      Home,
      Settings,
      Smile,
      Tv,
} from "lucide-react-native";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import {
      ActivityIndicator,
      Animated,
      findNodeHandle,
      Platform,
      Pressable,
      StyleSheet,
      Text,
      View,
} from "react-native";

import { useGlobal } from "../../contexts/GlobalContext";
import { setGlobalSidebarNodeHandle } from "../../hooks/useNavThrottle";

import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const TVFocusGuide: any =
  (require("react-native") as any).TVFocusGuideView ?? View;
const TVPressable = Pressable as any;

// usePathname() devuelve la ruta sin el grupo "(tv)".
const routeToPath = (route: string) =>
  route.replace("/(tv)", "") || "/";

const SIDEBAR_W = scale(64);
const SIDEBAR_EXPANDED_W = scale(220);

const NAV_ITEMS = [
  { key: "home", label: "Inicio", icon: Home, route: "/(tv)" },
  {
    key: "channels",
    label: "Canales TV",
    icon: Tv,
    route: "/(tv)/channels",
  },
  {
    key: "movies",
    label: "Películas",
    icon: Film,
    route: "/(tv)/movies",
  },
  {
    key: "series",
    label: "Series",
    icon: Clapperboard,
    route: "/(tv)/series",
  },
  {
    key: "kids",
    label: "Kids",
    icon: Smile,
    route: "/(tv)/kids",
  },
  {
    key: "anime",
    label: "Anime",
    icon: Flame,
    route: "/(tv)/anime",
  },
  {
    key: "explore",
    label: "Explorar",
    icon: Compass,
    route: "/(tv)/explore",
  },
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

const SidebarButton = forwardRef<
  any,
  {
    item: (typeof NAV_ITEMS)[0];
    isActive: boolean;
    isExpanded: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
    onItemFocus?: (key: string) => void;
    onItemBlur?: (key: string) => void;
  }
>(function SidebarButton(
  {
    item,
    isActive,
    isExpanded,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
    onItemFocus,
    onItemBlur,
  },
  ref,
) {
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
    <TVPressable
      ref={ref}
      focusable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onFocus={handleFocus}
      onBlur={handleBlur}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      // replace: no apila pantallas y el botón Atrás no recorre el menú.
      onPress={() => {
        if (!isActive) router.replace(item.route as any);
      }}
      style={[
        s.navBtn,
        isExpanded && s.navBtnExpanded,
        isActive && !focused && s.navBtnActive,
        focused && s.navBtnFocused,
      ]}
    >
      <View
        style={[
          s.navBtnInner,
          isExpanded && s.navBtnInnerExpanded,
        ]}
      >
        {/* Contenedor fijo del ícono para evitar cambios de posición. */}
        <View style={s.iconBox}>
          <Icon
            size={scale(22)}
            color={
              focused
                ? "#000"
                : isActive
                  ? C.accent
                  : "rgba(255,255,255,0.85)"
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

      {/* Borde independiente del fondo y del contenido del botón. */}
      {(focused || isActive) && (
        <View
          pointerEvents="none"
          style={[
            s.selectionOutline,
            {
              borderColor: focused
                ? C.accent
                : C.accentBorder ??
                  "rgba(255,183,3,0.45)",
            },
          ]}
        />
      )}
    </TVPressable>
  );
});

export default function TVLayout() {
  const { loading } = useGlobal();
  const pathname = usePathname();
  const isPlayerScreen = pathname.includes("/player");

  const [focusedSidebarKey, setFocusedSidebarKey] =
    useState<string | null>(null);

  const sidebarWidth = useRef(
    new Animated.Value(SIDEBAR_W),
  ).current;

  const sidebarBg = useRef(new Animated.Value(0)).current;

  const navRefs = useRef<Record<string, any>>({});
  const [navHandles, setNavHandles] = useState<Record<string, number>>({});

  const isSidebarExpanded = focusedSidebarKey !== null;

  // Actualiza y registra los handles de los botones del sidebar para
  // atrapar la navegación dentro de la barra y vincular el foco desde el contenido
  const updateHandles = useCallback(() => {
    if (Platform.OS === "web") return;
    const handles: Record<string, number> = {};
    for (const item of NAV_ITEMS) {
      const node = navRefs.current[item.key];
      if (node) {
        try {
          const h = findNodeHandle(node);
          if (typeof h === "number" && h > 0) {
            handles[item.key] = h;
          }
        } catch {}
      }
    }
    setNavHandles(handles);

    const active = NAV_ITEMS.find((item) => {
      const path = routeToPath(item.route);
      return pathname === path || pathname === `${path}/`;
    });
    const targetKey = focusedSidebarKey ?? active?.key ?? NAV_ITEMS[0].key;
    const handle = handles[targetKey];
    if (handle) {
      setGlobalSidebarNodeHandle(handle);
    }
  }, [pathname, focusedSidebarKey]);

  useEffect(() => {
    updateHandles();
    const t = setTimeout(updateHandles, 80);
    return () => clearTimeout(t);
  }, [updateHandles, isSidebarExpanded]);

  const handleItemFocus = useCallback((key: string) => {
    setFocusedSidebarKey(key);
    const h = navHandles[key];
    if (h) setGlobalSidebarNodeHandle(h);
  }, [navHandles]);

  // Se conservan las animaciones de ancho y fondo.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarWidth, {
        toValue: isSidebarExpanded
          ? SIDEBAR_EXPANDED_W
          : SIDEBAR_W,
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

  // Barra lateral más oscura y un 10% menos traslúcida (rica, nítida y sólida)
  const bgColor = sidebarBg.interpolate({
    inputRange: [0, 1],
    outputRange: [
      "rgba(6, 6, 8, 0.65)",
      "rgba(6, 6, 8, 0.94)",
    ],
  });

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const getIsActive = (item: (typeof NAV_ITEMS)[0]) => {
    const path = routeToPath(item.route);
    return pathname === path || pathname === `${path}/`;
  };

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
          {/* Borde derecho sutil cuando la barra está expandida. */}
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

          <TVFocusGuide style={s.navList}>
            {NAV_ITEMS.map((item, i) => {
              const selfHandle = navHandles[item.key];
              const upHandle = i > 0 ? navHandles[NAV_ITEMS[i - 1].key] : selfHandle;
              const downHandle =
                i < NAV_ITEMS.length - 1 ? navHandles[NAV_ITEMS[i + 1].key] : selfHandle;

              return (
                <SidebarButton
                  key={item.key}
                  ref={(node: any) => {
                    navRefs.current[item.key] = node;
                  }}
                  item={item}
                  isActive={getIsActive(item)}
                  isExpanded={isSidebarExpanded}
                  nextFocusUp={upHandle ?? selfHandle}
                  nextFocusDown={downHandle ?? selfHandle}
                  nextFocusLeft={selfHandle}
                  onItemFocus={handleItemFocus}
                  onItemBlur={(key) =>
                    setFocusedSidebarKey((current) =>
                      current === key ? null : current,
                    )
                  }
                />
              );
            })}
          </TVFocusGuide>
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
    ...(StyleSheet.absoluteFill as any),
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
    // Se conserva el comportamiento original del contenedor.
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

    // El borde ya no lo dibuja el propio botón.
    borderWidth: 0,
    borderColor: "transparent",

    backgroundColor: "transparent",
    justifyContent: "center",
    position: "relative",
  },

  navBtnExpanded: {
    // Se conserva el estilo original.
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

  // Caja fija del ícono.
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
  },

  navBtnFocused: {
    backgroundColor: C.accent,
  },

  // El contorno se dibuja por separado, por encima del botón.
  selectionOutline: {
    ...(StyleSheet.absoluteFill as any),
    borderWidth: 1,
    borderRadius: scale(12),
  },
});