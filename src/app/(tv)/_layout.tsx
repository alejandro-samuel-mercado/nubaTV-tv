import { Stack, usePathname, useRouter } from "expo-router";

import {
      Clapperboard,
      Film,
      Flame,
      Heart,
      Home,
      Settings,
      Smile,
      Sparkles,
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

import { useFonts, Bangers_400Regular } from "@expo-google-fonts/bangers";
import { useGlobal } from "../../contexts/GlobalContext";
import {
  setGlobalSidebarNodeHandle,
  usePreferredContentHandle,
} from "../../hooks/useNavThrottle";
import { preloadRouteData, startBackgroundPreload } from "../../services/nexoplay";
import GlobalExitModal from "../../components/tv/GlobalExitModal";

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
    key: "anime",
    label: "Anime",
    icon: Flame,
    route: "/(tv)/anime",
  },
  {
    key: "kids",
    label: "Kids",
    icon: Smile,
    route: "/(tv)/kids",
  },
  {
    key: "premieres",
    label: "Estrenos",
    icon: Sparkles,
    route: "/(tv)/premieres",
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
    focused: boolean;
    focusable?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
    onItemFocus?: (key: string) => void;
    onItemBlur?: (key: string) => void;
    onItemPress?: (item: (typeof NAV_ITEMS)[0], isActive: boolean) => void;
  }
