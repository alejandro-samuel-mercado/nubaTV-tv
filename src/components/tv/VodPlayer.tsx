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
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
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
  Platform,
  Pressable,
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
import WebPlayer, { WebPlayerHandle } from "./WebPlayer";

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

  // OSD & Drawer states
  const [showOSD, setShowOSD] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<"episodes" | "subs" | "audio" | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Track selection
  const [selectedSub, setSelectedSub] = useState<string>("off");
  const [selectedAudio, setSelectedAudio] = useState<number | string>("auto");
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide OSD
  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (!activeDrawer && !showExitModal) {
      osdTimerRef.current = setTimeout(() => {
        setShowOSD(false);
      }, 5000);
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

      // If no initial episode is passed and content is a series, select S1 E1
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

  // Controls
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
    if (vid.playAsync) await vid.playAsync();
    setIsPlaying(true);
  }, [triggerOSD]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    const nextEp = allEpisodes[currentIdx + 1];
    if (nextEp?.id) {
      setCurrentEpisodeId(nextEp.id);
    }
  }, [hasNext, allEpisodes, currentIdx]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    const prevEp = allEpisodes[currentIdx - 1];
    if (prevEp?.id) {
      setCurrentEpisodeId(prevEp.id);
    }
  }, [hasPrev, allEpisodes, currentIdx]);

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

  // TV D-Pad Events
  useTVEventHandlerSafe((evt: any) => {
    if (!evt || !evt.eventType) return;
    if (activeDrawer || showExitModal) return;

    if (evt.eventType === "select") {
      if (!showOSD) {
        triggerOSD();
      } else {
        togglePlayPause();
      }
    } else if (evt.eventType === "left") {
      seekRelative(-10);
    } else if (evt.eventType === "right") {
      seekRelative(10);
    } else if (evt.eventType === "up" || evt.eventType === "down") {
      triggerOSD();
    } else if (evt.eventType === "playPause") {
      togglePlayPause();
    }
  });

  const progressPercent = durationMillis > 1000
    ? Math.max(0, Math.min(100, (positionMillis / durationMillis) * 100))
    : 0;

  // Title and subtitle labels
  const mainTitle = content?.title || streamData?.title || "Reproduciendo";
  const subTitle = currentEpisode
    ? `Temporada ${currentEpisode.seasonNumber} • Episodio ${currentEpisode.number}${
        currentEpisode.translations?.[0]?.title ? ` - ${currentEpisode.translations[0].title}` : ""
      }`
    : content?.releaseYear
    ? `${content.releaseYear}${content.duration ? ` • ${Math.round(content.duration / 60)} min` : ""}`
    : "";

  const audioList = streamData?.audioTracks || [];
  const subsList = streamData?.subtitleTracks || [];

  return (
    <View style={s.container}>
      {/* ── Background Video Layer ── */}
      {streamData?.url ? (
        Platform.OS === "web" ? (
          <WebPlayer
            ref={videoRef as any}
            uri={streamData.url}
            fallbackUri={streamData.url}
            controls={false}
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
            resizeMode="contain"
            paused={!isPlaying}
            onProgress={(data: any) => {
              if (data?.currentTime !== undefined) {
                setPositionMillis(data.currentTime * 1000);
              }
              if (data?.seekableDuration > 0) {
                setDurationMillis(data.seekableDuration * 1000);
              }
              if (loading) setLoading(false);
            }}
            onLoad={(data: any) => {
              setLoading(false);
              if (data?.duration > 0) {
                setDurationMillis(data.duration * 1000);
              }
            }}
            onBuffer={({ isBuffering }: { isBuffering: boolean }) => {
              setLoading(isBuffering);
            }}
            onError={(err: any) => {
              console.warn("[VodPlayer] Native error:", err);
              setError(true);
              setErrorMessage("Error de reproducción en el dispositivo.");
            }}
            onEnd={() => {
              if (hasNext) goNext();
            }}
          />
        )
      ) : null}

      {/* ── Loading Spinner ── */}
      {loading && !error && (
        <View style={s.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      )}

      {/* ── Center Pause Indicator ── */}
      {!isPlaying && !loading && !error && (
        <View style={s.centerOverlay} pointerEvents="none">
          <View style={s.pauseIndicator}>
            <Pause size={scale(48)} color="#fff" fill="#fff" />
          </View>
        </View>
      )}

      {/* ── Error Screen ── */}
      {error && (
        <View style={s.errorContainer}>
          <AlertCircle size={scale(54)} color="#f87171" style={{ marginBottom: scale(16) }} />
          <Text style={s.errorTitle}>Error al cargar el video</Text>
          <Text style={s.errorSub}>{errorMessage || "No se pudo conectar a la fuente."}</Text>
          <Pressable
            focusable
            hasTVPreferredFocus
            onPress={() => router.back()}
            style={({ focused }: any) => [s.btn, focused && s.btnFocused]}
          >
            {({ focused }: any) => (
              <Text style={[s.btnText, focused && s.btnTextFocused]}>Volver</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ── On-Screen Display (OSD) ── */}
      {showOSD && !error && !activeDrawer && (
        <View style={s.osdOverlay} pointerEvents="box-none">
          {/* Top Bar */}
          <LinearGradient
            colors={["rgba(0,0,0,0.92)", "transparent"]}
            style={s.topBar}
            pointerEvents="box-none"
          >
            <Pressable
              focusable
              onPress={() => setShowExitModal(true)}
              style={({ focused }: any) => [s.roundBtn, focused && s.roundBtnFocused]}
            >
              {({ focused }: any) => (
                <ArrowLeft size={scale(22)} color={focused ? "#000" : "#fff"} />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{mainTitle}</Text>
              {!!subTitle && <Text style={s.subTitle} numberOfLines={1}>{subTitle}</Text>}
            </View>
          </LinearGradient>

          {/* Bottom Bar */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.95)"]}
            style={s.bottomBar}
            pointerEvents="box-none"
          >
            <View style={s.controlsRow}>
              {/* Left Drawers */}
              <View style={s.sideControls}>
                {content?.seasons && content.seasons.length > 0 && (
                  <Pressable
                    focusable
                    onPress={() => {
                      setActiveDrawer("episodes");
                      hideOSD();
                    }}
                    style={({ focused }: any) => [s.menuBtn, focused && s.menuBtnFocused]}
                  >
                    {({ focused }: any) => (
                      <>
                        <List size={scale(18)} color={focused ? "#000" : "#fff"} />
                        <Text style={[s.menuBtnText, focused && s.menuBtnTextFocused]}>Episodios</Text>
                      </>
                    )}
                  </Pressable>
                )}

                {subsList.length > 0 && (
                  <Pressable
                    focusable
                    onPress={() => {
                      setActiveDrawer("subs");
                      hideOSD();
                    }}
                    style={({ focused }: any) => [s.menuBtn, focused && s.menuBtnFocused]}
                  >
                    {({ focused }: any) => (
                      <>
                        <MessageSquare size={scale(18)} color={focused ? "#000" : "#fff"} />
                        <Text style={[s.menuBtnText, focused && s.menuBtnTextFocused]}>Subtítulos</Text>
                      </>
                    )}
                  </Pressable>
                )}

                {audioList.length > 0 && (
                  <Pressable
                    focusable
                    onPress={() => {
                      setActiveDrawer("audio");
                      hideOSD();
                    }}
                    style={({ focused }: any) => [s.menuBtn, focused && s.menuBtnFocused]}
                  >
                    {({ focused }: any) => (
                      <>
                        <Languages size={scale(18)} color={focused ? "#000" : "#fff"} />
                        <Text style={[s.menuBtnText, focused && s.menuBtnTextFocused]}>Audio</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Center Controls */}
              <View style={s.mainControls}>
                {hasPrev && (
                  <Pressable
                    focusable
                    onPress={goPrev}
                    style={({ focused }: any) => [s.roundBtn, focused && s.roundBtnFocused]}
                  >
                    {({ focused }: any) => (
                      <SkipBack size={scale(22)} color={focused ? "#000" : "#fff"} />
                    )}
                  </Pressable>
                )}

                <Pressable
                  focusable
                  onPress={restart}
                  style={({ focused }: any) => [s.controlActionBtn, focused && s.controlActionBtnFocused]}
                >
                  {({ focused }: any) => (
                    <>
                      <RefreshCw size={scale(20)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && s.actionTxtFocused]}>Reiniciar</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  focusable
                  onPress={() => seekRelative(-10)}
                  style={({ focused }: any) => [s.controlActionBtn, focused && s.controlActionBtnFocused]}
                >
                  {({ focused }: any) => (
                    <>
                      <RotateCcw size={scale(22)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && s.actionTxtFocused]}>10s</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  focusable
                  hasTVPreferredFocus
                  onPress={togglePlayPause}
                  style={({ focused }: any) => [s.playBtn, focused && s.playBtnFocused]}
                >
                  {({ focused }: any) =>
                    isPlaying ? (
                      <Pause size={scale(32)} color={focused ? "#000" : "#000"} fill="#000" />
                    ) : (
                      <Play
                        size={scale(32)}
                        color={focused ? "#000" : "#000"}
                        fill="#000"
                        style={{ marginLeft: scale(4) }}
                      />
                    )
                  }
                </Pressable>

                <Pressable
                  focusable
                  onPress={() => seekRelative(10)}
                  style={({ focused }: any) => [s.controlActionBtn, focused && s.controlActionBtnFocused]}
                >
                  {({ focused }: any) => (
                    <>
                      <RotateCw size={scale(22)} color={focused ? "#000" : "#fff"} />
                      <Text style={[s.actionTxt, focused && s.actionTxtFocused]}>10s</Text>
                    </>
                  )}
                </Pressable>

                {hasNext && (
                  <Pressable
                    focusable
                    onPress={goNext}
                    style={({ focused }: any) => [s.roundBtn, focused && s.roundBtnFocused]}
                  >
                    {({ focused }: any) => (
                      <SkipForward size={scale(22)} color={focused ? "#000" : "#fff"} />
                    )}
                  </Pressable>
                )}
              </View>

              {/* Right Spacer for balance */}
              <View style={s.sideControls} />
            </View>

            {/* Focusable Scrubbing Progress Bar */}
            <Pressable
              focusable
              onPress={() => triggerOSD()}
              style={({ focused }: any) => [s.progressWrapper, focused && s.progressWrapperFocused]}
            >
              <Text style={s.timeText}>{fmtTime(positionMillis)}</Text>
              <View style={s.progressBarTrack}>
                <View style={[s.progressBarFill, { width: `${progressPercent}%` }]} />
                <View style={[s.progressThumb, { left: `${progressPercent}%` }]} />
              </View>
              <Text style={s.timeText}>{fmtTime(durationMillis)}</Text>
            </Pressable>
          </LinearGradient>
        </View>
      )}

      {/* ── RIGHT SIDEBAR DRAWERS ── */}
      {activeDrawer && (
        <View style={s.sidebarOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setActiveDrawer(null);
              triggerOSD();
            }}
          />
          <View style={s.sidebar}>
            <LinearGradient
              colors={["rgba(10,12,18,0.98)", "rgba(10,12,18,0.95)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.sidebarHeader}>
              <Text style={s.sidebarTitle}>
                {activeDrawer === "episodes"
                  ? "Episodios"
                  : activeDrawer === "subs"
                  ? "Subtítulos"
                  : "Audio e Idioma"}
              </Text>
              <Pressable
                focusable
                onPress={() => {
                  setActiveDrawer(null);
                  triggerOSD();
                }}
                style={({ focused }: any) => [s.closeBtn, focused && s.closeBtnFocused]}
              >
                <X size={scale(20)} color="#fff" />
              </Pressable>
            </View>

            {/* Episodes List */}
            {activeDrawer === "episodes" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }}>
                {content?.seasons?.map((se: any, sIdx: number) => {
                  const isExpanded = Boolean(expandedSeasons[se.number]);
                  return (
                    <View key={se.id || sIdx} style={{ gap: scale(8) }}>
                      {/* Season Accordion Header */}
                      <Pressable
                        focusable
                        onPress={() =>
                          setExpandedSeasons((prev) => ({
                            ...prev,
                            [se.number]: !prev[se.number],
                          }))
                        }
                        style={({ focused }: any) => [
                          s.seasonHeader,
                          focused && s.seasonHeaderFocused,
                        ]}
                      >
                        {({ focused }: any) => (
                          <>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: scale(10) }}>
                              {isExpanded ? (
                                <ChevronDown size={scale(18)} color={focused ? "#000" : "#fff"} />
                              ) : (
                                <ChevronRight size={scale(18)} color={focused ? "#000" : "#fff"} />
                              )}
                              <Text
                                style={[s.seasonTitle, focused && s.seasonTitleFocused]}
                              >
                                Temporada {se.number}
                              </Text>
                            </View>
                            <Text style={[s.seasonCount, focused && s.seasonCountFocused]}>
                              {se.episodes?.length || 0} ep.
                            </Text>
                          </>
                        )}
                      </Pressable>

                      {/* Episode items */}
                      {isExpanded && (
                        <View style={s.episodesContainer}>
                          {se.episodes?.map((ep: any) => {
                            const isCurrent = String(ep.id) === String(currentEpisodeId);
                            return (
                              <Pressable
                                key={ep.id}
                                focusable
                                onPress={() => {
                                  setCurrentEpisodeId(ep.id);
                                  setActiveDrawer(null);
                                  triggerOSD();
                                }}
                                style={({ focused }: any) => [
                                  s.epItem,
                                  isCurrent && s.epItemActive,
                                  focused && s.epItemFocused,
                                ]}
                              >
                                {({ focused }: any) => (
                                  <>
                                    <View
                                      style={[
                                        s.epNum,
                                        isCurrent && s.epNumActive,
                                        focused && s.epNumFocused,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          s.epNumText,
                                          focused && s.epNumTextFocused,
                                        ]}
                                      >
                                        {ep.number}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text
                                        style={[
                                          s.epName,
                                          isCurrent && s.epNameActive,
                                          focused && s.epNameFocused,
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {ep.translations?.[0]?.title || `Episodio ${ep.number}`}
                                      </Text>
                                      <Text style={[s.epMeta, focused && s.epMetaFocused]}>
                                        {ep.durationSeconds
                                          ? `${Math.round(ep.durationSeconds / 60)} min`
                                          : `T${se.number} E${ep.number}`}
                                      </Text>
                                    </View>
                                    {isCurrent && (
                                      <View
                                        style={[
                                          s.playingBadge,
                                          focused && s.playingBadgeFocused,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            s.playingText,
                                            focused && s.playingTextFocused,
                                          ]}
                                        >
                                          Viendo
                                        </Text>
                                      </View>
                                    )}
                                  </>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Subtitles List */}
            {activeDrawer === "subs" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
                <Pressable
                  focusable
                  onPress={() => {
                    setSelectedSub("off");
                    setActiveDrawer(null);
                    triggerOSD();
                  }}
                  style={({ focused }: any) => [
                    s.trackItem,
                    selectedSub === "off" && s.trackItemActive,
                    focused && s.trackItemFocused,
                  ]}
                >
                  {({ focused }: any) => (
                    <>
                      <Text style={[s.trackText, focused && s.trackTextFocused]}>
                        Desactivados
                      </Text>
                      {selectedSub === "off" && (
                        <Check size={scale(18)} color={focused ? "#000" : C.accent} />
                      )}
                    </>
                  )}
                </Pressable>

                {subsList.map((sub: any, idx: number) => {
                  const key = String(sub.url || idx);
                  const isSelected = selectedSub === key;
                  return (
                    <Pressable
                      key={key}
                      focusable
                      onPress={() => {
                        setSelectedSub(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      style={({ focused }: any) => [
                        s.trackItem,
                        isSelected && s.trackItemActive,
                        focused && s.trackItemFocused,
                      ]}
                    >
                      {({ focused }: any) => (
                        <>
                          <Text style={[s.trackText, focused && s.trackTextFocused]}>
                            {sub.label || sub.language || `Pista ${idx + 1}`}
                          </Text>
                          {isSelected && (
                            <Check size={scale(18)} color={focused ? "#000" : C.accent} />
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Audio List */}
            {activeDrawer === "audio" && (
              <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
                {audioList.map((aud: any, idx: number) => {
                  const key = aud.trackIndex !== undefined ? aud.trackIndex : idx;
                  const isSelected =
                    selectedAudio === key || (selectedAudio === "auto" && aud.isDefault);
                  return (
                    <Pressable
                      key={key}
                      focusable
                      onPress={() => {
                        setSelectedAudio(key);
                        setActiveDrawer(null);
                        triggerOSD();
                      }}
                      style={({ focused }: any) => [
                        s.trackItem,
                        isSelected && s.trackItemActive,
                        focused && s.trackItemFocused,
                      ]}
                    >
                      {({ focused }: any) => (
                        <>
                          <Text style={[s.trackText, focused && s.trackTextFocused]}>
                            {aud.label || aud.language || `Audio ${idx + 1}`}
                          </Text>
                          {isSelected && (
                            <Check size={scale(18)} color={focused ? "#000" : C.accent} />
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* ── EXIT CONFIRMATION MODAL ── */}
      {showExitModal && (
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>¿Salir del reproductor?</Text>
            <Text style={s.modalSub}>
              ¿Deseas detener la reproducción y regresar a la pantalla anterior?
            </Text>
            <View style={s.modalActions}>
              <Pressable
                focusable
                hasTVPreferredFocus
                onPress={() => {
                  setShowExitModal(false);
                  triggerOSD();
                }}
                style={({ focused }: any) => [s.modalBtn, focused && s.modalBtnFocused]}
              >
                {({ focused }: any) => (
                  <Text style={[s.modalBtnTxt, focused && s.modalBtnTxtFocused]}>
                    CONTINUAR VIENDO
                  </Text>
                )}
              </Pressable>

              <Pressable
                focusable
                onPress={() => router.back()}
                style={({ focused }: any) => [
                  s.modalBtn,
                  s.modalBtnDestructive,
                  focused && s.modalBtnDestructiveFocused,
                ]}
              >
                {({ focused }: any) => (
                  <Text
                    style={[
                      s.modalBtnTxt,
                      s.modalBtnTxtDestructive,
                      focused && s.modalBtnTxtDestructiveFocused,
                    ]}
                  >
                    SÍ, SALIR
                  </Text>
                )}
              </Pressable>
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
    backgroundColor: "rgba(0,0,0,0.6)",
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
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.05 }],
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: scale(15),
  },
  btnTextFocused: {
    color: "#000",
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
    paddingTop: scale(40),
    paddingBottom: scale(28),
    paddingHorizontal: scale(48),
    gap: scale(20),
  },
  title: {
    fontSize: scale(28),
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: scale(16),
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    marginTop: scale(4),
  },

  bottomBar: {
    paddingHorizontal: scale(48),
    paddingBottom: scale(36),
    paddingTop: scale(50),
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: scale(24),
  },
  sideControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    minWidth: scale(260),
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
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
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.1 }],
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
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.1 }],
  },
  actionTxt: {
    fontSize: scale(11),
    fontWeight: "700",
    color: "#fff",
    marginTop: scale(2),
  },
  actionTxtFocused: {
    color: "#000",
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
    borderColor: C.accent,
    transform: [{ scale: 1.15 }],
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
    backgroundColor: "#fff",
    borderColor: C.accent,
  },
  menuBtnText: {
    fontSize: scale(14),
    fontWeight: "700",
    color: "#fff",
  },
  menuBtnTextFocused: {
    color: "#000",
  },

  // ── Scrubbing Progress Bar ──
  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: "transparent",
  },
  progressWrapperFocused: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  timeText: {
    fontSize: scale(15),
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    fontVariant: ["tabular-nums"],
    width: scale(72),
    textAlign: "center",
  },
  progressBarTrack: {
    flex: 1,
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: "rgba(255,255,255,0.22)",
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
    width: scale(460),
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
  closeBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnFocused: {
    backgroundColor: C.accent,
  },

  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  seasonHeaderFocused: {
    backgroundColor: "#fff",
    borderColor: C.accent,
  },
  seasonTitle: {
    fontSize: scale(16),
    fontWeight: "800",
    color: "#fff",
  },
  seasonTitleFocused: {
    color: "#000",
  },
  seasonCount: {
    fontSize: scale(13),
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  seasonCountFocused: {
    color: "#000",
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
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.02 }],
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
  epNumFocused: {
    backgroundColor: "#000",
  },
  epNumText: {
    fontSize: scale(14),
    fontWeight: "800",
    color: "#fff",
  },
  epNumTextFocused: {
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
  epNameFocused: {
    color: "#000",
  },
  epMeta: {
    fontSize: scale(12),
    color: "rgba(255,255,255,0.5)",
    marginTop: scale(2),
  },
  epMetaFocused: {
    color: "rgba(0,0,0,0.65)",
  },
  playingBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    backgroundColor: C.accent,
  },
  playingBadgeFocused: {
    backgroundColor: "#000",
  },
  playingText: {
    fontSize: scale(11),
    fontWeight: "900",
    color: "#000",
  },
  playingTextFocused: {
    color: "#fff",
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
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.02 }],
  },
  trackText: {
    fontSize: scale(16),
    fontWeight: "700",
    color: "#fff",
  },
  trackTextFocused: {
    color: "#000",
  },

  // ── Exit Modal ──
  modalOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalBox: {
    width: scale(520),
    backgroundColor: "#16161f",
    borderRadius: scale(20),
    padding: scale(36),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    gap: scale(16),
  },
  modalTitle: {
    fontSize: scale(24),
    fontWeight: "900",
    color: "#fff",
  },
  modalSub: {
    fontSize: scale(15),
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: scale(22),
    marginBottom: scale(8),
  },
  modalActions: {
    flexDirection: "row",
    gap: scale(16),
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    height: scale(48),
    borderRadius: scale(12),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  modalBtnFocused: {
    backgroundColor: "#fff",
    borderColor: C.accent,
    transform: [{ scale: 1.05 }],
  },
  modalBtnTxt: {
    fontSize: scale(14),
    fontWeight: "800",
    color: "#fff",
  },
  modalBtnTxtFocused: {
    color: "#000",
  },
  modalBtnDestructive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  modalBtnDestructiveFocused: {
    backgroundColor: "#ef4444",
    borderColor: "#f87171",
  },
  modalBtnTxtDestructive: {
    color: "#f87171",
  },
  modalBtnTxtDestructiveFocused: {
    color: "#fff",
  },
});
