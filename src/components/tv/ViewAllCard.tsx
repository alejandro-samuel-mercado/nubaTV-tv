import React, { memo } from "react";
import { StyleSheet, Text, View, StyleProp, ViewStyle } from "react-native";
import { ArrowRight, Compass } from "lucide-react-native";
import Focusable from "./Focusable";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

interface Props {
  width: number;
  height: number;
  onPress: () => void;
  label?: string;
  sublabel?: string;
  accentColor?: string;
  borderRadius?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  trapFocusRight?: boolean;
  style?: StyleProp<ViewStyle>;
}

function ViewAllCard({
  width,
  height,
  onPress,
  label = "Ver todo",
  sublabel = "Explorar catálogo",
  accentColor = C.accent,
  borderRadius = scale(12),
  nextFocusLeft,
  nextFocusRight,
  trapFocusRight = true,
  style,
}: Props) {
  return (
    <Focusable
      onPress={onPress}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      trapFocusRight={trapFocusRight}
      borderRadius={borderRadius}
      focusRingColor={accentColor}
      scaleValue={1.05}
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
          {/* Círculo central con ícono y resplandor */}
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: focused ? `${accentColor}30` : `${accentColor}15`,
                borderColor: focused ? accentColor : `${accentColor}40`,
              },
            ]}
          >
            {focused ? (
              <ArrowRight size={scale(18)} color={accentColor} strokeWidth={2.4} />
            ) : (
              <Compass size={scale(18)} color={accentColor} strokeWidth={2} />
            )}
          </View>

          {/* Textos */}
          <Text style={[s.label, focused && { color: accentColor }]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>

          {sublabel ? (
            <Text style={s.sublabel} numberOfLines={2}>
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
    overflow: "hidden",
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
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(8),
  },
  label: {
    fontSize: scale(11.5),
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  sublabel: {
    fontSize: scale(9.5),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    textAlign: "center",
    marginTop: scale(3),
    maxWidth: "90%",
  },
});
