import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import RemoteImage from "./RemoteImage";

const FADE_MS = 360;
const ZOOM_MS = 900;
const ZOOM_FROM = 1.07;
const LOAD_FALLBACK_MS = 650;

/**
 * BackdropBackground — Fondo cinematográfico para TV con crossfade continuo por GPU:
 * - Dos capas persistentes (A/B) que NUNCA cambian de imagen mientras están visibles:
 *   la nueva portada se carga en la capa oculta y solo se revela cuando ya está decodificada,
 *   eliminando el destello de la imagen anterior.
 * - Revelado con desvanecido + zoom suave (efecto Ken Burns) por hilo nativo.
 * - Si el usuario cambia rápido de portada, se salta a la última sin acumular transiciones.
 * - Niebla oscura orgánica multicapa a pantalla completa.
 */
function BackdropBackground({
  uri,
}: {
  uri?: string | null;
  variant?: "default" | "home";
}) {
  const [slotUris, setSlotUris] = useState<[string | null, string | null]>([uri || null, null]);
  const [topSlot, setTopSlot] = useState<0 | 1>(0);

  const opacities = useRef([new Animated.Value(uri ? 1 : 0), new Animated.Value(0)]).current;
  const scales = useRef([new Animated.Value(1), new Animated.Value(1)]).current;

  const slotUrisRef = useRef<[string | null, string | null]>([uri || null, null]);
  const frontRef = useRef<0 | 1>(0);
  const targetRef = useRef<string | null>(uri || null);
  const animatingRef = useRef(false);
  const queuedRef = useRef<string | null>(null);
  const waitingRef = useRef<{ slot: 0 | 1; uri: string } | null>(null);
  const fallbackTimer = useRef<any>(null);

  const setSlot = useCallback((slot: 0 | 1, value: string | null) => {
    const next: [string | null, string | null] = [...slotUrisRef.current] as any;
    next[slot] = value;
    slotUrisRef.current = next;
    setSlotUris(next);
  }, []);

  const runReveal = useCallback(
    (slot: 0 | 1) => {
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
      waitingRef.current = null;
      animatingRef.current = true;
      const outgoing = frontRef.current;
      frontRef.current = slot;
      setTopSlot(slot);

      opacities[slot].setValue(0);
      scales[slot].setValue(ZOOM_FROM);

      Animated.parallel([
        Animated.timing(opacities[slot], {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scales[slot], {
          toValue: 1,
          duration: ZOOM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // La capa anterior queda totalmente cubierta: se oculta para reutilizarla
        if (outgoing !== slot) opacities[outgoing].setValue(0);
        animatingRef.current = false;
        const queued = queuedRef.current;
        queuedRef.current = null;
        if (queued && queued !== slotUrisRef.current[frontRef.current]) {
          prepareRef.current(queued);
        }
      });
    },
    [opacities, scales],
  );

  // Carga la nueva portada en la capa oculta y espera a que esté lista antes de revelarla
  const prepare = useCallback(
    (nextUri: string) => {
      if (animatingRef.current) {
        queuedRef.current = nextUri;
        return;
      }
      const incoming: 0 | 1 = frontRef.current === 0 ? 1 : 0;
      opacities[incoming].setValue(0);

      if (slotUrisRef.current[incoming] === nextUri) {
        runReveal(incoming);
        return;
      }

      waitingRef.current = { slot: incoming, uri: nextUri };
      setSlot(incoming, nextUri);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      fallbackTimer.current = setTimeout(() => {
        const w = waitingRef.current;
        if (w && w.uri === nextUri) runReveal(w.slot);
      }, LOAD_FALLBACK_MS);
    },
    [opacities, runReveal, setSlot],
  );
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;

  useEffect(() => {
    if (!uri || uri === targetRef.current) return;
    targetRef.current = uri;

    if (!slotUrisRef.current[frontRef.current]) {
      setSlot(frontRef.current, uri);
      opacities[frontRef.current].setValue(1);
      return;
    }
    if (uri === slotUrisRef.current[frontRef.current] && !animatingRef.current) return;
    prepare(uri);
  }, [uri, prepare, setSlot, opacities]);

  useEffect(() => {
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  const handleLoad = useCallback(
    (slot: 0 | 1) => {
      const w = waitingRef.current;
      if (w && w.slot === slot && slotUrisRef.current[slot] === w.uri) {
        runReveal(slot);
      }
    },
    [runReveal],
  );
  const onLoad0 = useCallback(() => handleLoad(0), [handleLoad]);
  const onLoad1 = useCallback(() => handleLoad(1), [handleLoad]);

  if (!slotUris[0] && !slotUris[1]) return <View style={s.layer} />;

  const renderSlot = (slot: 0 | 1) => (
    <Animated.View
      key={`slot-${slot}`}
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: topSlot === slot ? 2 : 1,
          opacity: opacities[slot],
          transform: [{ scale: scales[slot] }],
        },
      ]}
      pointerEvents="none"
    >
      {slotUris[slot] ? (
        <RemoteImage
          uri={slotUris[slot]}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
          contentPosition="top"
          transition={0}
          priority="high"
          disableRecycling
          onLoad={slot === 0 ? onLoad0 : onLoad1}
          onError={slot === 0 ? onLoad0 : onLoad1}
        />
      ) : null}
    </Animated.View>
  );

  return (
    <View style={s.layer} pointerEvents="none">
      {/* 1-2. Capas A/B persistentes con revelado por desvanecido + zoom suave */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {renderSlot(0)}
        {renderSlot(1)}
      </View>

      {/* 3. Niebla oscura lateral izquierda: profunda en el borde, difuminándose suavemente hacia el centro */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.96)",
          "rgba(8,8,8,0.82)",
          "rgba(8,8,8,0.52)",
          "rgba(8,8,8,0.22)",
          "rgba(8,8,8,0.05)",
          "transparent",
        ]}
        locations={[0, 0.15, 0.32, 0.50, 0.68, 0.84, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4. Niebla oscura inferior: base densa que acoge las tarjetas y se disipa hacia arriba de forma continua */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.95)",
          "rgba(8,8,8,0.78)",
          "rgba(8,8,8,0.48)",
          "rgba(8,8,8,0.20)",
          "rgba(8,8,8,0.04)",
          "transparent",
        ]}
        locations={[0, 0.14, 0.30, 0.50, 0.70, 0.86, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 5. Niebla diagonal orgánica: brota desde la esquina inferior-izquierda difuminándose sin formas rectas */}
      <LinearGradient
        colors={[
          "#080808",
          "rgba(8,8,8,0.90)",
          "rgba(8,8,8,0.65)",
          "rgba(8,8,8,0.35)",
          "rgba(8,8,8,0.10)",
          "transparent",
        ]}
        locations={[0, 0.20, 0.42, 0.65, 0.85, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.85, y: 0.15 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 6. Velo de difusión suave envolvente para textura de humo realista */}
      <LinearGradient
        colors={[
          "rgba(8,8,8,0.65)",
          "rgba(8,8,8,0.35)",
          "rgba(8,8,8,0.10)",
          "transparent",
        ]}
        locations={[0, 0.32, 0.62, 1]}
        start={{ x: 0.05, y: 0.85 }}
        end={{ x: 0.65, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

export default memo(BackdropBackground);

const s = StyleSheet.create({
  layer: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 0,
    backgroundColor: "#080808",
    overflow: "hidden",
  },
});
