import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Film,
  Lock,
  LogIn,
  Radio,
  RefreshCw,
  Sparkles,
  User as UserIcon,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Focusable from "../../components/tv/Focusable";
import RemoteImage from "../../components/tv/RemoteImage";
import { API_URL, useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getHomepage } from "../../services/nexoplay";
import { setItemAsync } from "../../utils/storage";

interface PhraseItem {
  tag: string;
  text: string;
}

/* ── Frases de bienvenida / sugerencias (mismas que nubaTV-web, sin timers continuos) ── */
const LOGIN_PHRASES: readonly PhraseItem[] = [
  { tag: "Para hoy", text: "Después de un día intenso, te mereces desconectar con una gran historia." },
  { tag: "Sugerencia", text: "Baja las luces, sube el volumen y deja que la pantalla haga magia esta noche." },
  { tag: "Inspiración", text: "Las mejores historias no solo se miran: se sienten y se quedan contigo." },
  { tag: "Recomendación", text: "¿No sabes qué elegir? Empieza por la fila de Tendencias y déjate sorprender." },
  { tag: "Modo Cine", text: "Prepara algo rico: hoy cualquier sofá puede convertirse en primera fila." },
  { tag: "TV en Vivo", text: "Sintoniza canales en vivo al instante: deportes, noticias y cine sin esperas." },
  { tag: "Recomendación", text: "Guarda en Favoritos todo lo que te llame la atención para armar tu maratón ideal." },
  { tag: "Modo Serie", text: "Cuidado con el clásico «solo un capítulo más»… sabemos cómo termina." },
  { tag: "Anime & Series", text: "Desde mundos épicos de anime hasta thrillers intensos: tú decides el rumbo." },
  { tag: "Sugerencia", text: "Combina TV en directo y películas bajo demanda sin salir de un mismo lugar." },
  { tag: "Modo Maratón", text: "Las mejores noches empiezan sin prisa y con una historia que te atrapa desde el minuto uno." },
  { tag: "Estrenos", text: "Revisa la sección de Estrenos para ver lo último que acaba de llegar al catálogo." },
];

