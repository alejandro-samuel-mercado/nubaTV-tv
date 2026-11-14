import React, { memo } from "react";
import { StyleSheet, Text, View, StyleProp, ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Focusable from "./Focusable";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

interface Props {
  width: number;
  height: number;
  onPress: () => void;
  onFocus?: () => void;
  label?: string;
  sublabel?: string;
  accentColor?: string;
  borderRadius?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  nextFocusUp?: number;
  nextFocusDown?: number;
  trapFocusRight?: boolean;
  trapFocusDown?: boolean;
  style?: StyleProp<ViewStyle>;
}

function ViewAllCard({
  width,
  height,
  onPress,
  onFocus,
  label = "Ver todo",
  sublabel,
  accentColor = C.accent,
  borderRadius = scale(12),
  nextFocusLeft,
  nextFocusRight,
  nextFocusUp,
  nextFocusDown,
  trapFocusRight = true,
  trapFocusDown,
  style,
}: Props) {
  return (
    <Focusable
      onPress={onPress}
      onFocus={onFocus}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      trapFocusRight={trapFocusRight}
      trapFocusDown={trapFocusDown}
      borderRadius={borderRadius}
      focusRingColor={accentColor}
      scaleValue={1.02}
      style={[
        s.root,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
      focusedStyle={s.rootFocused}
    >
      {({ focused }) => (
        <View style={s.inner}>
          {/* Círculo central con símbolo '>' */}
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: focused ? accentColor : `${accentColor}20`,
                borderColor: focused ? "#ffffff" : `${accentColor}50`,
              },
            ]}
          >
            <ChevronRight
              size={scale(22)}
              color={focused ? "#000000" : accentColor}
              strokeWidth={3}
              style={{ marginLeft: scale(1.5) }}
            />
          </View>

          {/* Texto limpio 'Ver todo' sin texto redundante */}
          <Text
            style={[
              s.label,
              { color: focused ? "#ffffff" : "rgba(255, 255, 255, 0.85)" },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>

          {sublabel ? (
            <Text style={s.sublabel} numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      )}
    </Focusable>
  );
}

export default memo(ViewAllCard);

const s = StyleSheet.create({
  root: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rootFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
    padding: scale(10),
    width: "100%",
  },
  iconCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(8),
  },
  label: {
    fontSize: scale(12),
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  sublabel: {
    fontSize: scale(10),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    marginTop: scale(3),
    maxWidth: "90%",
  },
});
