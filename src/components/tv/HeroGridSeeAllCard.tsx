import React, { memo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import Focusable from "./Focusable";
import { scale } from "../../lib/scale";

interface Props {
  onPress: () => void;
  onFocus?: () => void;
  accentColor?: string;
  title?: string;
  subtitle?: string; // Compatibilidad retroactiva: se ignora para no saturar con texto
  buttonLabel?: string; // Compatibilidad retroactiva: se ignora para no saturar con texto
  icon?: any;
  trapFocusRight?: boolean;
  style?: StyleProp<ViewStyle>;
}

function HeroGridSeeAllCard({
  onPress,
  onFocus,
  accentColor = "#ffb703",
  title = "Ver todo",
  trapFocusRight = true,
  style,
}: Props) {
  return (
    <Focusable
      onPress={onPress}
      onFocus={onFocus}
      trapFocusRight={trapFocusRight}
      scaleFocused={1.02}
      style={[
        s.card,
        {
          borderColor: "rgba(255, 255, 255, 0.12)",
        },
        style,
      ]}
      focusedStyle={[
        s.cardFocused,
        {
          borderColor: accentColor,
          shadowColor: accentColor,
        },
      ]}
    >
      {({ focused }) => (
        <View style={s.inner}>
          {/* Fondo gradiente ambiental tenue con el color de acento */}
          <LinearGradient
            colors={[
              focused ? `${accentColor}30` : `${accentColor}12`,
              "rgba(14, 10, 24, 0.88)",
              "rgba(7, 4, 14, 0.98)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Botón circular central con el símbolo '>' */}
          <View
            style={[
              s.circleBtn,
              {
                backgroundColor: focused ? accentColor : `${accentColor}22`,
                borderColor: focused ? "#ffffff" : `${accentColor}60`,
              },
            ]}
          >
            <ChevronRight
              size={scale(26)}
              color={focused ? "#000000" : accentColor}
              strokeWidth={3}
              style={{ marginLeft: scale(2) }}
            />
          </View>

          {/* Etiqueta única y limpia 'Ver todo' */}
          <Text
            style={[
              s.label,
              { color: focused ? "#ffffff" : "rgba(255, 255, 255, 0.88)" },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Focusable>
  );
}

export default memo(HeroGridSeeAllCard);

const s = StyleSheet.create({
  card: {
    width: "48.5%",
    height: "48.5%",
    borderRadius: scale(14),
    backgroundColor: "rgba(18, 12, 32, 0.85)",
    borderWidth: 2,
    position: "relative",
  },
  cardFocused: {
    shadowOpacity: 0.8,
    shadowRadius: scale(12),
    elevation: 10,
    zIndex: 10,
  },
  inner: {
    flex: 1,
    borderRadius: scale(12),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(10),
  },
  circleBtn: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  label: {
    marginTop: scale(8),
    fontSize: scale(13),
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },
});
