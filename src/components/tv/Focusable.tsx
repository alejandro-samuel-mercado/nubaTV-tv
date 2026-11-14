import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
  /** Si debe animar la escala suavemente al enfocar */
  animateScale?: boolean;
  /** Factor de escala cuando está enfocado (default: 1.02) */
  scaleValue?: number;
  /** Factor de escala alternativo para retrocompatibilidad */
  scaleFocused?: number;
  /** Mostrar anillo de foco visual en overlay (default: false) */
  showFocusRing?: boolean;
  /** Color del anillo de foco (default: C.accent #ffb703) */
  focusRingColor?: string;
  /** Ancho del borde del anillo de foco (default: scale(2.5)) */
  focusBorderWidth?: number;
  /** Radio de curvatura del borde (default: auto-detectado del estilo o scale(12)) */
  borderRadius?: number;
  /**
   * Throttle/Debounce en ms para el callback onFocus (default: 80ms).
   * Al mover el control remoto muy rápido o mantener presionado el D-pad,
   * el feedback visual es instantáneo (0ms), pero los callbacks pesados
   * se estabilizan para no saturar el hilo JS ni provocar cierres de la app.
   */
  throttleMs?: number;
}

/**
 * Focusable — Componente ultra-estable de foco para Android TV / Control Remoto.
 *
 * Características:
 * 1. Cero sobrecarga de animación nativa para evitar crashes en navegación rápida.
 * 2. Feedback visual instantáneo y de alto contraste (borde y escala directos por GPU).
 * 3. Trampas de foco seguras que no bloquean ni saturan el hilo de renderizado.
 * 4. Throttle robusto para callbacks en navegación continua con D-pad presionado.
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
    animateScale,
    scaleValue = 1.02,
    scaleFocused,
    showFocusRing = false,
    focusRingColor,
    focusBorderWidth = scale(2.5),
    borderRadius,
    throttleMs = 32,
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

  const isScaleEnabled = Boolean(animateScale || scaleFocused !== undefined);
  const targetScale = scaleFocused ?? scaleValue;

  const throttleTimer = useRef<any>(null);
  const hasAnyTrap = Boolean(trapFocusRight || trapFocusLeft || trapFocusUp || trapFocusDown);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
        throttleTimer.current = null;
      }
    };
  }, []);

  // Asegurar foco nativo/web cuando hasTVPreferredFocus pasa a true dinámicamente (ej. listas y modales)
  useEffect(() => {
    if ((rest as any).hasTVPreferredFocus && innerRef.current) {
      if (Platform.OS === "web") {
        innerRef.current.focus?.();
      } else {
        innerRef.current.setNativeProps?.({ hasTVPreferredFocus: true });
      }
    }
  }, [(rest as any).hasTVPreferredFocus]);

  const handleFocus = useCallback(() => {
    setFocused(true);

    // Throttle seguro para callbacks secundarios pesados:
    // La respuesta visual es instantánea (0ms), pero no saturamos el hilo JS
    if (throttleMs > 0 && onFocus) {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      throttleTimer.current = setTimeout(() => {
        throttleTimer.current = null;
        onFocus();
      }, throttleMs);
    } else if (onFocus) {
      onFocus();
    }
  }, [throttleMs, onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);

    if (throttleTimer.current) {
      clearTimeout(throttleTimer.current);
      throttleTimer.current = null;
    }

    onBlur?.();
  }, [onBlur]);

  const handleLayout = useCallback(
    (e: any) => {
      if (hasAnyTrap && innerRef.current && Platform.OS !== "web") {
        const handle = safeFindNodeHandle(innerRef.current);
        if (typeof handle === "number" && handle > 0) {
          setSelfNodeHandle((prev) => (prev !== handle ? handle : prev));
        }
      }
      (rest as any).onLayout?.(e);
    },
    [hasAnyTrap, (rest as any).onLayout],
  );

  // Aplicar escala directa cuando está enfocado sin invocar StyleSheet.flatten
  const scaleTransformStyle =
    isScaleEnabled && focused ? { transform: [{ scale: targetScale }] } : null;

  const resolvedNextFocusRight =
    nextFocusRight ?? (trapFocusRight ? selfNodeHandle : undefined);
  const resolvedNextFocusLeft =
    nextFocusLeft ?? (trapFocusLeft ? selfNodeHandle : undefined);
  const resolvedNextFocusUp =
    nextFocusUp ?? (trapFocusUp ? selfNodeHandle : undefined);
  const resolvedNextFocusDown =
    nextFocusDown ?? (trapFocusDown ? selfNodeHandle : undefined);

  return (
    <TVPressable
      ref={innerRef}
      focusable={!disabled}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      onLayout={handleLayout}
      nextFocusRight={resolvedNextFocusRight}
      nextFocusLeft={resolvedNextFocusLeft}
      nextFocusUp={resolvedNextFocusUp}
      nextFocusDown={resolvedNextFocusDown}
      style={[
        style,
        focused && focusedStyle,
        scaleTransformStyle,
        focused ? s.focusedZ : s.unfocusedZ,
      ]}
      {...rest}
    >
      {typeof children === "function" ? children({ focused }) : children}
    </TVPressable>
  );
});

const s = StyleSheet.create({
  focusedZ: { zIndex: 50 },
  unfocusedZ: { zIndex: 1 },
});

export default Focusable;
