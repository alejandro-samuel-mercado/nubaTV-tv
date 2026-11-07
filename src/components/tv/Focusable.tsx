import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

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
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  nextFocusUp?: number;
  nextFocusDown?: number;
  hitSlop?: any;
  /** Si debe animar la escala suavemente al enfocar (default: true) */
  animateScale?: boolean;
  /** Factor de escala cuando está enfocado (default: 1.05) */
  scaleValue?: number;
  /** Factor de escala alternativo para retrocompatibilidad */
  scaleFocused?: number;
  /** Mostrar anillo de foco visual luminoso (default: true) */
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
 * 1. Indicador visual luminoso de alto contraste (anillo de foco ámbar/dorado + halo de luz).
 * 2. Transición suave de escala acelerada por hardware (useNativeDriver).
 * 3. Control de velocidad de navegación / key-repeat para evitar saltos o pérdida de foco.
 * 4. Elevación y zIndex dinámicos para evitar que elementos vecinos recorten el foco.
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
    animateScale = true,
    scaleValue = 1.05,
    scaleFocused,
    showFocusRing = true,
    focusRingColor,
    focusBorderWidth = scale(3),
    borderRadius,
    throttleMs = 70,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const targetScale = scaleFocused ?? scaleValue;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const throttleTimer = useRef<any>(null);

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

    // Cancelar animaciones previas para evitar acumulación al moverse rápido
    scaleAnim.stopAnimation();
    ringAnim.stopAnimation();

    // Animación suave y ágil de escala y anillo luminoso (60/120fps nativos)
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: animateScale ? targetScale : 1,
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
  }, [animateScale, targetScale, throttleMs, onFocus, scaleAnim, ringAnim]);

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

  // Combinar transforms existentes evitando duplicar scale
  const baseTransforms = Array.isArray(flatStyle.transform)
    ? flatStyle.transform.filter((t: any) => !animateScale || typeof t?.scale !== "number")
    : [];
  const focusedTransforms = (focused && Array.isArray(flatFocused.transform))
    ? flatFocused.transform.filter((t: any) => !animateScale || typeof t?.scale !== "number")
    : [];
  const combinedTransforms = [
    ...baseTransforms,
    ...focusedTransforms,
    ...(animateScale ? [{ scale: scaleAnim }] : []),
  ];

  return (
    <AnimatedPressable
      ref={ref}
      focusable={!disabled}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      style={[
        style,
        focused && focusedStyle,
        combinedTransforms.length > 0 && { transform: combinedTransforms },
        {
          zIndex: focused ? 50 : 1,
          elevation: focused ? 14 : 0,
        },
      ]}
      {...rest}
    >
      {typeof children === "function" ? children({ focused }) : children}

      {/* Anillo de foco visual premium: se dibuja en overlay para que overflow:hidden de imágenes no lo corte */}
      {showFocusRing && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.focusRing,
            {
              borderRadius: resolvedRadius,
              borderColor: resolvedBorderColor,
              borderWidth: focusBorderWidth,
              opacity: ringAnim,
              shadowColor: resolvedBorderColor,
            },
          ]}
        >
          {/* Sutil resplandor interno */}
          <Animated.View
            style={[
              s.focusInnerGlow,
              {
                borderRadius: Math.max(0, resolvedRadius - scale(2)),
                opacity: ringAnim,
              },
            ]}
          />
        </Animated.View>
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: scale(10),
    elevation: 14,
    zIndex: 99,
  },
  focusInnerGlow: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(255, 183, 3, 0.08)",
  },
});
