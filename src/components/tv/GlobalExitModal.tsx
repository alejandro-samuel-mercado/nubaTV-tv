import { Check, LogOut, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import Focusable from "./Focusable";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const TVFocusGuide: any =
  (require("react-native") as any).TVFocusGuideView ?? View;

const MAIN_TV_PATHS = new Set([
  "/",
  "/channels",
  "/movies",
  "/series",
  "/anime",
  "/kids",
  "/premieres",
  "/favorites",
  "/settings",
  "/profile",
]);

const EXIT_TOAST_DURATION_MS = 2500;

export default function GlobalExitModal() {
  const pathname = usePathname();
  const router = useRouter();

  const [toastVisible, setToastVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [focusReady, setFocusReady] = useState(false);

  const toastVisibleRef = useRef(false);
  const modalVisibleRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearToastTimer();
    toastVisibleRef.current = false;
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setToastVisible(false);
    });
  }, [clearToastTimer, toastOpacity]);

  const showToast = useCallback(() => {
    clearToastTimer();
    toastVisibleRef.current = true;
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (Platform.OS === "android") {
      try {
        ToastAndroid.show(
          "Presiona atrás otra vez para salir",
          ToastAndroid.SHORT,
        );
      } catch {}
    }

    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, EXIT_TOAST_DURATION_MS);
  }, [clearToastTimer, hideToast, toastOpacity]);

  const openModal = useCallback(() => {
    hideToast();
    modalVisibleRef.current = true;
    setModalVisible(true);
    setFocusReady(false);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      setFocusReady(true);
    }, 60);
  }, [hideToast]);

  const closeModal = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    modalVisibleRef.current = false;
    setFocusReady(false);
    setModalVisible(false);
  }, []);

  const handleExitApp = useCallback(() => {
    closeModal();
    BackHandler.exitApp();
  }, [closeModal]);

  // Si cambia de ruta, limpiamos cualquier toast o modal pendiente
  useEffect(() => {
    if (toastVisibleRef.current) {
      hideToast();
    }
    if (modalVisibleRef.current) {
      closeModal();
    }
  }, [pathname, hideToast, closeModal]);

  useEffect(() => {
    return () => {
      clearToastTimer();
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [clearToastTimer]);

  useEffect(() => {
    const normalizedPath = pathname.replace("/(tv)", "") || "/";
    const isMainTvScreen = MAIN_TV_PATHS.has(normalizedPath);

    const onBackPress = () => {
      // 1. Si el modal de confirmación ya está abierto, Atrás lo cierra
      if (modalVisibleRef.current) {
        closeModal();
        return true;
      }

      // 2. Si estamos en una pantalla secundaria apilada (ej. detail, explore, player),
      // dejamos que su propio BackHandler o router.back() actúe normalmente.
      if (!isMainTvScreen) {
        if (router.canGoBack()) {
          return false;
        }
      }

      // 3. Si el aviso de "presiona otra vez" ya está activo -> abrir ventana de confirmación
      if (toastVisibleRef.current) {
        openModal();
        return true;
      }

      // 4. Primera pulsación de Atrás -> mostrar aviso de presionar otra vez
      showToast();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [pathname, router, closeModal, openModal, showToast]);

  if (!toastVisible && !modalVisible) {
    return null;
  }

  return (
    <>
      {/* Mensaje flotante en la primera pulsación de Atrás */}
      {toastVisible && !modalVisible && (
        <Animated.View
          pointerEvents="none"
          style={[s.toastWrapper, { opacity: toastOpacity }]}
        >
          <View style={s.toastPill}>
            <View style={s.toastDot} />
            <Text style={s.toastText}>
              Presiona atrás otra vez para salir
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Ventana de confirmación en la segunda pulsación de Atrás */}
      {modalVisible && (
        <View style={s.modalOverlay}>
          <Pressable
            focusable={false}
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
          />
          <TVFocusGuide destinations={[]} style={s.focusTrap}>
            <View style={s.modalContainer}>
              <View style={s.iconBadge}>
                <LogOut size={scale(28)} color="#F87171" />
              </View>

              <Text style={s.modalTitle}>¿Salir de NubaTV?</Text>
              <Text style={s.modalSubtitle}>
                ¿Estás seguro de que deseas cerrar la aplicación?
              </Text>

              <View style={s.modalActions}>
                <Focusable
                  hasTVPreferredFocus={focusReady}
                  trapFocusLeft
                  trapFocusUp
                  trapFocusDown
                  scaleFocused={1.04}
                  onPress={closeModal}
                  style={s.btnReject}
                  focusedStyle={s.btnRejectFocused}
                >
                  {({ focused }) => (
                    <View style={s.btnContent}>
                      <X
                        size={scale(16)}
                        color={focused ? C.accent : "#CBD5E1"}
                        strokeWidth={2.5}
                      />
                      <Text
                        style={[
                          s.btnRejectText,
                          focused && s.btnRejectTextFocused,
                        ]}
                      >
                        Rechazar
                      </Text>
                    </View>
                  )}
                </Focusable>

                <Focusable
                  trapFocusRight
                  trapFocusUp
                  trapFocusDown
                  scaleFocused={1.04}
                  onPress={handleExitApp}
                  style={s.btnAccept}
                  focusedStyle={s.btnAcceptFocused}
                >
                  {({ focused }) => (
                    <View style={s.btnContent}>
                      <Check
                        size={scale(16)}
                        color={focused ? "#FFFFFF" : "#F87171"}
                        strokeWidth={2.5}
                      />
                      <Text
                        style={[
                          s.btnAcceptText,
                          focused && s.btnAcceptTextFocused,
                        ]}
                      >
                        Aceptar
                      </Text>
                    </View>
                  )}
                </Focusable>
              </View>
            </View>
          </TVFocusGuide>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  // ── Toast de 1ra pulsación ──
  toastWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: scale(36),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9990,
  },
  toastPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: scale(999),
    backgroundColor: "rgba(10, 10, 14, 0.94)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.45)",
  },
  toastDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: C.accent,
  },
  toastText: {
    fontSize: scale(13),
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // ── Ventana Modal de Salida ──
  modalOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  focusTrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: scale(410),
    backgroundColor: "#0b0b10",
    paddingHorizontal: scale(30),
    paddingVertical: scale(28),
    borderRadius: scale(20),
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 183, 3, 0.22)",
  },
  iconBadge: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(29),
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(16),
  },
  modalTitle: {
    fontSize: scale(21),
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: scale(8),
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: scale(13),
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: scale(24),
    lineHeight: scale(19),
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(16),
    width: "100%",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
  },

  // Botón Rechazar (Cancelar salida)
  btnReject: {
    flex: 1,
    paddingVertical: scale(11),
    paddingHorizontal: scale(18),
    borderRadius: scale(11),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnRejectFocused: {
    backgroundColor: "rgba(255, 183, 3, 0.20)",
    borderColor: C.accent,
    borderWidth: 2.5,
  },
  btnRejectText: {
    fontSize: scale(13.5),
    fontWeight: "800",
    color: "#CBD5E1",
  },
  btnRejectTextFocused: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  // Botón Aceptar (Confirmar salida)
  btnAccept: {
    flex: 1,
    paddingVertical: scale(11),
    paddingHorizontal: scale(18),
    borderRadius: scale(11),
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnAcceptFocused: {
    backgroundColor: "rgba(239, 68, 68, 0.28)",
    borderColor: "#EF4444",
    borderWidth: 2.5,
  },
  btnAcceptText: {
    fontSize: scale(13.5),
    fontWeight: "800",
    color: "#FCA5A5",
  },
  btnAcceptTextFocused: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
