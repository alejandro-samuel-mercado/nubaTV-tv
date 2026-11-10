import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  findNodeHandle,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const safeFindNodeHandle = (node: any): number | undefined => {
  if (Platform.OS === "web" || !node) return undefined;
  try {
    const handle = findNodeHandle(node);
    return typeof handle === "number" && handle > 0 ? handle : undefined;
  } catch {
    return undefined;
  }
};

// Pressable con props de foco de Android TV (nextFocus*, hasTVPreferredFocus).
const TVPressable = Pressable as any;
const AnimatedPressable = Animated.createAnimatedComponent(TVPressable);

export interface FocusableProps {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode | ((state: { focused: boolean }) => React.ReactNode);
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLayout?: (event: any) => void;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  nextFocusUp?: number;
  nextFocusDown?: number;
  /** Bloquear el foco a la derecha (no salta a otra fila al presionar derecha al final) */
  trapFocusRight?: boolean;
  /** Bloquear el foco a la izquierda (no salta fuera al presionar izquierda) */
  trapFocusLeft?: boolean;
  /** Bloquear el foco hacia arriba (no salta fuera al presionar arriba) */
  trapFocusUp?: boolean;
  /** Bloquear el foco hacia abajo (no salta fuera al presionar abajo) */
  trapFocusDown?: boolean;
  hitSlop?: any;
  /** Si debe animar la escala suavemente al enfocar (default: true) */
  animateScale?: boolean;
  /** Factor de escala cuando está enfocado (default: 1.05) */
  scaleValue?: number;
  /** Factor de escala alternativo para retrocompatibilidad */
  scaleFocused?: number;
  /** Mostrar anillo de foco visual en overlay (default: false si hay focusedStyle, true si no) */
  showFocusRing?: boolean;
  /** Color del anillo de foco (default: C.accent #ffb703) */
  focusRingColor?: string;
  /** Ancho del borde del anillo de foco (default: scale(3)) */
  focusBorderWidth?: number;
  /** Radio de curvatura del borde (default: auto-detectado del estilo o scale(12)) */
  borderRadius?: number;
  /**
   * Throttle/Debounce en ms para el callback onFocus (default: 70ms).
   * Al mover el control remoto muy rápido o mantener presionado el D-pad,
   * el feedback visual es instantáneo (0ms), pero los callbacks pesados
   * se estabilizan para no saturar el hilo JS ni desincronizar la navegación.
   */
  throttleMs?: number;
}

/**
 * Focusable — Componente universal de foco para Android TV / Control Remoto.
 *
 * Características:
 * 1. Indicador visual nítido y de alto contraste (borde y escala acelerados por GPU).
 * 2. Transición suave de escala acelerada por hardware (useNativeDriver).
 * 3. Bloqueo opcional de bordes (trapFocusRight) para evitar saltos indeseados entre filas.
 * 4. Control de velocidad de navegación / key-repeat para evitar saltos o pérdida de foco.
 */
