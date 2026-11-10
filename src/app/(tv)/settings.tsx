import { useRouter } from "expo-router";
import {
  ArrowRight,
  Check,
  Info,
  LayoutGrid,
  LogOut,
  MonitorPlay,
  Palette,
  PlugZap,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Tv,
  UserRound,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View, ScrollView } from "react-native";
import Focusable from "../../components/tv/Focusable";
import { useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getItemAsync, setItemAsync } from "../../utils/storage";

const SIDEBAR_PAD = scale(88);
const SETTINGS_STORAGE_KEY = "nubatv_tv_settings";

type SectionId =
  | "account"
  | "parental"
  | "appearance"
  | "design"
  | "integrations"
  | "playback"
  | "about";

type QualityMode = "Auto" | "1080p FHD" | "4K UHD";
type LayoutMode = "Cuadrícula" | "Lista";

type AppSettings = {
  parentalLock: boolean;
  hideRestricted: boolean;
  compactMode: boolean;
  showMetaDetails: boolean;
  layoutMode: LayoutMode;
  autoPlayNext: boolean;
  subtitlesEnabled: boolean;
  defaultQuality: QualityMode;
  externalPlayer: boolean;
  integrations: {
    realDebrid: boolean;
    trakt: boolean;
    plex: boolean;
  };
};

const defaultSettings: AppSettings = {
  parentalLock: false,
  hideRestricted: true,
  compactMode: false,
  showMetaDetails: true,
  layoutMode: "Cuadrícula",
  autoPlayNext: true,
  subtitlesEnabled: false,
  defaultQuality: "Auto",
  externalPlayer: false,
  integrations: {
    realDebrid: false,
    trakt: false,
    plex: false,
  },
};

const MENU_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: any;
  subtitle: string;
}> = [
  { id: "account", label: "Cuenta", icon: UserRound, subtitle: "Estado de la cuenta y suscripción" },
  { id: "parental", label: "Control parental", icon: Shield, subtitle: "Filtros de contenido y restricciones" },
  { id: "appearance", label: "Apariencia", icon: Palette, subtitle: "Tema visual y visualización en pantalla" },
  { id: "design", label: "Diseño", icon: LayoutGrid, subtitle: "Disposición de elementos y navegación" },
  { id: "integrations", label: "Integraciones", icon: PlugZap, subtitle: "Servicios externos y vinculaciones" },
  { id: "playback", label: "Reproducción", icon: MonitorPlay, subtitle: "Opciones de video, audio y calidad" },
  { id: "about", label: "Acerca de", icon: Info, subtitle: "Información del sistema y versión" },
];

