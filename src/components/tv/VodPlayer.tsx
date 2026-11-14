import Video, { SelectedTrackType, TextTrackType, VideoRef } from "react-native-video";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Languages,
  List,
  Maximize2,
  Minimize,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTVRemoteKey } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentDetail,
  getWatchStream,
  NEXOPLAY_API_BASE,
  NexoContentItem,
} from "../../services/nexoplay";
import Focusable from "./Focusable";
import WebPlayer from "./WebPlayer";

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const LANG_LABELS: Record<string, string> = {
  es: "Español",
  spa: "Español",
  "es-419": "Español (Latino)",
  "es-es": "Español (España)",
  en: "Inglés",
  eng: "Inglés",
  pt: "Portugués",
  por: "Portugués",
  fr: "Francés",
  fra: "Francés",
  it: "Italiano",
  ita: "Italiano",
  de: "Alemán",
  deu: "Alemán",
  ja: "Japonés",
  jpn: "Japonés",
  ko: "Coreano",
  kor: "Coreano",
  zh: "Chino",
  zho: "Chino",
  ru: "Ruso",
  rus: "Ruso",
  und: "Pista Original",
};

const getLangLabel = (code?: string, title?: string, index?: number) => {
  if (title && title.trim() && !/^(track|stream|audio|sub)\s*\d*$/i.test(title.trim())) {
    return title.trim();
  }
  if (code) {
    const clean = code.toLowerCase().trim();
    if (LANG_LABELS[clean]) return LANG_LABELS[clean];
    const short = clean.split("-")[0];
    if (LANG_LABELS[short]) return LANG_LABELS[short];
    return code.toUpperCase();
  }
  return `Pista ${(index ?? 0) + 1}`;
};

function parseTimeSec(timeStr: string): number {
  const parts = timeStr.trim().replace(",", ".").split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
}

function parseVTT(vttText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  if (!vttText) return cues;
  const blocks = vttText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n\n");
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    if (lines[0].startsWith("WEBVTT") || lines[0].startsWith("NOTE")) continue;

    let timeLineIdx = 0;
    if (!lines[0].includes("-->")) {
      if (lines[1] && lines[1].includes("-->")) {
        timeLineIdx = 1;
      } else {
        continue;
      }
    }

    const timeParts = lines[timeLineIdx].split("-->");
    if (timeParts.length !== 2) continue;

    const start = parseTimeSec(timeParts[0].trim().split(" ")[0]);
    const end = parseTimeSec(timeParts[1].trim().split(" ")[0]);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text && !isNaN(start) && !isNaN(end)) {
      cues.push({ start, end, text });
    }
  }
  return cues;
}

const fmtTime = (millis: number) => {
  if (!millis || isNaN(millis) || millis < 0) return "00:00";
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

const TVPressable = Pressable as any;

const safeFindNodeHandle = (componentOrHandle: any): number | undefined => {
  if (Platform.OS === "web" || !componentOrHandle) return undefined;
  try {
    const handle = findNodeHandle(componentOrHandle);
    return typeof handle === "number" && handle > 0 ? handle : undefined;
  } catch {
    return undefined;
  }
};

// ── Barra de Progreso Interactiva (Ping-Pong D-Pad + Aceleración Inteligente) ──
function ScrubProgressBar({
  positionMs,
  durationMs,
  onSeek,
  onFocusGained,
  onFocusLost,
  onPress,
  nextFocusUp,
  nextFocusDown,
  mainNodeRef,
  onMainLayout,
}: {
  positionMs: number;
  durationMs: number;
  onSeek: (newMs: number) => void;
  onFocusGained: () => void;
  onFocusLost: () => void;
  onPress?: () => void;
  nextFocusUp?: number;
  nextFocusDown?: number;
  mainNodeRef?: React.MutableRefObject<any>;
  onMainLayout?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [scrubBadge, setScrubBadge] = useState<string | null>(null);

  const mainRef = useRef<any>(null);
  const r1Ref = useRef<any>(null);
  const r2Ref = useRef<any>(null);
  const l1Ref = useRef<any>(null);
  const l2Ref = useRef<any>(null);

  const [nodes, setNodes] = useState<{
    main?: number;
    r1?: number;
    r2?: number;
    l1?: number;
    l2?: number;
  }>({});

  const positionMsRef = useRef(positionMs);
  const durationMsRef = useRef(durationMs);
  const onSeekRef = useRef(onSeek);
  const focusTimerRef = useRef<any>(null);
  const badgeTimerRef = useRef<any>(null);
  const groupFocusedRef = useRef(false);

  // Control de deduplicación y aceleración progresiva al mantener presionado
  const lastTriggerTimeRef = useRef(0);
  const lastSeekActionTimeRef = useRef(0);
  const lastDirectionRef = useRef<"left" | "right" | null>(null);
  const streakRef = useRef(0);

  useEffect(() => {
    positionMsRef.current = positionMs;
    durationMsRef.current = durationMs;
    onSeekRef.current = onSeek;
  }, [positionMs, durationMs, onSeek]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    };
  }, []);

  const syncNodes = useCallback(() => {
    if (mainNodeRef) {
      mainNodeRef.current = mainRef.current;
    }
    const next = {
      main: safeFindNodeHandle(mainRef.current),
      r1: safeFindNodeHandle(r1Ref.current),
      r2: safeFindNodeHandle(r2Ref.current),
      l1: safeFindNodeHandle(l1Ref.current),
      l2: safeFindNodeHandle(l2Ref.current),
    };
    setNodes((prev) =>
      prev.main === next.main &&
      prev.r1 === next.r1 &&
      prev.r2 === next.r2 &&
      prev.l1 === next.l1 &&
      prev.l2 === next.l2
        ? prev
        : next
    );
    onMainLayout?.();
  }, [mainNodeRef, onMainLayout]);

  useEffect(() => {
    const t = setTimeout(syncNodes, 30);
    return () => clearTimeout(t);
  }, [syncNodes]);

  const handleFocus = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    groupFocusedRef.current = true;
    setFocused(true);
    onFocusGained();
  }, [onFocusGained]);

  const handleBlur = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      groupFocusedRef.current = false;
      streakRef.current = 0;
      lastDirectionRef.current = null;
      setFocused(false);
      setScrubBadge(null);
      onFocusLost();
    }, 150);
  }, [onFocusLost]);

  const doSeek = useCallback(
    (direction: "left" | "right") => {
      if (!groupFocusedRef.current) {
        handleFocus();
        return;
      }

      const now = Date.now();
      // Deduplicar si el evento de tecla y el foco nativo ping-pong disparan en el mismo frame
      if (now - lastTriggerTimeRef.current < 55) {
        return;
      }
      lastTriggerTimeRef.current = now;

      // Aceleración progresiva: 10s -> 20s -> 30s -> 60s al mantener o pulsar rápido
      if (
        now - lastSeekActionTimeRef.current < 480 &&
        lastDirectionRef.current === direction
      ) {
        streakRef.current += 1;
      } else {
        streakRef.current = 1;
      }
      lastSeekActionTimeRef.current = now;
      lastDirectionRef.current = direction;

      const streak = streakRef.current;
      const stepMs =
        streak <= 2
          ? 10_000
          : streak <= 5
          ? 20_000
          : streak <= 9
          ? 30_000
          : 60_000;

      const effectiveDur =
        durationMsRef.current > 1000
          ? durationMsRef.current
          : Math.max(positionMsRef.current + 3600_000, 3600_000);

      const nextMs =
        direction === "left"
          ? Math.max(0, positionMsRef.current - stepMs)
          : Math.min(effectiveDur, positionMsRef.current + stepMs);

      positionMsRef.current = nextMs;
      onSeekRef.current(nextMs);

      const stepLabel =
        stepMs >= 60_000 ? "1 min" : `${Math.round(stepMs / 1000)}s`;
      setScrubBadge(
        direction === "left" ? `« -${stepLabel}` : `+${stepLabel} »`
      );
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
      badgeTimerRef.current = setTimeout(() => {
        setScrubBadge(null);
      }, 1100);

      handleFocus();
    },
    [handleFocus]
  );

  // Soporte directo para teclas Left/Right mientras la barra tiene foco
  useTVRemoteKey((evt) => {
    if (!groupFocusedRef.current || !evt?.eventType) return;
    if (evt.eventType === "left" || evt.eventType === "right") {
      doSeek(evt.eventType);
    }
  });

  const pct =
    durationMs > 1000
      ? Math.max(0, Math.min(100, (positionMs / durationMs) * 100))
      : 0;

  return (
    <View style={s.progressOuterRow} onLayout={syncNodes}>
      {/* LEFT PING-PONG NODES */}
      <TVPressable
        ref={l2Ref}
        focusable
        onLayout={syncNodes}
        onFocus={() => doSeek("left")}
        onBlur={handleBlur}
        onPress={onPress}
        nextFocusLeft={nodes.l1}
        nextFocusRight={nodes.main}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={s.pingPongLeft2}
      />
      <TVPressable
        ref={l1Ref}
        focusable
        onLayout={syncNodes}
        onFocus={() => doSeek("left")}
        onBlur={handleBlur}
        onPress={onPress}
        nextFocusLeft={nodes.l2}
        nextFocusRight={nodes.main}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={s.pingPongLeft1}
      />

      {/* MAIN PROGRESS BAR */}
      <TVPressable
        ref={mainRef}
        focusable
        onLayout={syncNodes}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={onPress}
        nextFocusLeft={nodes.l1}
        nextFocusRight={nodes.r1}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={[s.progressWrapper, focused && s.progressWrapperFocused]}
      >
        <Text style={[s.timeText, focused && s.timeTextFocused]}>
          {fmtTime(positionMs)}
        </Text>
        <View style={[s.progressBarTrack, focused && s.progressBarTrackFocused]}>
          <View style={[s.progressBarFill, { width: `${pct}%` as any }]} />
          <View
            style={[
              s.progressThumb,
              { left: `${pct}%` as any },
              focused && s.progressThumbFocused,
            ]}
          />
          {focused && (
            <View
              style={[
                s.scrubFloatingPill,
                { left: `${Math.max(6, Math.min(94, pct))}%` as any },
              ]}
              pointerEvents="none"
            >
              <Text style={s.scrubFloatingTxt}>
                {scrubBadge
                  ? `${scrubBadge} • ${fmtTime(positionMs)}`
                  : `◀ ${fmtTime(positionMs)} ▶`}
              </Text>
            </View>
          )}
        </View>
        <Text style={[s.timeText, focused && s.timeTextFocused]}>
          {fmtTime(durationMs)}
        </Text>
      </TVPressable>

      {/* RIGHT PING-PONG NODES */}
      <TVPressable
        ref={r1Ref}
        focusable
        onLayout={syncNodes}
        onFocus={() => doSeek("right")}
        onBlur={handleBlur}
        onPress={onPress}
        nextFocusRight={nodes.r2}
        nextFocusLeft={nodes.main}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={s.pingPongRight1}
      />
      <TVPressable
        ref={r2Ref}
        focusable
        onLayout={syncNodes}
        onFocus={() => doSeek("right")}
        onBlur={handleBlur}
        onPress={onPress}
        nextFocusRight={nodes.r1}
        nextFocusLeft={nodes.main}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={s.pingPongRight2}
      />
    </View>
  );
}

