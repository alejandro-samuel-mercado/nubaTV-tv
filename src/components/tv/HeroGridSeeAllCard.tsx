import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Compass } from "lucide-react-native";
import React, { memo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { scale } from "../../lib/scale";
import Focusable from "./Focusable";

interface Props {
  onPress: () => void;
  accentColor?: string;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  icon?: any;
  trapFocusRight?: boolean;
  style?: StyleProp<ViewStyle>;
}

function HeroGridSeeAllCard({
  onPress,
  accentColor = "#ffb703",
  title = "Ver Todo",
  subtitle = "Explorar catálogo",
  buttonLabel = "Explorar",
  icon: Icon = Compass,
  trapFocusRight = true,
  style,
}: Props) {
  return (
    <Focusable
      onPress={onPress}
      trapFocusRight={trapFocusRight}
      scaleFocused={1.03}
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
          {/* Fondo gradiente ambiental suave con el color temático */}
          <LinearGradient
            colors={[
              focused ? `${accentColor}35` : `${accentColor}18`,
              "rgba(10, 6, 20, 0.88)",
              "rgba(5, 3, 12, 0.98)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Círculo superior con ícono */}
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: focused ? `${accentColor}40` : `${accentColor}20`,
                borderColor: focused ? accentColor : `${accentColor}55`,
              },
            ]}
          >
            <Icon
              size={scale(16)}
              color={accentColor}
              strokeWidth={2.4}
            />
          </View>

          {/* Textos descriptivos */}
          <View style={s.textContainer}>
            <Text
              style={[
                s.title,
                focused && { color: "#ffffff" },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                s.subtitle,
                focused && { color: "rgba(255, 255, 255, 0.85)" },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          {/* Botón pill de acción en la parte inferior */}
          <View
            style={[
              s.btnPill,
              {
                backgroundColor: focused ? "#ffffff" : accentColor,
              },
            ]}
          >
            <Text
              style={[
                s.btnPillTxt,
                { color: focused ? "#000000" : "#000000" },
              ]}
            >
              {buttonLabel}
            </Text>
            <ArrowRight
              size={scale(11)}
              color="#000000"
              strokeWidth={2.6}
            />
          </View>
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
    overflow: "hidden",
    backgroundColor: "rgba(18, 12, 32, 0.85)",
    borderWidth: 2,
    position: "relative",
  },
  cardFocused: {
    shadowOpacity: 0.7,
    shadowRadius: scale(10),
    elevation: 10,
    zIndex: 10,
  },
  inner: {
    flex: 1,
    padding: scale(12),
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconCircle: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  textContainer: {
    marginTop: "auto",
    marginBottom: scale(8),
  },
  title: {
    color: "#ffffff",
    fontSize: scale(14),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: scale(10.5),
    fontWeight: "600",
    marginTop: scale(2),
  },
  btnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4.5),
    borderRadius: scale(8),
    alignSelf: "flex-start",
  },
  btnPillTxt: {
    fontSize: scale(10.5),
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
