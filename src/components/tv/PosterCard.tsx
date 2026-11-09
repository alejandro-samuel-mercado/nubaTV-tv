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
  nextFocusRight?: number;
  trapFocusRight?: boolean;
  hasTVPreferredFocus?: boolean;
}

function PosterCard({
  item,
  width,
  height,
  onPressItem,
  onFocusItem,
  nextFocusLeft,
  nextFocusRight,
  trapFocusRight,
  hasTVPreferredFocus,
}: Props) {
  return (
    <Focusable
      onPress={() => onPressItem(item)}
      onFocus={onFocusItem ? () => onFocusItem(item) : undefined}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      trapFocusRight={trapFocusRight}
      hasTVPreferredFocus={hasTVPreferredFocus}
      scaleFocused={1.02}
      style={[s.outer, { width, height }]}
      focusedStyle={s.outerFocused}
    >
      <View style={s.inner}>
        <RemoteImage
          uri={item.posterUrl || item.backdropUrl}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
        />
        {item.rating ? (
          <View style={s.rating}>
            <Star size={scale(9)} color={C.accent} fill={C.accent} />
            <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={s.grad}
          pointerEvents="none"
        >
          <Text style={s.name} numberOfLines={2}>
            {item.title}
          </Text>
        </LinearGradient>
      </View>
    </Focusable>
  );
}

export default memo(PosterCard);

const s = StyleSheet.create({
  outer: {
    borderRadius: scale(10),
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
  },
  outerFocused: {
    borderColor: "#ffffff",
    zIndex: 20,
  },
  inner: {
    flex: 1,
    borderRadius: scale(8),
    overflow: "hidden",
    backgroundColor: C.bgCard,
  },
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(7),
  },
  name: {
    fontSize: scale(10.5),
    fontWeight: "700",
    color: "#fff",
    lineHeight: scale(14),
  },
  rating: {
    position: "absolute",
    top: scale(5),
    right: scale(5),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: scale(5),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  ratingText: {
    fontSize: scale(9),
    fontWeight: "800",
    color: C.accent,
  },
});