>(function SidebarButton(
  {
    item,
    isActive,
    isExpanded,
    focused,
    focusable = true,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
    onItemFocus,
    onItemBlur,
    onItemPress,
  },
  ref,
) {
  const Icon = item.icon;

  const handleFocus = () => {
    onItemFocus?.(item.key);
  };

  const handleBlur = () => {
    onItemBlur?.(item.key);
  };

  return (
    <TVPressable
      ref={ref}
      focusable={focusable}
      accessible={focusable}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onFocus={handleFocus}
      onBlur={handleBlur}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      onPress={() => {
        onItemPress?.(item, isActive);
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
            size={scale(20)}
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
  const router = useRouter();
  const pathname = usePathname();
  const isPlayerScreen = pathname.includes("/player");
  const preferredContentHandle = usePreferredContentHandle();

  // Cargar la fuente Bangers una sola vez a nivel de layout global para que
  // las páginas (movies, series, anime, kids, premieres) no bloqueen su primer render
  useFonts({
    Bangers: Bangers_400Regular,
  });

  const [focusedSidebarKey, setFocusedSidebarKey] =
    useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const stackRef = useRef<any>(null);
  const suppressExpandRef = useRef(false);
  const isDismissingRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sidebarWidth = useRef(
    new Animated.Value(SIDEBAR_W),
  ).current;

  const sidebarBg = useRef(new Animated.Value(0)).current;

  const navRefs = useRef<Record<string, any>>({});
  const navHandlesRef = useRef<Record<string, number>>({});
  const [navHandles, setNavHandles] = useState<Record<string, number>>({});

  const isSidebarExpanded = focusedSidebarKey !== null;

  useEffect(() => {
    startBackgroundPreload();
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      if (dismissStartTimerRef.current) clearTimeout(dismissStartTimerRef.current);
      if (dismissEndTimerRef.current) clearTimeout(dismissEndTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  // Sincronizar handles de los botones del sidebar una sola vez tras montar
  const syncSidebarHandles = useCallback(() => {
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
    navHandlesRef.current = handles;
    setNavHandles((prev) => {
      const keys = Object.keys(handles);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((k) => prev[k] === handles[k])
      ) {
        return prev;
      }
      return handles;
    });
  }, []);

  useEffect(() => {
    syncSidebarHandles();
    const t = setTimeout(syncSidebarHandles, 60);
    return () => clearTimeout(t);
  }, [syncSidebarHandles]);

  // Al cambiar de ruta, apuntar el handle global al botón activo sin recalcular findNodeHandle
  useEffect(() => {
    if (Platform.OS === "web") return;
    const active = NAV_ITEMS.find((item) => {
      const path = routeToPath(item.route);
      return pathname === path || pathname === `${path}/`;
    });
    const targetKey = active?.key ?? NAV_ITEMS[0].key;
    const handle = navHandlesRef.current[targetKey];
    if (handle) {
      setGlobalSidebarNodeHandle(handle);
    } else {
      syncSidebarHandles();
      const retryHandle = navHandlesRef.current[targetKey];
      if (retryHandle) setGlobalSidebarNodeHandle(retryHandle);
    }
  }, [pathname, syncSidebarHandles]);

  const handleItemFocus = useCallback((key: string) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    preloadRouteData(key);
    if (suppressExpandRef.current || isDismissingRef.current) return;
    setFocusedSidebarKey((prev) => (prev === key ? prev : key));
  }, []);

  const handleItemBlur = useCallback((key: string) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      setFocusedSidebarKey((current) => (current === key ? null : current));
    }, 30);
  }, []);

  // Al presionar un ítem: cierra la barra lateral al instante (0ms), navega y
  // devuelve el foco nativo al contenido de la pantalla sin bloquear la animación.
  const handleItemPress = useCallback(
    (item: (typeof NAV_ITEMS)[0], active: boolean) => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      if (dismissStartTimerRef.current) clearTimeout(dismissStartTimerRef.current);
      if (dismissEndTimerRef.current) clearTimeout(dismissEndTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);

      preloadRouteData(item.key);
      suppressExpandRef.current = true;
      setFocusedSidebarKey(null);

      // Colapsar la barra lateral de inmediato antes de iniciar el montaje de la nueva página
      sidebarWidth.stopAnimation();
      sidebarWidth.setValue(SIDEBAR_W);
      sidebarBg.stopAnimation();
      sidebarBg.setValue(0);

      if (Platform.OS === "web") {
        if (!active) {
          router.replace(item.route as any);
        }
        (navRefs.current[item.key] as any)?.blur?.();
        const focusContentWeb = () => {
          const target = stackRef.current?.querySelector?.(
            'button, [tabindex="0"], a[href], input, [role="button"]',
          );
          target?.focus?.();
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(focusContentWeb);
        }
        dismissEndTimerRef.current = setTimeout(focusContentWeb, 60);
        suppressTimerRef.current = setTimeout(() => {
          suppressExpandRef.current = false;
        }, 180);
        return;
      }

      // En Android TV deshabilitar momentáneamente accessible/focusable limpia
      // el foco nativo del botón lateral y permite que pase al contenido al instante.
      isDismissingRef.current = true;
      setIsDismissing(true);

      if (!active) {
        router.replace(item.route as any);
      }

      dismissEndTimerRef.current = setTimeout(() => {
        isDismissingRef.current = false;
        setIsDismissing(false);
      }, 90);

      suppressTimerRef.current = setTimeout(
        () => {
          suppressExpandRef.current = false;
        },
        active ? 120 : 160,
      );
    },
    [router, sidebarWidth, sidebarBg],
  );

  // Animación rápida al abrir y cerrar por desenfoque lateral
  useEffect(() => {
    const duration = isSidebarExpanded ? 130 : 95;
    Animated.parallel([
      Animated.timing(sidebarWidth, {
        toValue: isSidebarExpanded
          ? SIDEBAR_EXPANDED_W
          : SIDEBAR_W,
        duration,
        useNativeDriver: false,
      }),
      Animated.timing(sidebarBg, {
        toValue: isSidebarExpanded ? 1 : 0,
        duration,
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
      <View ref={stackRef} style={s.stackLayer}>
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
          <Stack.Screen name="kids" />
          <Stack.Screen name="anime" />
          <Stack.Screen name="premieres" />
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
                  focused={focusedSidebarKey === item.key}
                  focusable={!isDismissing}
                  nextFocusUp={upHandle ?? selfHandle}
                  nextFocusDown={downHandle ?? selfHandle}
                  nextFocusLeft={selfHandle}
                  nextFocusRight={preferredContentHandle ?? undefined}
                  onItemFocus={handleItemFocus}
                  onItemPress={handleItemPress}
                  onItemBlur={handleItemBlur}
                />
              );
            })}
          </TVFocusGuide>
        </Animated.View>
      )}

      {/* Aviso de 1ra pulsación y ventana de confirmación para salir de la app */}
      <GlobalExitModal />
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
    paddingTop: scale(18),
    paddingBottom: scale(16),
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
    width: scale(38),
    height: scale(38),
    borderRadius: scale(10),
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: scale(14),
  },

  brandLetter: {
    fontSize: scale(19),
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.5,
  },

  navList: {
    flex: 1,
    justifyContent: "center",
    gap: scale(4),
    paddingHorizontal: scale(10),
  },

  navBtn: {
    height: scale(40),
    borderRadius: scale(10),

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
    width: scale(40),
    height: scale(40),
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
    borderRadius: scale(10),
  },
});