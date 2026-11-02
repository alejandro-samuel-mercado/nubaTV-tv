import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { NexoContentItem } from "../../services/nexoplay";
import Focusable from "./Focusable";
import RemoteImage from "./RemoteImage";

interface Props {
  item: NexoContentItem;
  width: number;
  height: number;
  onPressItem: (item: NexoContentItem) => void;
  onFocusItem?: (item: NexoContentItem) => void;
  nextFocusLeft?: number;
  hasTVPreferredFocus?: boolean;
}

function PosterCard({ item, width, height, onPressItem, onFocusItem, nextFocusLeft, hasTVPreferredFocus }: Props) {
  return (
    /**
     * Two-layer approach to fix TV focus border clipping:
     *   Outer Focusable  → holds borderColor (overflow: visible)
     *   Inner View       → clips image to borderRadius (overflow: hidden)
     * This prevents the focus border from being cut off by overflow:hidden.
     */
    <Focusable
      onPress={() => onPressItem(item)}
      onFocus={onFocusItem ? () => onFocusItem(item) : undefined}
      nextFocusLeft={nextFocusLeft}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[s.outer, { width, height }]}
      focusedStyle={s.outerFocused}
    >
      <View style={s.inner}>
        <RemoteImage uri={item.posterUrl || item.backdropUrl} style={StyleSheet.absoluteFill as any} />
        {item.rating ? (
          <View style={s.rating}>
            <Star size={scale(9)} color={C.accent} fill={C.accent} />
            <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={s.grad} pointerEvents="none">
          <Text style={s.name} numberOfLines={2}>{item.title}</Text>
        </LinearGradient>
      </View>
    </Focusable>
  );
}

export default memo(PosterCard);

const s = StyleSheet.create({
  /* Outer: visible overflow — focus border never clipped */
  outer: {
    borderRadius: scale(12),
    backgroundColor: C.bgCard,
  },
  outerFocused: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  /* Inner: overflow:hidden clips image to card radius */
  inner: {
    flex: 1,
    borderRadius: scale(11),
    overflow: "hidden",
    backgroundColor: C.bgCard,
  },
  grad: { position: "absolute", bottom: 0, left: 0, right: 0, padding: scale(8) },
  name: { fontSize: scale(11), fontWeight: "700", color: "#fff" },
  rating: {
    position: "absolute", top: scale(6), right: scale(6),
    flexDirection: "row", alignItems: "center", gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: scale(5), paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  ratingText: { fontSize: scale(9), fontWeight: "800", color: C.accent },
});