interface VodPlayerProps {
  slug: string;
  episodeId?: string;
}

export default function VodPlayer({ slug, episodeId: initialEpId }: VodPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<any>(null);

  // Content metadata & active episode
  const [content, setContent] = useState<NexoContentItem | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | undefined>(initialEpId);
  const [streamData, setStreamData] = useState<{
    url: string;
    title?: string;
    audioTracks?: any[];
    subtitleTracks?: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(1);
  const positionMillisRef = useRef(0);
  const durationMillisRef = useRef(1);
  const lastSeekTimeRef = useRef(0);
  const lastNativeSeekExecRef = useRef(0);
  const seekCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrubBarFocusedRef = useRef(false);

  // Referencias de foco para navegación vertical exacta entre TopBar <-> Barra de Progreso <-> Controles
  const topBackBtnRef = useRef<any>(null);
  const progressMainRef = useRef<any>(null);
  const playBtnRef = useRef<any>(null);
  const [osdNavHandles, setOsdNavHandles] = useState<{
    topBack?: number;
    progressMain?: number;
    playBtn?: number;
  }>({});

  const syncOsdNavHandles = useCallback(() => {
    if (Platform.OS === "web") return;
    const next = {
      topBack: safeFindNodeHandle(topBackBtnRef.current),
      progressMain: safeFindNodeHandle(progressMainRef.current),
      playBtn: safeFindNodeHandle(playBtnRef.current),
    };
    setOsdNavHandles((prev) =>
      prev.topBack === next.topBack &&
      prev.progressMain === next.progressMain &&
      prev.playBtn === next.playBtn
        ? prev
        : next
    );
  }, []);

  // Aspect ratio and audio/subtitle tracks
  const [resizeMode, setResizeMode] = useState<"contain" | "cover">("contain");
  const [volumeToast, setVolumeToast] = useState<string | null>(null);
  const volumeToastTimer = useRef<any>(null);

  // OSD & Drawer states
  const [showOSD, setShowOSD] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<"episodes" | "subs" | "audio" | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Disparadores diferidos de foco inicial para Fabric (false -> true tras montar overlay)
  const [osdFocusReady, setOsdFocusReady] = useState(false);
  const [drawerFocusReady, setDrawerFocusReady] = useState(false);
  const [exitFocusReady, setExitFocusReady] = useState(false);

  // Track selection
  const [selectedSub, setSelectedSub] = useState<string>("off");
  const [selectedAudio, setSelectedAudio] = useState<string>("auto");
  const [detectedAudioTracks, setDetectedAudioTracks] = useState<any[]>([]);
  const [detectedTextTracks, setDetectedTextTracks] = useState<any[]>([]);
  const subtitleCuesRef = useRef<SubtitleCue[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string>("");
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  const syncSubtitleForTime = useCallback((posSec: number) => {
    if (subtitleCuesRef.current.length > 0) {
      const activeCue = subtitleCuesRef.current.find(
        (c) => posSec >= c.start && posSec <= c.end,
      );
      const nextText = activeCue ? activeCue.text : "";
      setCurrentSubtitleText((prev) => (prev !== nextText ? nextText : prev));
    } else {
      setCurrentSubtitleText((prev) => (prev !== "" ? "" : prev));
    }
  }, []);

  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDrawerRef = useRef(activeDrawer);
  activeDrawerRef.current = activeDrawer;
  const showExitModalRef = useRef(showExitModal);
  showExitModalRef.current = showExitModal;

  const startOsdTimer = useCallback(() => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (
      !activeDrawerRef.current &&
      !showExitModalRef.current &&
      !isScrubBarFocusedRef.current
    ) {
      osdTimerRef.current = setTimeout(() => {
        setShowOSD(false);
      }, 10000);
    }
  }, []);

  // Auto-hide OSD after 10 seconds of inactivity
  useEffect(() => {
    if (showOSD && !activeDrawer && !showExitModal) {
      startOsdTimer();
    } else if (osdTimerRef.current) {
      clearTimeout(osdTimerRef.current);
    }
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [showOSD, activeDrawer, showExitModal, startOsdTimer]);

  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    startOsdTimer();
  }, [startOsdTimer]);

  const hideOSD = useCallback(() => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    setShowOSD(false);
  }, []);

  useEffect(() => {
    if (showOSD && !error && !activeDrawer && !showExitModal) {
      setOsdFocusReady(false);
      const t = setTimeout(() => setOsdFocusReady(true), 50);
      return () => clearTimeout(t);
    }
    setOsdFocusReady(false);
  }, [showOSD, error, activeDrawer, showExitModal]);

  useEffect(() => {
    if (activeDrawer) {
      setDrawerFocusReady(false);
      const t = setTimeout(() => setDrawerFocusReady(true), 50);
      return () => clearTimeout(t);
    }
    setDrawerFocusReady(false);
  }, [activeDrawer]);

  useEffect(() => {
    if (showExitModal) {
      setExitFocusReady(false);
      const t = setTimeout(() => setExitFocusReady(true), 50);
      return () => clearTimeout(t);
    }
    setExitFocusReady(false);
  }, [showExitModal]);

  // Fetch full content info once on mount or when slug changes
  useEffect(() => {
    let cancelled = false;
    getContentDetail(slug).then((detail) => {
      if (cancelled || !detail) return;
      setContent(detail);

      // If series and no initial episode provided, pick first available episode
      if (!initialEpId && detail.type !== "MOVIE" && detail.seasons?.length) {
        const firstEp = detail.seasons[0]?.episodes?.[0];
        if (firstEp?.id) {
          setCurrentEpisodeId(firstEp.id);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug, initialEpId]);

  // Fetch stream whenever currentEpisodeId or slug changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setErrorMessage(null);
    setStreamData(null);
    setDetectedAudioTracks([]);
    setDetectedTextTracks([]);
    subtitleCuesRef.current = [];
    setCurrentSubtitleText("");
    setPositionMillis(0);
    setDurationMillis(1);
    positionMillisRef.current = 0;
    durationMillisRef.current = 1;
    lastSeekTimeRef.current = 0;

    getWatchStream(slug, currentEpisodeId)
      .then((data) => {
        if (cancelled) return;
        const u = data?.masterPlaylist || data?.url || data?.streamUrl;
        if (u) {
          setStreamData({
            url: u,
            title: data?.title || "",
            audioTracks: data?.audioTracks || [],
            subtitleTracks: data?.subtitleTracks || [],
          });
          setLoading(false);
        } else {
          setError(true);
          setErrorMessage("No se pudo obtener el enlace de reproducción.");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(true);
        setErrorMessage(err?.message || "Error al conectar con el servidor.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [slug, currentEpisodeId]);

  // Compute all episodes flat list for next/prev navigation
  const allEpisodes = useMemo(() => {
    if (!content?.seasons) return [];
    return content.seasons.flatMap((s: any) =>
      (s.episodes || []).map((e: any) => ({
        ...e,
        seasonNumber: s.number,
      }))
    );
  }, [content]);

  const currentIdx = useMemo(() => {
    if (!currentEpisodeId) return -1;
    return allEpisodes.findIndex((e: any) => String(e.id) === String(currentEpisodeId));
  }, [allEpisodes, currentEpisodeId]);

  const currentEpisode = useMemo(() => {
    if (currentIdx >= 0) return allEpisodes[currentIdx];
    return null;
  }, [allEpisodes, currentIdx]);

  const hasNext = currentIdx >= 0 && currentIdx < allEpisodes.length - 1;
  const hasPrev = currentIdx > 0;

  // Auto-expand season containing the active episode
  useEffect(() => {
    if (activeDrawer === "episodes" && currentEpisode?.seasonNumber) {
      setExpandedSeasons((prev) => ({ ...prev, [currentEpisode.seasonNumber]: true }));
    }
  }, [activeDrawer, currentEpisode]);

  // Fallback de duración desde metadatos si el stream HLS tarda en reportar duration
  useEffect(() => {
    if (durationMillis > 1000) return;
    const epDurSec =
      currentEpisode?.durationSeconds ||
      (currentEpisode?.duration
        ? currentEpisode.duration > 300
          ? currentEpisode.duration
          : currentEpisode.duration * 60
        : 0);
    const contentDurSec = content?.duration
      ? content.duration > 300
        ? content.duration
        : content.duration * 60
      : 0;
    const fallbackSec = epDurSec || contentDurSec;
    if (fallbackSec && fallbackSec > 0) {
      const ms = fallbackSec * 1000;
      durationMillisRef.current = ms;
      setDurationMillis(ms);
    }
  }, [content, currentEpisode, durationMillis]);

  useEffect(() => {
    return () => {
      if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
    };
  }, []);

  // Handle Playback Status Updates
  const handlePlaybackStatusUpdate = useCallback((st: any) => {
    if (st?.isLoaded) {
      setIsPlaying(Boolean(st.isPlaying));
      if (
        st.positionMillis !== undefined &&
        Date.now() - lastSeekTimeRef.current > 900
      ) {
        positionMillisRef.current = st.positionMillis;
        setPositionMillis(st.positionMillis);
        syncSubtitleForTime(st.positionMillis / 1000);
      }
      if (st.durationMillis && st.durationMillis > 0) {
        durationMillisRef.current = st.durationMillis;
        setDurationMillis(st.durationMillis);
      }
      if (loading && st.positionMillis > 0) {
        setLoading(false);
      }
    }
  }, [loading]);

  // Seek unificado a posición absoluta en ms (con protección contra rebote de onProgress)
  const seekToPosition = useCallback(
    (newPosMs: number) => {
      const effectiveDur =
        durationMillisRef.current > 1000
          ? durationMillisRef.current
          : durationMillis > 1000
          ? durationMillis
          : Math.max(newPosMs + 60_000, 7_200_000);
      const clamped = Math.max(0, Math.min(newPosMs, effectiveDur));

      lastSeekTimeRef.current = Date.now();
      positionMillisRef.current = clamped;
      setPositionMillis(clamped);
      syncSubtitleForTime(clamped / 1000);

      const applyNativeSeek = () => {
        const vid = videoRef.current as any;
        if (!vid) return;
        lastSeekTimeRef.current = Date.now();
        if (vid.seek) {
          vid.seek(clamped / 1000);
        } else if (vid.setPositionAsync) {
          vid.setPositionAsync(clamped);
        }
      };

      const now = Date.now();
      if (now - lastNativeSeekExecRef.current > 280) {
        lastNativeSeekExecRef.current = now;
        applyNativeSeek();
      }
      if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
      seekCommitTimerRef.current = setTimeout(() => {
        lastNativeSeekExecRef.current = Date.now();
        applyNativeSeek();
      }, 140);
    },
    [durationMillis]
  );

  // Playback Controls
  const togglePlayPause = useCallback(async () => {
    triggerOSD();
    const vid = videoRef.current as any;
    if (!vid) return;

    if (isPlaying) {
      if (vid.pauseAsync) await vid.pauseAsync();
      else if (vid.pause) vid.pause();
      setIsPlaying(false);
    } else {
      if (vid.playAsync) await vid.playAsync();
      else if (vid.play) vid.play();
      setIsPlaying(true);
    }
  }, [isPlaying, triggerOSD]);

  const seekRelative = useCallback(
    (seconds: number) => {
      triggerOSD();
      seekToPosition(positionMillisRef.current + seconds * 1000);
    },
    [seekToPosition, triggerOSD]
  );

  const restart = useCallback(async () => {
    triggerOSD();
    seekToPosition(0);
    const vid = videoRef.current as any;
    if (vid?.playAsync) await vid.playAsync();
    else if (vid?.play) vid.play();
    setIsPlaying(true);
  }, [seekToPosition, triggerOSD]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    const nextEp = allEpisodes[currentIdx + 1];
    if (nextEp?.id) {
      setCurrentEpisodeId(nextEp.id);
      triggerOSD();
    }
  }, [hasNext, allEpisodes, currentIdx, triggerOSD]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    const prevEp = allEpisodes[currentIdx - 1];
    if (prevEp?.id) {
      setCurrentEpisodeId(prevEp.id);
      triggerOSD();
    }
  }, [hasPrev, allEpisodes, currentIdx, triggerOSD]);

  // Toggle Screen Aspect Ratio
  const toggleResizeMode = useCallback(() => {
    triggerOSD();
    setResizeMode((prev) => (prev === "contain" ? "cover" : "contain"));
    showToastHUD(resizeMode === "contain" ? "Pantalla: Llenar (Zoom)" : "Pantalla: Ajustar (Original)");
  }, [resizeMode, triggerOSD]);

  const showToastHUD = (msg: string) => {
    setVolumeToast(msg);
    if (volumeToastTimer.current) clearTimeout(volumeToastTimer.current);
    volumeToastTimer.current = setTimeout(() => {
      setVolumeToast(null);
    }, 2200);
  };

  // Hardware Back Button
  useEffect(() => {
    if (Platform.OS === "web") return;
    const backAction = () => {
      if (showExitModal) {
        setShowExitModal(false);
        return true;
      }
      if (activeDrawer) {
        setActiveDrawer(null);
        triggerOSD();
        return true;
      }
      if (showOSD) {
        hideOSD();
        return true;
      }
      setShowExitModal(true);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => sub.remove();
  }, [showExitModal, activeDrawer, showOSD, triggerOSD, hideOSD]);

  // TV D-Pad Events (vía MainActivity -> onTVRemoteKey):
  // Cuando el OSD está oculto, cualquier tecla de dirección/OK/menú vuelve a mostrar el menú de control.
  useTVRemoteKey((evt) => {
    if (!evt || !evt.eventType) return;
    if (activeDrawer || showExitModal || error) return;

    if (!showOSD) {
      if (
        evt.eventType === "select" ||
        evt.eventType === "up" ||
        evt.eventType === "down" ||
        evt.eventType === "left" ||
        evt.eventType === "right" ||
        evt.eventType === "menu"
      ) {
        triggerOSD();
      } else if (evt.eventType === "playPause" && (evt.repeatCount ?? 0) === 0) {
        togglePlayPause();
      }
    } else {
      triggerOSD();
      if (evt.eventType === "playPause" && (evt.repeatCount ?? 0) === 0) {
        togglePlayPause();
      }
    }
  });

  const progressPercent =
    durationMillis > 1000
      ? Math.max(0, Math.min(100, (positionMillis / durationMillis) * 100))
      : 0;

  const isSeries =
    content?.type === "SERIES" ||
    Boolean(content?.seasons && content.seasons.length > 0) ||
    Boolean(currentEpisode);

  // Title and subtitle labels
  const mainTitle = content?.title || streamData?.title || "Reproduciendo";
  const subTitle = currentEpisode
    ? `Temporada ${currentEpisode.seasonNumber} • Episodio ${currentEpisode.number}${
        currentEpisode.translations?.[0]?.title ? ` - ${currentEpisode.translations[0].title}` : ""
      }`
    : content?.releaseYear
    ? `${content.releaseYear}${content.duration ? ` • ${Math.round(content.duration > 300 ? content.duration / 60 : content.duration)} min` : ""}`
    : "";

  const audioList = useMemo(() => {
    const dbAudios =
      (streamData?.audioTracks && streamData.audioTracks.length > 0
        ? streamData.audioTracks
        : null) ||
      (currentEpisode as any)?.videoFiles?.[0]?.audioTracks ||
      (content as any)?.videoFiles?.[0]?.audioTracks ||
      (currentEpisode as any)?.audioTracks ||
      (content as any)?.audioTracks ||
      [];

    if (detectedAudioTracks.length > 0) {
      return detectedAudioTracks.map((t: any, idx: number) => {
        const trackIdx = t.index !== undefined ? t.index : idx;
        const dbMatch =
          dbAudios.find(
            (db: any) =>
              db.trackIndex !== undefined && Number(db.trackIndex) === Number(trackIdx),
          ) || dbAudios[idx];
        const label =
          dbMatch?.label || getLangLabel(t.language || dbMatch?.language, t.title, idx);
        return {
          id: `index:${trackIdx}`,
          label,
          language: t.language || dbMatch?.language || "und",
        };
      });
    }

    return dbAudios.map((a: any, idx: number) => {
      const trackIdx = a.trackIndex !== undefined ? a.trackIndex : idx;
      return {
        id: `index:${trackIdx}`,
        label: a.label || getLangLabel(a.language, a.title, idx),
        language: a.language || "und",
      };
    });
  }, [streamData?.audioTracks, currentEpisode, content, detectedAudioTracks]);

  const subsList = useMemo(() => {
    const dbSubs =
      (streamData?.subtitleTracks && streamData.subtitleTracks.length > 0
        ? streamData.subtitleTracks
        : null) ||
      (currentEpisode as any)?.videoFiles?.[0]?.subtitleTracks ||
      (content as any)?.videoFiles?.[0]?.subtitleTracks ||
      (currentEpisode as any)?.subtitleTracks ||
      (content as any)?.subtitleTracks ||
      [];

    const externalMapped = dbSubs
      .filter((s: any) => s && (s.url || s.src || s.uri))
      .map((s: any, idx: number) => {
        const rawUrl = s.url || s.src || s.uri;
        let absoluteUrl = String(rawUrl);
        if (absoluteUrl && !absoluteUrl.startsWith("http")) {
          const normalized = absoluteUrl.startsWith("/") ? absoluteUrl : `/${absoluteUrl}`;
          absoluteUrl = `${NEXOPLAY_API_BASE}${normalized}`;
        }
        const label = s.label || getLangLabel(s.language, s.title, idx);
        return {
          id: `title:${label}`,
          label,
          language: s.language || "es",
          uri: absoluteUrl,
          isExternal: true,
        };
      });

    const embeddedSubs = detectedTextTracks
      .filter((t: any) => !externalMapped.some((ext: any) => ext.label === t.title))
      .map((t: any, idx: number) => {
        const trackIdx = t.index !== undefined ? t.index : idx;
        const label = getLangLabel(t.language, t.title, idx);
        return {
          id: `index:${trackIdx}`,
          label,
          language: t.language || "und",
          isExternal: false,
        };
      });

    return [...externalMapped, ...embeddedSubs];
  }, [streamData?.subtitleTracks, currentEpisode, content, detectedTextTracks]);

  const externalTextTracks = useMemo(() => {
    return subsList
      .filter((s: any) => s.isExternal && s.uri)
      .map((s: any) => ({
        title: s.label,
        language: (s.language || "es") as any,
        type: TextTrackType.VTT,
        uri: s.uri,
      }));
  }, [subsList]);

  // Motor de subtítulos externos (VTT / SRT)
  useEffect(() => {
    let cancelled = false;
    if (selectedSub === "off" || !selectedSub.startsWith("title:")) {
      subtitleCuesRef.current = [];
      setCurrentSubtitleText("");
      return;
    }

    const track = subsList.find((s: any) => s.id === selectedSub);
    if (!track || !track.uri) {
      subtitleCuesRef.current = [];
      setCurrentSubtitleText("");
      return;
    }

    fetch(track.uri)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;
        const cues = parseVTT(text);
        subtitleCuesRef.current = cues;
        syncSubtitleForTime(positionMillisRef.current / 1000);
      })
      .catch((err) => {
        console.warn("[VodPlayer] Error cargando subtítulos externos:", err);
        if (!cancelled) {
          subtitleCuesRef.current = [];
          setCurrentSubtitleText("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSub, subsList, syncSubtitleForTime]);

  const resolvedAudioTrack = useMemo(() => {
    if (selectedAudio === "auto") return { type: SelectedTrackType.SYSTEM };
    if (selectedAudio.startsWith("index:")) {
      return {
        type: SelectedTrackType.INDEX,
        value: Number(selectedAudio.replace("index:", "")),
      };
    }
    return { type: SelectedTrackType.INDEX, value: Number(selectedAudio) };
  }, [selectedAudio]);

  const resolvedTextTrack = useMemo(() => {
    if (selectedSub === "off") return { type: SelectedTrackType.DISABLED };
    if (selectedSub.startsWith("title:")) return { type: SelectedTrackType.DISABLED };
    if (selectedSub.startsWith("index:")) {
      return {
        type: SelectedTrackType.INDEX,
        value: Number(selectedSub.replace("index:", "")),
      };
    }
    return { type: SelectedTrackType.INDEX, value: Number(selectedSub) };
  }, [selectedSub]);

  return (
    <View style={s.container}>
      {/* ── Video Player Layer ── */}
      {streamData?.url ? (
        Platform.OS === "web" ? (
          <WebPlayer
            ref={videoRef as any}
            uri={streamData.url}
            fallbackUri={streamData.url}
            controls={false}
            paused={!isPlaying}
            resizeMode={resizeMode}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={(msg) => {
              setError(true);
              setErrorMessage(msg);
            }}
          />
        ) : (
          <Video
            ref={videoRef as any}
            style={s.videoAbsolute}
            source={{ uri: streamData.url }}
            controls={false}
            resizeMode={resizeMode}
            volume={1.0}
            muted={false}
            textTracks={externalTextTracks}
            selectedAudioTrack={resolvedAudioTrack}
            selectedTextTrack={resolvedTextTrack}
            subtitleStyle={{
              fontSize: 22,
              paddingBottom: 42,
              opacity: 1,
            }}
            paused={!isPlaying}
            onAudioTracks={(data: any) => {
              if (data?.audioTracks && Array.isArray(data.audioTracks)) {
                setDetectedAudioTracks(data.audioTracks);
              }
            }}
            onTextTracks={(data: any) => {
              if (data?.textTracks && Array.isArray(data.textTracks)) {
                setDetectedTextTracks(data.textTracks);
              }
            }}
            onProgress={(data: any) => {
              if (
                data?.currentTime !== undefined &&
                !isNaN(data.currentTime) &&
                Date.now() - lastSeekTimeRef.current > 900
              ) {
                const pos = data.currentTime * 1000;
                positionMillisRef.current = pos;
                setPositionMillis(pos);
                syncSubtitleForTime(data.currentTime);
              }
              const dur =
                data?.seekableDuration && data.seekableDuration > 0
                  ? data.seekableDuration
                  : data?.playableDuration && data.playableDuration > 0
                  ? data.playableDuration
                  : data?.duration;
              if (dur && dur > 0 && !isNaN(dur)) {
                const durMs = dur * 1000;
                durationMillisRef.current = durMs;
                setDurationMillis(durMs);
              }
              if (loading) setLoading(false);
            }}
            onLoad={(data: any) => {
              setLoading(false);
              if (data?.audioTracks && Array.isArray(data.audioTracks)) {
                setDetectedAudioTracks(data.audioTracks);
              }
              if (data?.textTracks && Array.isArray(data.textTracks)) {
                setDetectedTextTracks(data.textTracks);
              }
              const dur =
                data?.duration && data.duration > 0
                  ? data.duration
                  : data?.seekableDuration;
              if (dur && dur > 0) {
                const durMs = dur * 1000;
                durationMillisRef.current = durMs;
                setDurationMillis(durMs);
              } else if (content?.duration && durationMillis <= 1000) {
                const fallbackSecs =
                  content.duration > 300 ? content.duration : content.duration * 60;
                const durMs = fallbackSecs * 1000;
                durationMillisRef.current = durMs;
                setDurationMillis(durMs);
              }
            }}
            onBuffer={({ isBuffering }: { isBuffering: boolean }) => {
              setLoading(isBuffering);
            }}
            onError={(err: any) => {
              console.warn("[VodPlayer] Native error:", err);
              setError(true);
              setErrorMessage("Error al reproducir el archivo multimedia.");
            }}
            onEnd={() => {
              if (hasNext) goNext();
            }}
          />
        )
      ) : null}

      {/* ── Capa de Subtítulos Externos (VTT / SRT sincronizados) ── */}
      {!!currentSubtitleText && (
        <View style={s.subtitleOverlay} pointerEvents="none">
          <Text style={s.subtitleText}>{currentSubtitleText}</Text>
        </View>
      )}

      {/* ── Toast HUD (Volumen / Aspecto) ── */}
      {volumeToast && (
        <View style={s.toastHUD}>
          <Text style={s.toastHUDText}>{volumeToast}</Text>
        </View>
      )}

      {/* ── Loading Spinner ── */}
      {loading && !error && (
        <View style={s.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      )}

      {/* ── Center Pause Indicator ── */}
      {!isPlaying && !loading && !error && !showOSD && (
        <View style={s.centerOverlay} pointerEvents="none">
          <View style={s.pauseIndicator}>
            <Pause size={scale(44)} color="#fff" fill="#fff" />
          </View>
        </View>
      )}

      {/* ── Error Screen ── */}
      {error && (
        <View style={s.errorContainer}>
          <AlertCircle size={scale(54)} color="#f87171" style={{ marginBottom: scale(16) }} />
          <Text style={s.errorTitle}>Error al cargar el video</Text>
          <Text style={s.errorSub}>{errorMessage || "No se pudo conectar a la fuente."}</Text>
          <Focusable
            hasTVPreferredFocus
            onPress={() => router.back()}
            style={s.btn}
            focusedStyle={s.btnFocused}
          >
            {({ focused }) => (
              <Text style={[s.btnText, focused && { color: "#000" }]}>Volver al Catálogo</Text>
            )}
          </Focusable>
        </View>
      )}

      {/* Toque/clic fuera del OSD para volver a mostrarlo en dispositivos táctiles */}
      {!showOSD && !error && !activeDrawer && !showExitModal && (
        <Pressable
          focusable={false}
          accessible={false}
          onPress={triggerOSD}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── On-Screen Display (OSD) ── */}
      {showOSD && !error && !activeDrawer && !showExitModal && (
        <View style={s.osdOverlay} pointerEvents="box-none">
          {/* Top Bar: Back button & Title (sin etiqueta HD estática) */}
          <LinearGradient
            colors={["rgba(6,6,8,0.92)", "rgba(6,6,8,0.45)", "transparent"]}
            style={s.topBar}
            pointerEvents="box-none"
          >
            <Focusable
              ref={topBackBtnRef}
              onLayout={syncOsdNavHandles}
              onFocus={triggerOSD}
              onPress={() => setShowExitModal(true)}
              nextFocusDown={osdNavHandles.progressMain}
              trapFocusUp
              scaleFocused={1.06}
              style={s.topBackBtn}
              focusedStyle={s.topBackBtnFocused}
            >
              {({ focused }) => <ArrowLeft size={scale(18)} color={focused ? "#000" : "#fff"} />}
            </Focusable>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{mainTitle}</Text>
              {!!subTitle && <Text style={s.subTitle} numberOfLines={1}>{subTitle}</Text>}
            </View>
          </LinearGradient>

          {/* Bottom Bar: Progress Bar (Above) + Controls Row (Below) */}
          <LinearGradient
            colors={["transparent", "rgba(6,6,8,0.68)", "rgba(6,6,8,0.96)"]}
            style={s.bottomBar}
            pointerEvents="box-none"
          >
            {/* 1. PROGRESS BAR (Interactiva con D-Pad Izquierda/Derecha y aceleración progresiva) */}
            <ScrubProgressBar
              positionMs={positionMillis}
              durationMs={durationMillis}
              onSeek={seekToPosition}
              onPress={togglePlayPause}
              nextFocusUp={osdNavHandles.topBack}
              nextFocusDown={osdNavHandles.playBtn}
              mainNodeRef={progressMainRef}
              onMainLayout={syncOsdNavHandles}
              onFocusGained={() => {
                isScrubBarFocusedRef.current = true;
                if (osdTimerRef.current) {
                  clearTimeout(osdTimerRef.current);
                  osdTimerRef.current = null;
                }
                setShowOSD(true);
              }}
              onFocusLost={() => {
                isScrubBarFocusedRef.current = false;
                startOsdTimer();
              }}
            />

            {/* 2. CONTROLS ROW (3 bloques balanceados con centro 100% centrado siempre) */}
            <View style={s.controlsRow}>
              {/* Grupo Izquierdo: Episodios, Subtítulos y Audio */}
              <View style={s.sideControlsLeft}>
                {isSeries && (
                  <Focusable
                    onFocus={triggerOSD}
                    onPress={() => {
                      setActiveDrawer("episodes");
                      hideOSD();
                    }}
                    nextFocusUp={osdNavHandles.progressMain}
                    trapFocusDown
                    scaleFocused={1.04}
                    style={s.menuBtn}
                    focusedStyle={s.menuBtnFocused}
                  >
                    {({ focused }) => (
                      <>
                        <List size={scale(14)} color={focused ? "#000" : "#fff"} />
                        <Text style={[s.menuBtnText, focused && { color: "#000" }]}>Episodios</Text>
                      </>
                    )}
                  </Focusable>
                )}

                <Focusable
                  onFocus={triggerOSD}
                  onPress={() => {
                    setActiveDrawer("subs");
                    hideOSD();
                  }}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.04}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      <MessageSquare size={scale(14)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.menuBtnText, focused && { color: "#000" }]}>Subtítulos</Text>
                    </>
                  )}
                </Focusable>

                <Focusable
                  onFocus={triggerOSD}
                  onPress={() => {
                    setActiveDrawer("audio");
                    hideOSD();
                  }}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.04}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      <Languages size={scale(14)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.menuBtnText, focused && { color: "#000" }]}>Audio</Text>
                    </>
                  )}
                </Focusable>
              </View>

              {/* Grupo Central: Siempre centrado al 100% en pantalla */}
              <View style={s.mainControlsCenter}>
                <Focusable
                  onFocus={triggerOSD}
                  onPress={restart}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.06}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      <RotateCcw size={scale(15)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && { color: "#000" }]}>Reiniciar</Text>
                    </>
                  )}
                </Focusable>

                <Focusable
                  onFocus={triggerOSD}
                  onPress={() => seekRelative(-10)}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.06}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      <RotateCcw size={scale(15)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && { color: "#000" }]}>-10s</Text>
                    </>
                  )}
                </Focusable>

                {hasPrev && (
                  <Focusable
                    onFocus={triggerOSD}
                    onPress={goPrev}
                    nextFocusUp={osdNavHandles.progressMain}
                    trapFocusDown
                    scaleFocused={1.06}
                    style={s.roundBtn}
                    focusedStyle={s.roundBtnFocused}
                  >
                    {({ focused }) => <SkipBack size={scale(16)} color={focused ? "#000" : "#fff"} />}
                  </Focusable>
                )}

                {/* Botón Principal PLAY/PAUSE */}
                <Focusable
                  ref={playBtnRef}
                  onLayout={syncOsdNavHandles}
                  hasTVPreferredFocus={osdFocusReady}
                  onFocus={triggerOSD}
                  onPress={togglePlayPause}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.08}
                  style={s.playBtn}
                  focusedStyle={s.playBtnFocused}
                >
                  {isPlaying ? (
                    <Pause size={scale(24)} color="#000" fill="#000" />
                  ) : (
                    <Play
                      size={scale(24)}
                      color="#000"
                      fill="#000"
                      style={{ marginLeft: scale(3) }}
                    />
                  )}
                </Focusable>

                {hasNext && (
                  <Focusable
                    onFocus={triggerOSD}
                    onPress={goNext}
                    nextFocusUp={osdNavHandles.progressMain}
                    trapFocusDown
                    scaleFocused={1.06}
                    style={s.roundBtn}
                    focusedStyle={s.roundBtnFocused}
                  >
                    {({ focused }) => <SkipForward size={scale(16)} color={focused ? "#000" : "#fff"} />}
                  </Focusable>
                )}

                <Focusable
                  onFocus={triggerOSD}
                  onPress={() => seekRelative(10)}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  scaleFocused={1.06}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      <RotateCw size={scale(15)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && { color: "#000" }]}>+10s</Text>
                    </>
                  )}
                </Focusable>
              </View>

              {/* Grupo Derecho: Tamaño de pantalla (nunca se sale de los bordes) */}
              <View style={s.sideControlsRight}>
                <Focusable
                  onFocus={triggerOSD}
                  onPress={toggleResizeMode}
                  nextFocusUp={osdNavHandles.progressMain}
                  trapFocusDown
                  trapFocusRight
                  scaleFocused={1.04}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  {({ focused }) => (
                    <>
                      {resizeMode === "cover" ? (
                        <Minimize size={scale(14)} color={focused ? "#000" : "#fff"} />
                      ) : (
                        <Maximize2 size={scale(14)} color={focused ? "#000" : "#fff"} />
                      )}
                      <Text style={[s.menuBtnText, focused && { color: "#000" }]}>
                        {resizeMode === "cover" ? "Llenar" : "Ajustar"}
                      </Text>
                    </>
                  )}
                </Focusable>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* ── RIGHT SIDEBAR DRAWERS (EPISODIOS / SUBS / AUDIO) ── */}
      {activeDrawer && (
        <View style={s.sidebarOverlay}>
          <Pressable
            focusable={false}
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setActiveDrawer(null);
              triggerOSD();
            }}
          />
          <View style={s.sidebar}>
            <LinearGradient
              colors={["#0c0c10", "#070709"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.sidebarHeader}>
              <View style={{ flex: 1, paddingRight: scale(10) }}>
                <Text style={s.sidebarTitle} numberOfLines={1}>
                  {activeDrawer === "episodes"
                    ? "Episodios y Temporadas"
                    : activeDrawer === "subs"
                    ? "Subtítulos"
                    : "Pistas de Audio"}
                </Text>
                <Text style={s.sidebarSub} numberOfLines={1}>{mainTitle}</Text>
              </View>
              <Focusable
                hasTVPreferredFocus={
                  drawerFocusReady &&
                  activeDrawer === "episodes" &&
                  (!content?.seasons || content.seasons.length === 0)
                }
                onPress={() => {
                  setActiveDrawer(null);
                  triggerOSD();
                }}
                scaleFocused={1.06}
                style={s.closeBtn}
                focusedStyle={s.closeBtnFocused}
              >
                {({ focused }) => <X size={scale(15)} color={focused ? "#000" : "#fff"} />}
              </Focusable>
            </View>

            {/* Lista de Episodios */}
            {activeDrawer === "episodes" && (
              <ScrollView contentContainerStyle={{ padding: scale(14), gap: scale(10) }}>
                {content?.seasons && content.seasons.length > 0 ? (
                  content.seasons.map((se: any, sIdx: number) => {
                    const isExpanded = Boolean(expandedSeasons[se.number]);
                    return (
                      <View key={se.id || sIdx} style={{ gap: scale(6) }}>
                        <Focusable
                          hasTVPreferredFocus={drawerFocusReady && sIdx === 0}
                          onPress={() =>
                            setExpandedSeasons((prev) => ({
                              ...prev,
                              [se.number]: !prev[se.number],
                            }))
                          }
                          scaleFocused={1.02}
                          style={s.seasonHeader}
                          focusedStyle={s.seasonHeaderFocused}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: scale(8) }}>
                            {isExpanded ? (
                              <ChevronDown size={scale(15)} color={C.accent} />
                            ) : (
                              <ChevronRight size={scale(15)} color={C.accent} />
                            )}
                            <Text style={s.seasonTitle}>Temporada {se.number}</Text>
                          </View>
                          <Text style={s.seasonCount}>{se.episodes?.length || 0} ep.</Text>
                        </Focusable>

                        {isExpanded && (
                          <View style={s.episodesContainer}>
                            {se.episodes?.map((ep: any) => {
                              const isCurrent = String(ep.id) === String(currentEpisodeId);
                              return (
                                <Focusable
                                  key={ep.id}
                                  onPress={() => {
                                    setCurrentEpisodeId(ep.id);
                                    setActiveDrawer(null);
                                    triggerOSD();
                                  }}
                                  scaleFocused={1.02}
                                  style={[s.epItem, isCurrent && s.epItemActive]}
                                  focusedStyle={s.epItemFocused}
                                >
                                  <View style={[s.epNum, isCurrent && s.epNumActive]}>
                                    <Text style={[s.epNumText, isCurrent && { color: "#000" }]}>
                                      {ep.number}
                                    </Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[s.epName, isCurrent && s.epNameActive]}
                                      numberOfLines={1}
                                    >
                                      {ep.translations?.[0]?.title || `Episodio ${ep.number}`}
                                    </Text>
                                    <Text style={s.epMeta}>
                                      {ep.durationSeconds
                                        ? `${Math.round(ep.durationSeconds / 60)} min`
                                        : `T${se.number} E${ep.number}`}
                                    </Text>
                                  </View>
                                  {isCurrent && (
                                    <View style={s.playingBadge}>
                                      <Text style={s.playingText}>Viendo</Text>
                                    </View>
                                  )}
                                </Focusable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: scale(16), alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: scale(13) }}>
                      Cargando episodios de la serie...
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Lista de Subtítulos */}
            {activeDrawer === "subs" && (
              <ScrollView contentContainerStyle={{ padding: scale(14), gap: scale(8) }}>
                <Focusable
                  hasTVPreferredFocus={drawerFocusReady}
                  onPress={() => {
                    setSelectedSub("off");
                    setActiveDrawer(null);
                    triggerOSD();
                  }}
                  scaleFocused={1.02}
                  style={[s.trackItem, selectedSub === "off" && s.trackItemActive]}
                  focusedStyle={s.trackItemFocused}
                >
                  <Text style={[s.trackText, selectedSub === "off" && { color: C.accent }]}>
                    Desactivados
                  </Text>
                  {selectedSub === "off" && <Check size={scale(15)} color={C.accent} />}
                </Focusable>

                {subsList.map((sub: any, idx: number) => {
                  const key = String(sub.id || sub.url || idx);
                  const isSelected = selectedSub === key;
                  return (
                    <Focusable
                      key={key}
                      onPress={() => {
                        setSelectedSub(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      scaleFocused={1.02}
                      style={[s.trackItem, isSelected && s.trackItemActive]}
                      focusedStyle={s.trackItemFocused}
                    >
                      <Text style={[s.trackText, isSelected && { color: C.accent }]}>
                        {sub.label || sub.language || `Pista ${idx + 1}`}
                      </Text>
                      {isSelected && <Check size={scale(15)} color={C.accent} />}
                    </Focusable>
                  );
                })}
              </ScrollView>
            )}

            {/* Lista de Audios */}
            {activeDrawer === "audio" && (
              <ScrollView contentContainerStyle={{ padding: scale(14), gap: scale(8) }}>
                <Focusable
                  hasTVPreferredFocus={drawerFocusReady}
                  onPress={() => {
                    setSelectedAudio("auto");
                    setActiveDrawer(null);
                    triggerOSD();
                  }}
                  scaleFocused={1.02}
                  style={[s.trackItem, selectedAudio === "auto" && s.trackItemActive]}
                  focusedStyle={s.trackItemFocused}
                >
                  <Text style={[s.trackText, selectedAudio === "auto" && { color: C.accent }]}>
                    Automático (Pista original)
                  </Text>
                  {selectedAudio === "auto" && <Check size={scale(15)} color={C.accent} />}
                </Focusable>

                {audioList.map((aud: any, idx: number) => {
                  const key = String(
                    aud.id || (aud.trackIndex !== undefined ? `index:${aud.trackIndex}` : `index:${idx}`),
                  );
                  const isSelected = selectedAudio === key;
                  return (
                    <Focusable
                      key={key}
                      onPress={() => {
                        setSelectedAudio(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      scaleFocused={1.02}
                      style={[s.trackItem, isSelected && s.trackItemActive]}
                      focusedStyle={s.trackItemFocused}
                    >
                      <Text style={[s.trackText, isSelected && { color: C.accent }]}>
                        {aud.label || aud.language || `Audio ${idx + 1}`}
                      </Text>
                      {isSelected && <Check size={scale(15)} color={C.accent} />}
                    </Focusable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* ── MODAL CONTINUAR VIENDO / SALIR (CON FOCO COMPLETO) ── */}
      {showExitModal && (
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>¿Salir de la reproducción?</Text>
            <Text style={s.modalSub}>
              ¿Deseas continuar viendo este contenido o salir al catálogo?
            </Text>
            <View style={s.modalActions}>
              <Focusable
                hasTVPreferredFocus={exitFocusReady}
                onPress={() => {
                  setShowExitModal(false);
                  triggerOSD();
                }}
                scaleFocused={1.05}
                style={s.modalBtnContinue}
                focusedStyle={s.modalBtnContinueFocused}
              >
                {({ focused }) => (
                  <Text style={[s.modalBtnContinueTxt, focused && { color: "#000" }]}>
                    CONTINUAR VIENDO
                  </Text>
                )}
              </Focusable>

              <Focusable
                onPress={() => router.back()}
                scaleFocused={1.05}
                style={s.modalBtnExit}
                focusedStyle={s.modalBtnExitFocused}
              >
                {({ focused }) => (
                  <Text style={[s.modalBtnExitTxt, focused && { color: "#fff" }]}>
                    SÍ, SALIR
                  </Text>
                )}
              </Focusable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    ...(Platform.OS === "web"
      ? {
          width: "100vw" as any,
          height: "100vh" as any,
          position: "fixed" as any,
          top: 0,
          left: 0,
          zIndex: 9999,
        }
      : {}),
  },
  videoAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  toastHUD: {
    position: "absolute",
    top: scale(48),
    alignSelf: "center",
    backgroundColor: "rgba(10,13,20,0.92)",
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  toastHUDText: {
    color: "#fff",
    fontSize: scale(16),
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  centerOverlay: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  pauseIndicator: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(32),
  },
  errorTitle: {
    fontSize: scale(26),
    fontWeight: "800",
    color: "#f87171",
    marginBottom: scale(8),
    textAlign: "center",
  },
  errorSub: {
    fontSize: scale(16),
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    maxWidth: scale(520),
    marginBottom: scale(24),
  },
  btn: {
    paddingHorizontal: scale(32),
    height: scale(46),
    borderRadius: scale(12),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: scale(15),
  },

  // ── OSD ──
  osdOverlay: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: "space-between",
    zIndex: 30,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: scale(24),
    paddingBottom: scale(18),
    paddingHorizontal: scale(36),
    gap: scale(14),
  },
  topBackBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: "rgba(20,20,26,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },
  topBackBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  title: {
    fontSize: scale(20),
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: scale(12.5),
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
    marginTop: scale(1),
  },

  bottomBar: {
    paddingHorizontal: scale(36),
    paddingBottom: scale(22),
    paddingTop: scale(28),
  },

  // ── Scrubbing Progress Bar (Estilo Netflix TV + Ping-Pong D-Pad) ──
  progressOuterRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginBottom: scale(12),
  },
  pingPongLeft2: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
    position: "absolute",
    left: -20,
  },
  pingPongLeft1: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
    position: "absolute",
    left: -10,
  },
  pingPongRight1: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
    position: "absolute",
    right: -10,
  },
  pingPongRight2: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
    position: "absolute",
    right: -20,
  },
  progressWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    paddingVertical: scale(7),
    paddingHorizontal: scale(10),
    borderRadius: scale(10),
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  progressWrapperFocused: {
    backgroundColor: "rgba(255, 183, 3, 0.08)",
    borderColor: "rgba(255, 183, 3, 0.65)",
  },
  timeText: {
    fontSize: scale(12),
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    fontVariant: ["tabular-nums"],
    width: scale(58),
    textAlign: "center",
  },
  timeTextFocused: {
    color: C.accent,
    fontWeight: "900",
  },
  progressBarTrack: {
    flex: 1,
    height: scale(5),
    borderRadius: scale(3),
    backgroundColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
  },
  progressBarTrackFocused: {
    height: scale(7),
    borderRadius: scale(4),
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  progressBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: C.accent,
    borderRadius: scale(4),
  },
  progressThumb: {
    position: "absolute",
    width: scale(13),
    height: scale(13),
    borderRadius: scale(6.5),
    backgroundColor: C.accent,
    marginLeft: scale(-6.5),
    borderWidth: 2,
    borderColor: "#fff",
  },
  progressThumbFocused: {
    width: scale(19),
    height: scale(19),
    borderRadius: scale(9.5),
    marginLeft: scale(-9.5),
    backgroundColor: C.accent,
    borderWidth: 2.5,
    borderColor: "#fff",
    shadowColor: C.accent,
    shadowRadius: scale(8),
    shadowOpacity: 0.9,
  },
  scrubFloatingPill: {
    position: "absolute",
    bottom: scale(15),
    transform: [{ translateX: -scale(42) }],
    backgroundColor: "rgba(10, 10, 14, 0.94)",
    borderWidth: 1,
    borderColor: C.accent,
    paddingHorizontal: scale(8),
    paddingVertical: scale(2.5),
    borderRadius: scale(8),
  },
  scrubFloatingTxt: {
    color: C.accent,
    fontSize: scale(9.5),
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  // ── Controls Row (3 grupos con el bloque central 100% centrado siempre) ──
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: scale(10),
  },
  sideControlsLeft: {
    flex: 1,
    flexBasis: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: scale(7),
  },
  mainControlsCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    flexShrink: 0,
  },
  sideControlsRight: {
    flex: 1,
    flexBasis: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: scale(7),
    paddingRight: scale(4),
  },

  roundBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: "rgba(18,18,24,0.82)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },
  roundBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  controlActionBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: "rgba(18,18,24,0.82)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },
  controlActionBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  actionTxt: {
    fontSize: scale(8.5),
    fontWeight: "800",
    color: "#fff",
    marginTop: scale(1),
  },

  playBtn: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  playBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: scale(7),
    borderRadius: scale(8),
    backgroundColor: "rgba(18,18,24,0.82)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  menuBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  menuBtnText: {
    fontSize: scale(11),
    fontWeight: "800",
    color: "#fff",
  },

  // ── Sidebar Drawers (Acorde al tema carbón/dorado de NubaTV y más compacto) ──
  sidebarOverlay: {
    ...(StyleSheet.absoluteFill as any),
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.68)",
    zIndex: 50,
  },
  sidebar: {
    width: scale(340),
    height: "100%",
    backgroundColor: "#08080a",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255, 183, 3, 0.22)",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: scale(13),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 183, 3, 0.14)",
  },
  sidebarTitle: {
    fontSize: scale(15),
    fontWeight: "900",
    color: "#fff",
  },
  sidebarSub: {
    fontSize: scale(11),
    fontWeight: "700",
    color: C.accent,
    marginTop: scale(2),
  },
  closeBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: "#14141a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closeBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(12),
    paddingVertical: scale(9),
    borderRadius: scale(8),
    backgroundColor: "#121217",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  seasonHeaderFocused: {
    backgroundColor: "rgba(255, 183, 3, 0.14)",
    borderColor: C.accent,
  },
  seasonTitle: {
    fontSize: scale(12.5),
    fontWeight: "800",
    color: "#fff",
  },
  seasonCount: {
    fontSize: scale(11),
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
  },

  episodesContainer: {
    marginLeft: scale(8),
    paddingLeft: scale(9),
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(255, 183, 3, 0.25)",
    gap: scale(5),
  },
  epItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(9),
    paddingHorizontal: scale(9),
    paddingVertical: scale(7),
    borderRadius: scale(8),
    backgroundColor: "#101015",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.05)",
  },
  epItemActive: {
    backgroundColor: "rgba(255, 183, 3, 0.14)",
    borderColor: "rgba(255, 183, 3, 0.42)",
  },
  epItemFocused: {
    backgroundColor: "#1a1a22",
    borderColor: C.accent,
  },
  epNum: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(6),
    backgroundColor: "#1b1b22",
    alignItems: "center",
    justifyContent: "center",
  },
  epNumActive: {
    backgroundColor: C.accent,
  },
  epNumText: {
    fontSize: scale(11),
    fontWeight: "800",
    color: "#fff",
  },
  epName: {
    fontSize: scale(12),
    fontWeight: "700",
    color: "#f1f5f9",
  },
  epNameActive: {
    color: C.accent,
    fontWeight: "800",
  },
  epMeta: {
    fontSize: scale(10),
    color: "rgba(255,255,255,0.48)",
    marginTop: scale(1),
  },
  playingBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2.5),
    borderRadius: scale(4),
    backgroundColor: C.accent,
  },
  playingText: {
    fontSize: scale(9),
    fontWeight: "900",
    color: "#000",
  },

  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(12),
    paddingVertical: scale(9),
    borderRadius: scale(8),
    backgroundColor: "#101015",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trackItemActive: {
    backgroundColor: "rgba(255, 183, 3, 0.14)",
    borderColor: "rgba(255, 183, 3, 0.42)",
  },
  trackItemFocused: {
    backgroundColor: "#1a1a22",
    borderColor: C.accent,
  },
  trackText: {
    fontSize: scale(12.5),
    fontWeight: "700",
    color: "#fff",
  },

  // ── Exit Modal ──
  modalOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalBox: {
    width: scale(460),
    backgroundColor: "#0c0c10",
    borderRadius: scale(16),
    padding: scale(28),
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.22)",
    alignItems: "center",
    gap: scale(14),
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: scale(24),
    fontWeight: "900",
    color: "#fff",
  },
  modalSub: {
    fontSize: scale(15),
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: scale(22),
    marginBottom: scale(8),
  },
  modalActions: {
    flexDirection: "row",
    gap: scale(16),
    width: "100%",
  },
  modalBtnContinue: {
    flex: 1.2,
    height: scale(50),
    borderRadius: scale(12),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.accent,
  },
  modalBtnContinueFocused: {
    borderColor: "#fff",
    backgroundColor: "#ffc300",
  },
  modalBtnContinueTxt: {
    fontSize: scale(14),
    fontWeight: "900",
    color: "#000",
  },
  modalBtnExit: {
    flex: 1,
    height: scale(50),
    borderRadius: scale(12),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  modalBtnExitFocused: {
    backgroundColor: "#ef4444",
    borderColor: "#fff",
  },
  modalBtnExitTxt: {
    fontSize: scale(14),
    fontWeight: "900",
    color: "#f87171",
  },
  subtitleOverlay: {
    position: "absolute",
    bottom: scale(58),
    left: scale(64),
    right: scale(64),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 45,
  },
  subtitleText: {
    color: "#ffffff",
    fontSize: scale(21),
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: scale(16),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    overflow: "hidden",
    textShadowColor: "#000000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