const Focusable = React.forwardRef<any, FocusableProps>(function Focusable(
  {
    style,
    focusedStyle,
    children,
    onPress,
    onFocus,
    onBlur,
    disabled,
    animateScale = false,
    scaleValue = 1.02,
    scaleFocused,
    showFocusRing = false,
    focusRingColor,
    focusBorderWidth = scale(2.5),
    borderRadius,
    throttleMs = 70,
    trapFocusRight,
    trapFocusLeft,
    trapFocusUp,
    trapFocusDown,
    nextFocusRight,
    nextFocusLeft,
    nextFocusUp,
    nextFocusDown,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [selfNodeHandle, setSelfNodeHandle] = useState<number | undefined>(undefined);
  const innerRef = useRef<any>(null);

  React.useImperativeHandle(ref, () => innerRef.current);

  const isScaleEnabled = animateScale || scaleFocused !== undefined;
  const targetScale = scaleFocused ?? scaleValue;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const throttleTimer = useRef<any>(null);

  const hasAnyTrap = trapFocusRight || trapFocusLeft || trapFocusUp || trapFocusDown;

  const setInnerRef = useCallback(
    (node: any) => {
      innerRef.current = node;
      if (Platform.OS !== "web" && hasAnyTrap && node) {
        const handle = safeFindNodeHandle(node);
        if (typeof handle === "number" && handle > 0) {
          setSelfNodeHandle(handle);
        }
      }
    },
    [hasAnyTrap],
  );

  // Actualizar handle del nodo nativo para trampas de foco (solo plataformas nativas)
  const updateSelfHandle = useCallback(() => {
    if (Platform.OS === "web") return;
    if (hasAnyTrap && innerRef.current) {
      const handle = safeFindNodeHandle(innerRef.current);
      if (typeof handle === "number" && handle > 0) {
        setSelfNodeHandle((prev) => (prev !== handle ? handle : prev));
      }
    }
  }, [hasAnyTrap]);

  useEffect(() => {
    updateSelfHandle();
  }, [updateSelfHandle]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
        throttleTimer.current = null;
      }
    };
  }, []);

  const handleFocus = useCallback(() => {
    setFocused(true);

    if (hasAnyTrap && !selfNodeHandle) {
      updateSelfHandle();
    }

    // Cancelar animaciones previas para evitar acumulación al moverse rápido
    scaleAnim.stopAnimation();
    ringAnim.stopAnimation();

    // Animación suave y ágil de escala (60/120fps nativos)
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: isScaleEnabled ? targetScale : 1,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Estabilización de navegación rápida / D-pad presionado:
    // La respuesta visual es instantánea (0ms), pero los callbacks de efectos
    // secundarios pesados se ejecutan solo cuando el cursor se detiene.
    if (throttleMs > 0 && onFocus) {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      throttleTimer.current = setTimeout(() => {
        throttleTimer.current = null;
        onFocus();
      }, throttleMs);
    } else if (onFocus) {
      onFocus();
    }
  }, [animateScale, targetScale, throttleMs, onFocus, scaleAnim, ringAnim, trapFocusRight, selfNodeHandle, updateSelfHandle]);

  const handleBlur = useCallback(() => {
    setFocused(false);

    // Cancelar callback pendiente si el usuario pasó rápidamente de largo
    if (throttleTimer.current) {
      clearTimeout(throttleTimer.current);
      throttleTimer.current = null;
    }

    scaleAnim.stopAnimation();
    ringAnim.stopAnimation();

    // Regreso suave al estado base
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(ringAnim, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    onBlur?.();
  }, [onBlur, scaleAnim, ringAnim]);

  // Resolver estilos planos para extraer radio y color
  const flatStyle = StyleSheet.flatten(style) || {};
  const flatFocused = StyleSheet.flatten(focusedStyle) || {};

  const resolvedRadius: number =
    (typeof borderRadius === "number" ? borderRadius : undefined) ??
    (typeof flatFocused.borderRadius === "number" ? flatFocused.borderRadius : undefined) ??
    (typeof flatStyle.borderRadius === "number" ? flatStyle.borderRadius : undefined) ??
    scale(12);

  const resolvedBorderColor =
    focusRingColor ??
    flatFocused.borderColor ??
    C.accent;

  // Solo se muestra focusRing si se solicita explícitamente (default: false)
  // para evitar duplicar bordes o sobreponer cuadros molestos en elementos estilizados
  const shouldShowFocusRing = showFocusRing === true;

  // Combinar transforms existentes evitando duplicar scale
  const baseTransforms = Array.isArray(flatStyle.transform)
    ? flatStyle.transform.filter((t: any) => !isScaleEnabled || typeof t?.scale !== "number")
    : [];
  const focusedTransforms = (focused && Array.isArray(flatFocused.transform))
    ? flatFocused.transform.filter((t: any) => !isScaleEnabled || typeof t?.scale !== "number")
    : [];
  const combinedTransforms = [
    ...baseTransforms,
    ...focusedTransforms,
    ...(isScaleEnabled ? [{ scale: scaleAnim }] : []),
  ];

  const resolvedNextFocusRight =
    nextFocusRight ?? (trapFocusRight ? selfNodeHandle : undefined);
  const resolvedNextFocusLeft =
    nextFocusLeft ?? (trapFocusLeft ? selfNodeHandle : undefined);
  const resolvedNextFocusUp =
    nextFocusUp ?? (trapFocusUp ? selfNodeHandle : undefined);
  const resolvedNextFocusDown =
    nextFocusDown ?? (trapFocusDown ? selfNodeHandle : undefined);

  return (
    <AnimatedPressable
      ref={setInnerRef}
      focusable={!disabled}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      onLayout={(e: any) => {
        if (hasAnyTrap) updateSelfHandle();
        (rest as any).onLayout?.(e);
      }}
      nextFocusRight={resolvedNextFocusRight}
      nextFocusLeft={resolvedNextFocusLeft}
      nextFocusUp={resolvedNextFocusUp}
      nextFocusDown={resolvedNextFocusDown}
      style={[
        style,
        focused && focusedStyle,
        combinedTransforms.length > 0 && { transform: combinedTransforms },
        {
          zIndex: focused ? 50 : 1,
        },
      ]}
      {...rest}
    >
      {typeof children === "function" ? children({ focused }) : children}

      {/* Anillo de foco visual limpio (sin elevation de sombras opacas ni fondos de tinte encimado) */}
      {shouldShowFocusRing && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.focusRing,
            {
              borderRadius: resolvedRadius,
              borderColor: resolvedBorderColor,
              borderWidth: focusBorderWidth,
              opacity: ringAnim,
            },
          ]}
        />
      )}
    </AnimatedPressable>
  );
});

export default Focusable;

const s = StyleSheet.create({
  focusRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
});