const TILE_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/* ── Fondo estático ultra-optimizado: 0 animaciones, 0 blur, 0 re-renders ── */
const StaticCinemaBackground = memo(function StaticCinemaBackground() {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getHomepage()
      .then((hp) => {
        if (!active) return;
        const raw = [
          ...(hp.heroItems || []),
          ...(hp.trending || []),
          ...(hp.recent || []),
        ];
        const seen = new Set<string>();
        const picked: string[] = [];
        for (const item of raw) {
          const url = item?.backdropUrl || item?.posterUrl;
          if (url && !seen.has(url)) {
            seen.add(url);
            picked.push(url);
            if (picked.length >= 8) break;
          }
        }
        if (picked.length > 0) setImages(picked);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {/* Mosaico estático de 8 banners (sin scroll ni transformaciones 3D) */}
      <View style={s.wallGrid}>
        {TILE_SLOTS.map((slot) => {
          const uri = images[slot];
          return (
            <View key={slot} style={s.wallTile}>
              {uri ? (
                <RemoteImage
                  uri={uri}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  priority="low"
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Viñeta oscura cinematográfica */}
      <LinearGradient
        colors={[
          "rgba(6, 6, 10, 0.92)",
          "rgba(8, 8, 12, 0.72)",
          "rgba(5, 5, 8, 0.96)",
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Tinte cálido superior sutil (reemplaza el glow con blur pesado de web) */}
      <LinearGradient
        colors={["rgba(255, 166, 0, 0.12)", "rgba(255, 85, 0, 0.03)", "transparent"]}
        locations={[0, 0.35, 0.75]}
        style={s.topWarmWash}
      />
    </View>
  );
});

/* ── Barra superior idéntica a nubaTV-web (memoizada) ── */
const LoginTopBar = memo(function LoginTopBar() {
  return (
    <View style={s.topBar} pointerEvents="none">
      <View style={s.brandLockup}>
        <LinearGradient
          colors={["#ffb703", "#fb8500"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.brandMark}
        >
          <Text style={s.brandMarkLetter}>N</Text>
        </LinearGradient>
        <Text style={s.brandText}>
          NUBA<Text style={s.brandTextAccent}>TV</Text>
        </Text>
      </View>

      <View style={s.topPills}>
        <View style={[s.topPill, s.topPillLive]}>
          <View style={s.liveDot} />
          <Radio size={scale(12)} color="#ffd1df" />
          <Text style={[s.topPillText, s.topPillTextLive]}>TV en Vivo</Text>
        </View>
        <View style={s.topPill}>
          <Film size={scale(12)} color="rgba(255,255,255,0.85)" />
          <Text style={s.topPillText}>Películas & Series HD</Text>
        </View>
      </View>
    </View>
  );
});

/* ── Tarjeta de frases motivacionales / sugerencias (sin auto-interval) ── */
const PhraseCard = memo(function PhraseCard() {
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * LOGIN_PHRASES.length),
  );

  const nextPhrase = useCallback(() => {
    setIdx((prev) => (prev + 1) % LOGIN_PHRASES.length);
  }, []);

  const current = LOGIN_PHRASES[idx] || LOGIN_PHRASES[0];

  return (
    <View style={s.phraseCard}>
      <View style={s.phraseTop}>
        <View style={s.phraseTagWrap}>
          <Sparkles size={scale(11)} color={C.accent} />
          <Text style={s.phraseTag}>{current.tag}</Text>
        </View>
        <Focusable
          onPress={nextPhrase}
          style={s.phraseRefreshBtn}
          focusedStyle={s.phraseRefreshBtnFocused}
          hitSlop={8}
        >
          {({ focused }) => (
            <RefreshCw
              size={scale(12)}
              color={focused ? "#09090b" : "rgba(255,255,255,0.65)"}
            />
          )}
        </Focusable>
      </View>
      <Text style={s.phraseText} numberOfLines={3}>
        “{current.text}”
      </Text>
    </View>
  );
});

export default function LoginScreen() {
  const { setToken, setUser } = useGlobal();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const userInputRef = useRef<TextInput>(null);
  const passInputRef = useRef<TextInput>(null);

  const handleLogin = useCallback(async () => {
    if (loading) return;

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError("Por favor ingresa tu usuario y contraseña.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(
        `${API_URL}/auth/login`,
        { username: cleanUser, password },
        { timeout: 12000 },
      );

      const token: string | undefined =
        res.data?.token ?? res.data?.accessToken;

      if (!token) {
        setError("La API no devolvió un token válido.");
        return;
      }

      let resolvedUser = res.data?.user ?? null;
      if (!resolvedUser) {
        try {
          const meRes = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          resolvedUser = meRes.data ?? null;
        } catch {
          // Continuar con el token válido aunque falle /auth/me
        }
      }

      await setItemAsync("token", token);
      setUser(resolvedUser);
      setToken(token);
    } catch (err: any) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 401) {
        setError(apiError || "Usuario o contraseña incorrectos.");
      } else if (status === 403) {
        setError(apiError || "Tu cuenta está inactiva o expirada.");
      } else if (status === 404) {
        setError("El servicio de autenticación no está disponible.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("No se pudo conectar con el servidor. Verifica tu conexión.");
      } else {
        setError(apiError || "Error al iniciar sesión. Verifica tus datos.");
      }
    } finally {
      setLoading(false);
    }
  }, [loading, username, password, setToken, setUser]);

  const toggleShowPass = useCallback(() => {
    setShowPass((prev) => !prev);
  }, []);

  return (
    <View style={s.root}>
      <StaticCinemaBackground />

      <LoginTopBar />

      <KeyboardAvoidingView
        style={s.centerWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.card}>
          {/* Línea superior luminosa estilo nubaTV-web */}
          <LinearGradient
            colors={["transparent", "#ffb703", "#ff5500", "#ff4d80", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.cardTopline}
          />

          <View style={s.cardColumns}>
            {/* ── Columna Izquierda: Identidad + Frase del día ── */}
            <View style={s.leftCol}>
              <View>
                <View style={s.kicker}>
                  <Sparkles size={scale(11)} color={C.accent} />
                  <Text style={s.kickerText}>EXPERIENCIA STREAMING TOTAL</Text>
                </View>

                <Text style={s.heading}>Inicia sesión</Text>
                <Text style={s.subheading}>
                  Todo tu cine, series, anime y canales en directo en un solo lugar.
                </Text>
              </View>

              <PhraseCard />
            </View>

            <View style={s.colDivider} />

            {/* ── Columna Derecha: Formulario optimizado para Control Remoto ── */}
            <View style={s.rightCol}>
              {error ? (
                <View style={s.errorBanner}>
                  <AlertCircle size={scale(15)} color="#ff85a6" />
                  <Text style={s.errorText} numberOfLines={2}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Campo Usuario */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>USUARIO</Text>
                <Focusable
                  hasTVPreferredFocus
                  onPress={() => userInputRef.current?.focus()}
                  onFocus={() => setUserFocused(true)}
                  onBlur={() => setUserFocused(false)}
                  style={[s.inputRow, userFocused && s.inputRowFocused]}
                >
                  <UserIcon
                    size={scale(16)}
                    color={userFocused ? C.accent : "rgba(255,255,255,0.48)"}
                  />
                  <TextInput
                    ref={userInputRef}
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setUserFocused(true)}
                    onBlur={() => setUserFocused(false)}
                    onSubmitEditing={() => passInputRef.current?.focus()}
                    placeholder="Ingresa tu usuario"
                    placeholderTextColor="rgba(255,255,255,0.34)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    style={s.textInput}
                  />
                </Focusable>
              </View>

              {/* Campo Contraseña */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>CONTRASEÑA</Text>
                <View style={[s.inputRow, passFocused && s.inputRowFocused]}>
                  <Focusable
                    onPress={() => passInputRef.current?.focus()}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    style={s.passInputFlex}
                  >
                    <Lock
                      size={scale(16)}
                      color={passFocused ? C.accent : "rgba(255,255,255,0.48)"}
                    />
                    <TextInput
                      ref={passInputRef}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      onSubmitEditing={handleLogin}
                      placeholder="Ingresa tu contraseña"
                      placeholderTextColor="rgba(255,255,255,0.34)"
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      style={s.textInput}
                    />
                  </Focusable>

                  <Focusable
                    onPress={toggleShowPass}
                    style={s.eyeBtn}
                    focusedStyle={s.eyeBtnFocused}
                    hitSlop={8}
                  >
                    {({ focused }) =>
                      showPass ? (
                        <EyeOff
                          size={scale(16)}
                          color={focused ? "#09090b" : "rgba(255,255,255,0.55)"}
                        />
                      ) : (
                        <Eye
                          size={scale(16)}
                          color={focused ? "#09090b" : "rgba(255,255,255,0.55)"}
                        />
                      )
                    }
                  </Focusable>
                </View>
              </View>

              {/* Botón Principal Ámbar / Naranja */}
              <Focusable
                onPress={handleLogin}
                disabled={loading}
                style={[s.ctaWrap, loading && s.ctaDisabled]}
                focusedStyle={s.ctaWrapFocused}
              >
                {({ focused }) => (
                  <LinearGradient
                    colors={
                      focused
                        ? ["#ffe08a", "#ffc226", "#ff8c00"]
                        : ["#ffd166", "#ffb703", "#ff7b00"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.ctaGradient}
                  >
                    {loading ? (
                      <>
                        <ActivityIndicator size="small" color="#09090b" />
                        <Text style={s.ctaText}>Entrando a Nuba TV…</Text>
                      </>
                    ) : (
                      <>
                        <LogIn size={scale(17)} color="#09090b" strokeWidth={2.5} />
                        <Text style={s.ctaText}>Comenzar a ver</Text>
                      </>
                    )}
                  </LinearGradient>
                )}
              </Focusable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const webInputReset =
  Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07070a",
  },

  /* ── Background Wall ── */
  wallGrid: {
    ...(StyleSheet.absoluteFill as any),
    flexDirection: "row",
    flexWrap: "wrap",
    padding: scale(12),
    gap: scale(12),
    opacity: 0.24,
  },
  wallTile: {
    width: "23.8%",
    height: "48%",
    borderRadius: scale(14),
    backgroundColor: "#12121a",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  topWarmWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },

  /* ── Top Bar ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(40),
    paddingTop: scale(22),
    paddingBottom: scale(6),
    zIndex: 5,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  brandMark: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(9),
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkLetter: {
    color: "#0b0907",
    fontSize: scale(16),
    fontWeight: "900",
  },
  brandText: {
    color: "#ffffff",
    fontSize: scale(17),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  brandTextAccent: {
    color: C.accent,
  },
  topPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingVertical: scale(6),
    paddingHorizontal: scale(12),
    borderRadius: 999,
    backgroundColor: "#111118",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  topPillLive: {
    borderColor: "rgba(255, 77, 128, 0.38)",
    backgroundColor: "#180d13",
  },
  liveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: 999,
    backgroundColor: "#ff4d80",
  },
  topPillText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: scale(11),
    fontWeight: "700",
  },
  topPillTextLive: {
    color: "#ffd1df",
  },

  /* ── Center Stage & Card ── */
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(32),
    paddingBottom: scale(18),
    zIndex: 5,
  },
  card: {
    width: "100%",
    maxWidth: scale(780),
    borderRadius: scale(24),
    backgroundColor: "#111117",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: scale(28),
    paddingHorizontal: scale(30),
    overflow: "hidden",
  },
  cardTopline: {
    position: "absolute",
    top: 0,
    left: "14%",
    right: "14%",
    height: 2,
  },
  cardColumns: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: scale(26),
  },
  leftCol: {
    flex: 1,
    justifyContent: "space-between",
    gap: scale(18),
  },
  colDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rightCol: {
    flex: 1.08,
    justifyContent: "center",
    gap: scale(14),
  },

  /* ── Left Header & Phrase Card ── */
  kicker: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingVertical: scale(4),
    paddingHorizontal: scale(10),
    borderRadius: 999,
    backgroundColor: "rgba(255, 183, 3, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.28)",
    marginBottom: scale(12),
  },
  kickerText: {
    color: C.accent,
    fontSize: scale(9.5),
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heading: {
    color: "#ffffff",
    fontSize: scale(28),
    fontWeight: "900",
    letterSpacing: -0.4,
    marginBottom: scale(8),
  },
  subheading: {
    color: "rgba(255,255,255,0.62)",
    fontSize: scale(13),
    lineHeight: scale(19),
    fontWeight: "500",
  },
  phraseCard: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    borderRadius: scale(14),
    backgroundColor: "rgba(255, 183, 3, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 183, 3, 0.18)",
  },
  phraseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(6),
  },
  phraseTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
  },
  phraseTag: {
    color: C.accent,
    fontSize: scale(10),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  phraseRefreshBtn: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(7),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  phraseRefreshBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
  },
  phraseText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: scale(12),
    lineHeight: scale(17),
    fontStyle: "italic",
    fontWeight: "500",
  },

  /* ── Error Banner ── */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingVertical: scale(9),
    paddingHorizontal: scale(12),
    borderRadius: scale(12),
    backgroundColor: "rgba(255, 77, 128, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 128, 0.38)",
  },
  errorText: {
    flex: 1,
    color: "#ff9ebb",
    fontSize: scale(12),
    fontWeight: "700",
  },

  /* ── Inputs ── */
  fieldGroup: {
    gap: scale(6),
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: scale(10),
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    height: scale(46),
    paddingHorizontal: scale(14),
    borderRadius: scale(13),
    backgroundColor: "#191922",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.11)",
  },
  inputRowFocused: {
    backgroundColor: "#211f1c",
    borderColor: C.accent,
  },
  passInputFlex: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    height: "100%",
  },
  textInput: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    fontSize: scale(14),
    fontWeight: "600",
    paddingVertical: 0,
    ...webInputReset,
  },
  eyeBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  eyeBtnFocused: {
    backgroundColor: C.accent,
    borderColor: "#ffffff",
  },

  /* ── CTA Button ── */
  ctaWrap: {
    marginTop: scale(4),
    height: scale(48),
    borderRadius: scale(14),
    borderWidth: 2.5,
    borderColor: "transparent",
    overflow: "hidden",
  },
  ctaWrapFocused: {
    borderColor: "#ffffff",
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
  },
  ctaText: {
    color: "#09090b",
    fontSize: scale(14.5),
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
