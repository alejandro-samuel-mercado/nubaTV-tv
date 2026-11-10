import Video, { SelectedTrackType, VideoRef } from "react-native-video";
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
  Volume1,
  Volume2,
  VolumeX,
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import {
  getContentDetail,
  getWatchStream,
  NexoContentItem,
} from "../../services/nexoplay";
import Focusable from "./Focusable";
import WebPlayer from "./WebPlayer";

const useTVEventHandlerSafe: (handler: (evt: any) => void) => void =
  Platform.OS !== "web"
    ? (require("react-native") as any).useTVEventHandler ?? (() => {})
    : () => {};

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

  // Aspect ratio, volume and audio/subtitle tracks
  const [resizeMode, setResizeMode] = useState<"contain" | "cover">("contain");
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeToast, setVolumeToast] = useState<string | null>(null);
  const volumeToastTimer = useRef<any>(null);

  // OSD & Drawer states
  const [showOSD, setShowOSD] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<"episodes" | "subs" | "audio" | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Track selection
  const [selectedSub, setSelectedSub] = useState<string>("off");
  const [selectedAudio, setSelectedAudio] = useState<number | string>("auto");
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide OSD after 5 seconds of inactivity
  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (!activeDrawer && !showExitModal) {
      osdTimerRef.current = setTimeout(() => {
        setShowOSD(false);
      }, 5500);
    }
  }, [activeDrawer, showExitModal]);

  const hideOSD = useCallback(() => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    setShowOSD(false);
  }, []);

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
    setPositionMillis(0);
    setDurationMillis(1);

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

  // Handle Playback Status Updates
  const handlePlaybackStatusUpdate = useCallback((st: any) => {
    if (st?.isLoaded) {
      setIsPlaying(Boolean(st.isPlaying));
      if (st.positionMillis !== undefined) {
        setPositionMillis(st.positionMillis);
      }
      if (st.durationMillis && st.durationMillis > 0) {
        setDurationMillis(st.durationMillis);
      }
      if (loading && st.positionMillis > 0) {
        setLoading(false);
      }
    }
  }, [loading]);

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

  const seekRelative = useCallback(async (seconds: number) => {
    triggerOSD();
    const vid = videoRef.current as any;
    if (!vid) return;
    const newPos = Math.max(0, Math.min(positionMillis + seconds * 1000, durationMillis || 0));
    setPositionMillis(newPos);
    if (vid.setPositionAsync) await vid.setPositionAsync(newPos);
    else if (vid.seek) vid.seek(newPos / 1000);
  }, [positionMillis, durationMillis, triggerOSD]);

  const restart = useCallback(async () => {
    triggerOSD();
    const vid = videoRef.current as any;
    if (!vid) return;
    setPositionMillis(0);
    if (vid.setPositionAsync) await vid.setPositionAsync(0);
    if (vid.seek) vid.seek(0);
    if (vid.playAsync) await vid.playAsync();
    setIsPlaying(true);
  }, [triggerOSD]);

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

  // Toggle / Step Volume
  const cycleVolume = useCallback(() => {
    triggerOSD();
    if (isMuted) {
      setIsMuted(false);
      showToastHUD(`Volumen: ${Math.round(volume * 100)}%`);
      return;
    }
    if (volume >= 1.0) {
      setVolume(0.75);
      showToastHUD("Volumen: 75%");
    } else if (volume >= 0.7) {
      setVolume(0.5);
      showToastHUD("Volumen: 50%");
    } else if (volume >= 0.45) {
      setVolume(0.25);
      showToastHUD("Volumen: 25%");
    } else if (volume >= 0.2) {
      setIsMuted(true);
      showToastHUD("Volumen: Silencio (Mute)");
    } else {
      setVolume(1.0);
      setIsMuted(false);
      showToastHUD("Volumen: 100%");
    }
  }, [volume, isMuted, triggerOSD]);

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

  // TV D-Pad Events:
  // When OSD is HIDDEN: any press brings up OSD.
  // When OSD is VISIBLE: do NOT hijack left/right/select; let native focus engine navigate!
  useTVEventHandlerSafe((evt: any) => {
    if (!evt || !evt.eventType) return;
    if (activeDrawer || showExitModal) return;

    if (!showOSD) {
      // OSD is hidden -> any interaction displays OSD
      if (
        evt.eventType === "select" ||
        evt.eventType === "up" ||
        evt.eventType === "down" ||
        evt.eventType === "left" ||
        evt.eventType === "right" ||
        evt.eventType === "menu"
      ) {
        triggerOSD();
      } else if (evt.eventType === "playPause") {
        togglePlayPause();
      }
    } else {
      // OSD is open -> reset auto-hide timer on user navigation
      triggerOSD();
      if (evt.eventType === "playPause") {
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

  const audioList = streamData?.audioTracks || [];
  const subsList = streamData?.subtitleTracks || [];

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
            muted={isMuted}
            volume={isMuted ? 0 : volume}
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
            volume={isMuted ? 0 : volume}
            muted={isMuted}
            selectedAudioTrack={
              selectedAudio === "auto"
                ? { type: SelectedTrackType.SYSTEM }
                : { type: SelectedTrackType.INDEX, value: Number(selectedAudio) }
            }
            selectedTextTrack={
              selectedSub === "off"
                ? { type: SelectedTrackType.DISABLED }
                : { type: SelectedTrackType.INDEX, value: Number(selectedSub) }
            }
            paused={!isPlaying}
            onProgress={(data: any) => {
              if (data?.currentTime !== undefined && !isNaN(data.currentTime)) {
                setPositionMillis(data.currentTime * 1000);
              }
              const dur = data?.seekableDuration || data?.duration;
              if (dur && dur > 0 && !isNaN(dur)) {
                setDurationMillis(dur * 1000);
              }
              if (loading) setLoading(false);
            }}
            onLoad={(data: any) => {
              setLoading(false);
              const dur = data?.duration ?? data?.seekableDuration;
              if (dur && dur > 0) {
                setDurationMillis(dur * 1000);
              } else if (content?.duration && durationMillis <= 1000) {
                const fallbackSecs = content.duration > 300 ? content.duration : content.duration * 60;
                setDurationMillis(fallbackSecs * 1000);
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
            <Text style={s.btnText}>Volver al Catálogo</Text>
          </Focusable>
        </View>
      )}

      {/* ── On-Screen Display (OSD) ── */}
      {showOSD && !error && !activeDrawer && (
        <View style={s.osdOverlay} pointerEvents="box-none">
          {/* Top Bar: Back button, Title & Badges */}
          <LinearGradient
            colors={["rgba(5,7,12,0.95)", "rgba(5,7,12,0.5)", "transparent"]}
            style={s.topBar}
            pointerEvents="box-none"
          >
            <Focusable
              onPress={() => setShowExitModal(true)}
              style={s.topBackBtn}
              focusedStyle={s.topBackBtnFocused}
            >
              <ArrowLeft size={scale(22)} color="#fff" />
            </Focusable>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{mainTitle}</Text>
              {!!subTitle && <Text style={s.subTitle} numberOfLines={1}>{subTitle}</Text>}
            </View>
            <View style={s.topBadgesRow}>
              <View style={s.qualityBadge}>
                <Text style={s.qualityBadgeText}>HD</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Bottom Bar: Progress Bar (Above) + Controls Row (Below) */}
          <LinearGradient
            colors={["transparent", "rgba(5,7,12,0.6)", "rgba(5,7,12,0.98)"]}
            style={s.bottomBar}
            pointerEvents="box-none"
          >
            {/* 1. PROGRESS BAR (Posicionada arriba de los controles, nunca superpuesta) */}
            <Focusable
              onPress={() => triggerOSD()}
              onFocus={triggerOSD}
              style={s.progressWrapper}
              focusedStyle={s.progressWrapperFocused}
            >
              <Text style={s.timeText}>{fmtTime(positionMillis)}</Text>
              <View style={s.progressBarTrack}>
                <View style={[s.progressBarFill, { width: `${progressPercent}%` }]} />
                <View style={[s.progressThumb, { left: `${progressPercent}%` }]} />
              </View>
              <Text style={s.timeText}>{fmtTime(durationMillis)}</Text>
            </Focusable>

            {/* 2. CONTROLS ROW (Diseño profesional de 3 grupos alineados) */}
            <View style={s.controlsRow}>
              {/* Grupo Izquierdo: Ventana de Episodios, Subtítulos y Audio */}
              <View style={s.sideControlsLeft}>
                {isSeries && (
                  <Focusable
                    onPress={() => {
                      setActiveDrawer("episodes");
                      hideOSD();
                    }}
                    style={s.menuBtn}
                    focusedStyle={s.menuBtnFocused}
                  >
                    <List size={scale(18)} color="#fff" />
                    <Text style={s.menuBtnText}>Episodios</Text>
                  </Focusable>
                )}

                <Focusable
                  onPress={() => {
                    setActiveDrawer("subs");
                    hideOSD();
                  }}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  <MessageSquare size={scale(18)} color="#fff" />
                  <Text style={s.menuBtnText}>Subtítulos</Text>
                </Focusable>

                <Focusable
                  onPress={() => {
                    setActiveDrawer("audio");
                    hideOSD();
                  }}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  <Languages size={scale(18)} color="#fff" />
                  <Text style={s.menuBtnText}>Audio</Text>
                </Focusable>
              </View>

              {/* Grupo Central: Reproducción, Salto 10s y Navegación de Episodio */}
              <View style={s.mainControlsCenter}>
                <Focusable
                  onPress={restart}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  <RotateCcw size={scale(20)} color="#fff" />
                  <Text style={s.actionTxt}>Reiniciar</Text>
                </Focusable>

                <Focusable
                  onPress={() => seekRelative(-10)}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  <RotateCcw size={scale(22)} color="#fff" />
                  <Text style={s.actionTxt}>-10s</Text>
                </Focusable>

                {hasPrev && (
                  <Focusable
                    onPress={goPrev}
                    style={s.roundBtn}
                    focusedStyle={s.roundBtnFocused}
                  >
                    <SkipBack size={scale(22)} color="#fff" />
                  </Focusable>
                )}

                {/* Botón Principal PLAY/PAUSE */}
                <Focusable
                  hasTVPreferredFocus
                  onPress={togglePlayPause}
                  scaleFocused={1.12}
                  style={s.playBtn}
                  focusedStyle={s.playBtnFocused}
                >
                  {isPlaying ? (
                    <Pause size={scale(32)} color="#000" fill="#000" />
                  ) : (
                    <Play
                      size={scale(32)}
                      color="#000"
                      fill="#000"
                      style={{ marginLeft: scale(4) }}
                    />
                  )}
                </Focusable>

                {hasNext && (
                  <Focusable
                    onPress={goNext}
                    style={s.roundBtn}
                    focusedStyle={s.roundBtnFocused}
                  >
                    <SkipForward size={scale(22)} color="#fff" />
                  </Focusable>
                )}

                <Focusable
                  onPress={() => seekRelative(10)}
                  style={s.controlActionBtn}
                  focusedStyle={s.controlActionBtnFocused}
                >
                  <RotateCw size={scale(22)} color="#fff" />
                  <Text style={s.actionTxt}>+10s</Text>
                </Focusable>
              </View>

              {/* Grupo Derecho: Tamaño de pantalla (aspect ratio) y Control de Volumen */}
              <View style={s.sideControlsRight}>
                <Focusable
                  onPress={toggleResizeMode}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  {resizeMode === "cover" ? (
                    <Minimize size={scale(18)} color="#fff" />
                  ) : (
                    <Maximize2 size={scale(18)} color="#fff" />
                  )}
                  <Text style={s.menuBtnText}>
                    {resizeMode === "cover" ? "Llenar" : "Ajustar"}
                  </Text>
                </Focusable>

                <Focusable
                  onPress={cycleVolume}
                  style={s.menuBtn}
                  focusedStyle={s.menuBtnFocused}
                >
                  {isMuted ? (
                    <VolumeX size={scale(18)} color="#f87171" />
                  ) : volume <= 0.5 ? (
                    <Volume1 size={scale(18)} color="#fff" />
                  ) : (
                    <Volume2 size={scale(18)} color="#fff" />
                  )}
                  <Text style={s.menuBtnText}>
                    {isMuted ? "Mute" : `${Math.round(volume * 100)}%`}
                  </Text>
                </Focusable>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* ── RIGHT SIDEBAR DRAWERS (EPISODIOS / SUBS / AUDIO) ── */}
      {activeDrawer && (
        <View style={s.sidebarOverlay}>
          <Focusable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setActiveDrawer(null);
              triggerOSD();
            }}
          />
          <View style={s.sidebar}>
            <LinearGradient
              colors={["rgba(10,13,20,0.98)", "rgba(8,10,16,0.96)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.sidebarHeader}>
              <View>
                <Text style={s.sidebarTitle}>
                  {activeDrawer === "episodes"
                    ? "Episodios y Temporadas"
                    : activeDrawer === "subs"
                    ? "Subtítulos"
                    : "Pistas de Audio"}
                </Text>
                <Text style={s.sidebarSub}>{mainTitle}</Text>
              </View>
              <Focusable
                onPress={() => {
                  setActiveDrawer(null);
                  triggerOSD();
                }}
                style={s.closeBtn}
                focusedStyle={s.closeBtnFocused}
              >
                <X size={scale(20)} color="#fff" />
              </Focusable>
            </View>

            {/* Lista de Episodios */}
            {activeDrawer === "episodes" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }}>
                {content?.seasons && content.seasons.length > 0 ? (
                  content.seasons.map((se: any, sIdx: number) => {
                    const isExpanded = Boolean(expandedSeasons[se.number]);
                    return (
                      <View key={se.id || sIdx} style={{ gap: scale(8) }}>
                        <Focusable
                          onPress={() =>
                            setExpandedSeasons((prev) => ({
                              ...prev,
                              [se.number]: !prev[se.number],
                            }))
                          }
                          style={s.seasonHeader}
                          focusedStyle={s.seasonHeaderFocused}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: scale(10) }}>
                            {isExpanded ? (
                              <ChevronDown size={scale(18)} color="#fff" />
                            ) : (
                              <ChevronRight size={scale(18)} color="#fff" />
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
                                  style={[s.epItem, isCurrent && s.epItemActive]}
                                  focusedStyle={s.epItemFocused}
                                >
                                  <View style={[s.epNum, isCurrent && s.epNumActive]}>
                                    <Text style={s.epNumText}>{ep.number}</Text>
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
                  <View style={{ padding: scale(20), alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: scale(15) }}>
                      Cargando episodios de la serie...
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Lista de Subtítulos */}
            {activeDrawer === "subs" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
                <Focusable
                  hasTVPreferredFocus
                  onPress={() => {
                    setSelectedSub("off");
                    setActiveDrawer(null);
                    triggerOSD();
                  }}
                  style={[s.trackItem, selectedSub === "off" && s.trackItemActive]}
                  focusedStyle={s.trackItemFocused}
                >
                  <Text style={s.trackText}>Desactivados</Text>
                  {selectedSub === "off" && <Check size={scale(18)} color={C.accent} />}
                </Focusable>

                {subsList.map((sub: any, idx: number) => {
                  const key = String(sub.url || idx);
                  const isSelected = selectedSub === key;
                  return (
                    <Focusable
                      key={key}
                      onPress={() => {
                        setSelectedSub(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      style={[s.trackItem, isSelected && s.trackItemActive]}
                      focusedStyle={s.trackItemFocused}
                    >
                      <Text style={s.trackText}>
                        {sub.label || sub.language || `Pista ${idx + 1}`}
                      </Text>
                      {isSelected && <Check size={scale(18)} color={C.accent} />}
                    </Focusable>
                  );
                })}
              </ScrollView>
            )}

            {/* Lista de Audios */}
            {activeDrawer === "audio" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
                <Focusable
                  hasTVPreferredFocus
                  onPress={() => {
                    setSelectedAudio("auto");
                    setActiveDrawer(null);
                    triggerOSD();
                  }}
                  style={[s.trackItem, selectedAudio === "auto" && s.trackItemActive]}
                  focusedStyle={s.trackItemFocused}
                >
                  <Text style={s.trackText}>Automático (Pista original)</Text>
                  {selectedAudio === "auto" && <Check size={scale(18)} color={C.accent} />}
                </Focusable>

                {audioList.map((aud: any, idx: number) => {
                  const key = aud.trackIndex !== undefined ? aud.trackIndex : idx;
                  const isSelected = selectedAudio === key;
                  return (
                    <Focusable
                      key={key}
                      onPress={() => {
                        setSelectedAudio(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      style={[s.trackItem, isSelected && s.trackItemActive]}
                      focusedStyle={s.trackItemFocused}
                    >
                      <Text style={s.trackText}>
                        {aud.label || aud.language || `Audio ${idx + 1}`}
                      </Text>
                      {isSelected && <Check size={scale(18)} color={C.accent} />}
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
                hasTVPreferredFocus
                onPress={() => {
                  setShowExitModal(false);
                  triggerOSD();
                }}
                scaleFocused={1.05}
                style={s.modalBtnContinue}
                focusedStyle={s.modalBtnContinueFocused}
              >
                <Text style={s.modalBtnContinueTxt}>CONTINUAR VIENDO</Text>
              </Focusable>

              <Focusable
                onPress={() => router.back()}
                scaleFocused={1.05}
                style={s.modalBtnExit}
                focusedStyle={s.modalBtnExitFocused}
              >
                <Text style={s.modalBtnExitTxt}>SÍ, SALIR</Text>
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
    paddingTop: scale(36),
    paddingBottom: scale(24),
    paddingHorizontal: scale(48),
    gap: scale(20),
  },
  topBackBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  topBackBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  title: {
    fontSize: scale(26),
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: scale(15),
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginTop: scale(2),
  },
  topBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  qualityBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  qualityBadgeText: {
    color: "#fff",
    fontSize: scale(12),
    fontWeight: "900",
  },

  bottomBar: {
    paddingHorizontal: scale(48),
    paddingBottom: scale(32),
    paddingTop: scale(40),
  },

  // ── Scrubbing Progress Bar ──
  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(14),
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: scale(20),
  },
  progressWrapperFocused: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: C.accent,
  },
  timeText: {
    fontSize: scale(15),
    fontWeight: "800",
    color: "#fff",
    fontVariant: ["tabular-nums"],
    width: scale(72),
    textAlign: "center",
  },
  progressBarTrack: {
    flex: 1,
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
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
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: "#fff",
    marginLeft: scale(-9),
    borderWidth: 2,
    borderColor: C.accent,
  },

  // ── Controls Row ──
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sideControlsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    minWidth: scale(300),
  },
  mainControlsCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
  },
  sideControlsRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: scale(12),
    minWidth: scale(300),
  },

  roundBtn: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  roundBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  controlActionBtn: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  controlActionBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  actionTxt: {
    fontSize: scale(11),
    fontWeight: "800",
    color: "#fff",
    marginTop: scale(2),
  },

  playBtn: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  playBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  menuBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },
  menuBtnText: {
    fontSize: scale(14),
    fontWeight: "800",
    color: "#fff",
  },

  // ── Sidebar Drawers ──
  sidebarOverlay: {
    ...(StyleSheet.absoluteFill as any),
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 50,
  },
  sidebar: {
    width: scale(480),
    height: "100%",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.12)",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: scale(28),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sidebarTitle: {
    fontSize: scale(22),
    fontWeight: "900",
    color: "#fff",
  },
  sidebarSub: {
    fontSize: scale(14),
    color: "rgba(255,255,255,0.6)",
    marginTop: scale(2),
  },
  closeBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  closeBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#fff",
  },

  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  seasonHeaderFocused: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: C.accent,
  },
  seasonTitle: {
    fontSize: scale(16),
    fontWeight: "800",
    color: "#fff",
  },
  seasonCount: {
    fontSize: scale(13),
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },

  episodesContainer: {
    marginLeft: scale(12),
    paddingLeft: scale(12),
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255,255,255,0.15)",
    gap: scale(8),
  },
  epItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    padding: scale(12),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  epItemActive: {
    backgroundColor: "rgba(255,183,3,0.12)",
    borderColor: "rgba(255,183,3,0.35)",
  },
  epItemFocused: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: C.accent,
  },
  epNum: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  epNumActive: {
    backgroundColor: C.accent,
  },
  epNumText: {
    fontSize: scale(14),
    fontWeight: "800",
    color: "#fff",
  },
  epName: {
    fontSize: scale(15),
    fontWeight: "700",
    color: "#fff",
  },
  epNameActive: {
    color: C.accent,
    fontWeight: "900",
  },
  epMeta: {
    fontSize: scale(12),
    color: "rgba(255,255,255,0.5)",
    marginTop: scale(2),
  },
  playingBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    backgroundColor: C.accent,
  },
  playingText: {
    fontSize: scale(11),
    fontWeight: "900",
    color: "#000",
  },

  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: scale(16),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  trackItemActive: {
    backgroundColor: "rgba(255,183,3,0.12)",
    borderColor: "rgba(255,183,3,0.3)",
  },
  trackItemFocused: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: C.accent,
  },
  trackText: {
    fontSize: scale(16),
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
    width: scale(520),
    backgroundColor: "#131722",
    borderRadius: scale(20),
    padding: scale(36),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    gap: scale(16),
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
});