const qualityOptions: QualityMode[] = ["Auto", "1080p FHD", "4K UHD"];
const layoutOptions: LayoutMode[] = ["Cuadrícula", "Lista"];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshAuth } = useGlobal();
  const [active, setActive] = useState<SectionId>("account");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await getItemAsync(SETTINGS_STORAGE_KEY);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        setSettings({
          ...defaultSettings,
          ...parsed,
          integrations: {
            ...defaultSettings.integrations,
            ...(parsed.integrations ?? {}),
          },
        });
      } catch (error) {
        console.log("Error parsing settings:", error);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    const next = {
      ...settings,
      [key]: value,
    };
    setSettings(next);
    setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  };

  const updateIntegration = (
    key: keyof AppSettings["integrations"],
    value: boolean,
  ) => {
    const next = {
      ...settings,
      integrations: {
        ...settings.integrations,
        [key]: value,
      },
    };
    setSettings(next);
    setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  };

  const accountRows = useMemo(
    () => [
      { label: "Usuario", value: user?.username || "-" },
      {
        label: "Estado de la cuenta",
        value: user?.isActive ? "Activa" : "Inactiva",
      },
      {
        label: "Fecha de expiración",
        value: user?.expiresAt
          ? new Date(user.expiresAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "Suscripción activa",
      },
      { label: "Rol / Plan", value: user?.role === "admin" ? "Administrador VIP" : "Estándar TV" },
      { label: "Conexiones activas", value: "1 activa" },
      { label: "Máx. conexiones simultáneas", value: String(user?.maxDevices ?? 3) },
    ],
    [user],
  );

  const activeMenu =
    MENU_ITEMS.find((item) => item.id === active) ?? MENU_ITEMS[0];
  const ActiveIcon = activeMenu.icon;

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleRefresh = async () => {
    try {
      await refreshAuth();
      setRefreshMsg("Credenciales actualizadas correctamente");
      setTimeout(() => setRefreshMsg(null), 3000);
    } catch {
      setRefreshMsg("No se pudo actualizar");
      setTimeout(() => setRefreshMsg(null), 3000);
    }
  };

  const renderSettingRow = ({
    label,
    description,
    value,
    onToggle,
  }: {
    label: string;
    description?: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <Focusable
      key={label}
      onPress={onToggle}
      scaleFocused={1.01}
      style={s.optionCard}
      focusedStyle={s.optionCardFocused}
    >
      <View style={{ flex: 1, paddingRight: scale(16) }}>
        <Text style={s.optionLabel}>{label}</Text>
        {description ? <Text style={s.optionDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "rgba(255,255,255,0.18)", true: C.accent }}
        thumbColor={value ? "#ffffff" : "#d1d5db"}
      />
    </Focusable>
  );

  const renderSectionContent = () => {
    if (active === "account") {
      return (
        <View style={s.sectionContentWrap}>
          <View style={s.infoList}>
            {accountRows.map((row) => (
              <View key={row.label} style={s.infoRow}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {refreshMsg && (
            <View style={s.toastSuccess}>
              <Check size={scale(16)} color="#22c55e" />
              <Text style={s.toastSuccessText}>{refreshMsg}</Text>
            </View>
          )}

          <View style={s.accountActions}>
            <Focusable
              onPress={handleRefresh}
              style={s.btnSecondary}
              focusedStyle={s.btnSecondaryFocused}
            >
              <RefreshCw size={scale(18)} color="#fff" />
              <Text style={s.btnSecondaryText}>Actualizar cuenta</Text>
            </Focusable>

            <Focusable
              onPress={handleLogout}
              style={s.btnDanger}
              focusedStyle={s.btnDangerFocused}
            >
              <LogOut size={scale(18)} color="#fff" />
              <Text style={s.btnDangerText}>Cerrar sesión</Text>
            </Focusable>
          </View>
        </View>
      );
    }

    if (active === "parental") {
      return (
        <View style={s.sectionContentWrap}>
          {renderSettingRow({
            label: "Bloquear contenido +18",
            description: "Exige confirmación antes de reproducir películas o series para adultos",
            value: settings.parentalLock,
            onToggle: () => updateSetting("parentalLock", !settings.parentalLock),
          })}
          {renderSettingRow({
            label: "Ocultar contenido restringido",
            description: "No muestra títulos para mayores de edad en los catálogos principales",
            value: settings.hideRestricted,
            onToggle: () => updateSetting("hideRestricted", !settings.hideRestricted),
          })}
        </View>
      );
    }

    if (active === "appearance") {
      return (
        <View style={s.sectionContentWrap}>
          {renderSettingRow({
            label: "Modo compacto de tarjetas",
            description: "Muestra cuadrículas más densas con más portadas por fila",
            value: settings.compactMode,
            onToggle: () => updateSetting("compactMode", !settings.compactMode),
          })}
          {renderSettingRow({
            label: "Mostrar metadatos de contenido",
            description: "Despliega badges de año, duración, género y calidad en las portadas",
            value: settings.showMetaDetails,
            onToggle: () => updateSetting("showMetaDetails", !settings.showMetaDetails),
          })}
        </View>
      );
    }

    if (active === "design") {
      return (
        <View style={s.sectionContentWrap}>
          <View style={s.segmentedBox}>
            <Text style={s.segmentGroupTitle}>Vista por defecto del catálogo</Text>
            <Text style={s.segmentGroupSubtitle}>
              Selecciona cómo se visualizan las listas y colecciones de contenido
            </Text>
            <View style={s.segmentedRow}>
              {layoutOptions.map((option) => {
                const selected = settings.layoutMode === option;
                return (
                  <Focusable
                    key={option}
                    onPress={() => updateSetting("layoutMode", option)}
                    style={[s.segmentButton, selected && s.segmentButtonActive]}
                    focusedStyle={s.segmentButtonFocused}
                  >
                    <Text style={[s.segmentText, selected && s.segmentTextActive]}>
                      {option}
                    </Text>
                  </Focusable>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    if (active === "integrations") {
      return (
        <View style={s.sectionContentWrap}>
          {renderSettingRow({
            label: "Sincronización Real-Debrid",
            description: "Permite usar enlaces de alta velocidad y servidores de caché premium",
            value: settings.integrations.realDebrid,
            onToggle: () =>
              updateIntegration("realDebrid", !settings.integrations.realDebrid),
          })}
          {renderSettingRow({
            label: "Integración con Trakt.tv",
            description: "Registra historial de visualización y sincroniza progreso entre dispositivos",
            value: settings.integrations.trakt,
            onToggle: () =>
              updateIntegration("trakt", !settings.integrations.trakt),
          })}
          {renderSettingRow({
            label: "Conexión Plex Media",
            description: "Enlaza bibliotecas de medios locales si están disponibles en la red",
            value: settings.integrations.plex,
            onToggle: () =>
              updateIntegration("plex", !settings.integrations.plex),
          })}
        </View>
      );
    }

    if (active === "playback") {
      return (
        <View style={s.sectionContentWrap}>
          {renderSettingRow({
            label: "Reproducir siguiente automáticamente",
            description: "Inicia el siguiente episodio al finalizar el actual en series",
            value: settings.autoPlayNext,
            onToggle: () => updateSetting("autoPlayNext", !settings.autoPlayNext),
          })}
          {renderSettingRow({
            label: "Subtítulos activados por defecto",
            description: "Carga automáticamente la pista de subtítulos en español si está disponible",
            value: settings.subtitlesEnabled,
            onToggle: () =>
              updateSetting("subtitlesEnabled", !settings.subtitlesEnabled),
          })}

          <View style={s.segmentedBox}>
            <Text style={s.segmentGroupTitle}>Calidad predeterminada de reproducción</Text>
            <Text style={s.segmentGroupSubtitle}>
              Selecciona la resolución objetivo para transmisiones en vivo y VOD
            </Text>
            <View style={s.segmentedRow}>
              {qualityOptions.map((option) => {
                const selected = settings.defaultQuality === option;
                return (
                  <Focusable
                    key={option}
                    onPress={() => updateSetting("defaultQuality", option)}
                    style={[s.segmentButton, selected && s.segmentButtonActive]}
                    focusedStyle={s.segmentButtonFocused}
                  >
                    <Text style={[s.segmentText, selected && s.segmentTextActive]}>
                      {option}
                    </Text>
                  </Focusable>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={s.sectionContentWrap}>
        <View style={s.aboutCard}>
          <Tv size={scale(36)} color={C.accent} style={{ marginBottom: scale(12) }} />
          <Text style={s.aboutTitle}>NUBATV TV EXPERIENCE</Text>
          <Text style={s.aboutSub}>Plataforma de Entretenimiento Digital Premium para Android TV</Text>
          <View style={s.aboutGrid}>
            <View style={s.aboutItem}>
              <Text style={s.aboutItemLabel}>Versión de la App</Text>
              <Text style={s.aboutItemValue}>v2.4.0 (Build 2026 TV)</Text>
            </View>
            <View style={s.aboutItem}>
              <Text style={s.aboutItemLabel}>Motor de Video</Text>
              <Text style={s.aboutItemValue}>ExoPlayer VOD / HLS Live</Text>
            </View>
            <View style={s.aboutItem}>
              <Text style={s.aboutItemLabel}>Servidor Backend</Text>
              <Text style={s.aboutItemValue}>Conectado • nubaTV Cloud</Text>
            </View>
            <View style={s.aboutItem}>
              <Text style={s.aboutItemLabel}>Estado de Licencia</Text>
              <Text style={[s.aboutItemValue, { color: "#22c55e" }]}>
                {user?.isActive ? "Licencia Activa" : "Licencia Estándar"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.shell}>
        {/* Panel Izquierdo: Menú de Categorías con Foco Profesional TV */}
        <View style={s.leftPanel}>
          <Text style={s.menuSectionHeader}>AJUSTES DEL SISTEMA</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item) => {
              const selected = item.id === active;
              const Icon = item.icon;
              return (
                <Focusable
                  key={item.id}
                  onPress={() => setActive(item.id)}
                  scaleFocused={1.02}
                  style={[s.menuItem, selected && s.menuItemActive]}
                  focusedStyle={s.menuItemFocused}
                >
                  <View style={[s.menuIconWrap, selected && s.menuIconWrapActive]}>
                    <Icon
                      size={scale(20)}
                      color={selected ? "#000" : "#fff"}
                    />
                  </View>
                  <Text style={[s.menuLabel, selected && s.menuLabelActive]}>
                    {item.label}
                  </Text>
                  <ArrowRight
                    size={scale(16)}
                    color={selected ? C.accent : "rgba(255,255,255,0.4)"}
                  />
                </Focusable>
              );
            })}
          </ScrollView>
        </View>

        {/* Panel Derecho: Contenido de la sección seleccionada */}
        <View style={s.rightPanel}>
          <View style={s.headerRow}>
            <View style={s.headerIconBadge}>
              <ActiveIcon size={scale(24)} color={C.accent} />
            </View>
            <View style={s.headerTitleWrap}>
              <Text style={s.panelTitle}>{activeMenu.label}</Text>
              <Text style={s.panelSubtitle}>{activeMenu.subtitle}</Text>
            </View>
          </View>

          <View style={s.contentTable}>
            {renderSectionContent()}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07090e",
    paddingLeft: SIDEBAR_PAD,
    paddingRight: scale(28),
    paddingTop: scale(26),
    paddingBottom: scale(22),
  },
  shell: {
    flex: 1,
    flexDirection: "row",
    borderRadius: scale(24),
    padding: scale(24),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(16,21,32,0.75)",
    gap: scale(24),
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 25,
  },
  leftPanel: {
    flex: 0.85,
    paddingRight: scale(14),
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  menuSectionHeader: {
    fontSize: scale(12),
    fontWeight: "900",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1.2,
    marginBottom: scale(16),
    paddingLeft: scale(8),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    minHeight: scale(56),
    borderRadius: scale(16),
    paddingHorizontal: scale(16),
    marginBottom: scale(10),
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  menuItemActive: {
    borderColor: "rgba(255,183,3,0.4)",
    backgroundColor: "rgba(255,183,3,0.08)",
  },
  menuItemFocused: {
    borderColor: C.accent,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  menuIconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconWrapActive: {
    backgroundColor: C.accent,
  },
  menuLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.78)",
    fontSize: scale(16),
    fontWeight: "700",
  },
  menuLabelActive: {
    color: "#fff",
    fontWeight: "900",
  },

  rightPanel: {
    flex: 1.35,
    borderRadius: scale(18),
    paddingHorizontal: scale(28),
    paddingTop: scale(22),
    paddingBottom: scale(22),
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
    paddingBottom: scale(18),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: scale(20),
  },
  headerIconBadge: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: "rgba(255,183,3,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,183,3,0.3)",
  },
  headerTitleWrap: {
    flex: 1,
  },
  panelTitle: {
    color: "#fff",
    fontSize: scale(24),
    fontWeight: "900",
  },
  panelSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: scale(14),
    fontWeight: "500",
    marginTop: scale(2),
  },

  contentTable: {
    flex: 1,
  },
  sectionContentWrap: {
    gap: scale(14),
  },

  // ── Account Section ──
  infoList: {
    gap: scale(4),
    marginBottom: scale(16),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.02)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  rowLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: scale(15),
    fontWeight: "600",
  },
  rowValue: {
    color: "#fff",
    fontSize: scale(15),
    fontWeight: "800",
  },
  toastSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    marginBottom: scale(12),
  },
  toastSuccessText: {
    color: "#22c55e",
    fontSize: scale(14),
    fontWeight: "700",
  },
  accountActions: {
    flexDirection: "row",
    gap: scale(14),
    marginTop: scale(12),
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnSecondaryFocused: {
    backgroundColor: "#fff",
    borderColor: C.accent,
  },
  btnSecondaryText: {
    color: "#fff",
    fontSize: scale(15),
    fontWeight: "800",
  },
  btnDanger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  btnDangerFocused: {
    backgroundColor: "#ef4444",
    borderColor: "#fff",
  },
  btnDangerText: {
    color: "#f87171",
    fontSize: scale(15),
    fontWeight: "800",
  },

  // ── Option Cards ──
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: scale(14),
    paddingHorizontal: scale(18),
    borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionCardFocused: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: C.accent,
  },
  optionLabel: {
    color: "#fff",
    fontSize: scale(16),
    fontWeight: "800",
  },
  optionDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: scale(13),
    marginTop: scale(4),
  },

  // ── Segmented Controls ──
  segmentedBox: {
    padding: scale(18),
    borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: scale(12),
  },
  segmentGroupTitle: {
    color: "#fff",
    fontSize: scale(16),
    fontWeight: "800",
  },
  segmentGroupSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: scale(13),
    marginTop: scale(-6),
  },
  segmentedRow: {
    flexDirection: "row",
    gap: scale(10),
  },
  segmentButton: {
    flex: 1,
    height: scale(44),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  segmentButtonActive: {
    backgroundColor: "rgba(255,183,3,0.18)",
    borderColor: C.accent,
  },
  segmentButtonFocused: {
    borderColor: "#fff",
    backgroundColor: C.accent,
  },
  segmentText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: scale(14),
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "900",
  },

  // ── About Section ──
  aboutCard: {
    padding: scale(24),
    borderRadius: scale(16),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  aboutTitle: {
    color: "#fff",
    fontSize: scale(22),
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  aboutSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: scale(14),
    marginTop: scale(4),
    marginBottom: scale(20),
    textAlign: "center",
  },
  aboutGrid: {
    width: "100%",
    gap: scale(10),
  },
  aboutItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(8),
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  aboutItemLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: scale(14),
    fontWeight: "600",
  },
  aboutItemValue: {
    color: "#fff",
    fontSize: scale(14),
    fontWeight: "800",
  },
});
