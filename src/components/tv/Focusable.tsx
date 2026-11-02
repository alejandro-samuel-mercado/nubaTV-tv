import React, { useCallback, useState } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";

// Pressable con props de foco de Android TV (nextFocus*, hasTVPreferredFocus).
const TVPressable = Pressable as any;

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
  hitSlop?: number;
}

/**
 * Focusable — wrapper único de foco para control remoto.
 * Mantiene el estado `focused` de forma explícita (funciona en cualquier build
 * de RN TV) y expone nextFocus* / hasTVPreferredFocus.
 */
const Focusable = React.forwardRef<any, FocusableProps>(function Focusable(
  { style, focusedStyle, children, onFocus, onBlur, disabled, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  return (
    <TVPressable
      ref={ref}
      focusable={!disabled}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[style, focused && focusedStyle]}
      {...rest}
    >
      {typeof children === "function" ? children({ focused }) : children}
    </TVPressable>
  );
});

export default Focusable;
