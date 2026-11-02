import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getWatchStream } from "../../services/nexoplay";
import Focusable from "./Focusable";

/** Reproductor de películas / episodios (VOD) por slug. */
export default function VodPlayer({
  slug,
  episodeId,
}: {
  slug: string;
  episodeId?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(false);
    getWatchStream(slug, episodeId).then((data) => {
      if (cancelled) return;
      const u = data?.masterPlaylist || data?.url || data?.streamUrl;
      if (u) setUrl(u);
      else setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, episodeId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>No se pudo cargar el video</Text>
        <Focusable
          hasTVPreferredFocus
          onPress={() => router.back()}
          style={s.btn}
          focusedStyle={s.btnFocused}
        >
          <Text style={s.btnText}>Volver</Text>
        </Focusable>
      </View>
    );
  }

  const buffering =
    !url || !status?.isLoaded || (status.isLoaded && status.isBuffering);

  return (
    <View style={s.root}>
      {url ? (
        <Video
          style={StyleSheet.absoluteFill}
          source={{ uri: url }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={setStatus}
          onError={() => setError(true)}
        />
      ) : null}
      {buffering ? (
        <View style={s.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(16),
  },
  overlay: {
    ...(StyleSheet.absoluteFill as any),
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: { fontSize: scale(20), fontWeight: "800", color: "#f87171" },
  btn: {
    paddingHorizontal: scale(24),
    height: scale(42),
    borderRadius: scale(10),
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnFocused: { backgroundColor: "#fff" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: scale(14) },
});
