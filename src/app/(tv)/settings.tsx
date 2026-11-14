import { useRouter } from "expo-router";
import {
  ArrowRight,
  Info,
  LogOut,
  MonitorPlay,
  Shield,
  Tv,
  UserRound,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import Focusable from "../../components/tv/Focusable";
import { useGlobal } from "../../contexts/GlobalContext";
import { useSidebarHandle } from "../../hooks/useNavThrottle";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";
import { getItemAsync, setItemAsync } from "../../utils/storage";

const SIDEBAR_PAD = scale(88);
const SETTINGS_STORAGE_KEY = "nubatv_tv_settings";

type SectionId = "account" | "parental" | "playback" | "about";

type AppSettings = {
  parentalLock: boolean;
  hideRestricted: boolean;
  autoPlayNext: boolean;
  subtitlesEnabled: boolean;
};

const defaultSettings: AppSettings = {
  parentalLock: false,
  hideRestricted: true,
  autoPlayNext: true,
  subtitlesEnabled: false,
};

// Exactamente las 4 secciones solicitadas
const MENU_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: any;
  subtitle: string;
}> = [
  { id: "account", label: "Cuenta", icon: UserRound, subtitle: "Estado de la cuenta y suscripción" },
  { id: "parental", label: "Control parental", icon: Shield, subtitle: "Filtros de contenido y restricciones" },
  { id: "playback", label: "Reproducción", icon: MonitorPlay, subtitle: "Opciones de video y subtítulos" },
  { id: "about", label: "Acerca de", icon: Info, subtitle: "Información del sistema y versión" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useGlobal();
  const sidebarHandle = useSidebarHandle();
  const [active, setActive] = useState<SectionId>("account");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await getItemAsync(SETTINGS_STORAGE_KEY);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        setSettings({
          ...defaultSettings,
          ...parsed,
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

          <View style={s.accountActions}>
            <Focusable
              onPress={handleLogout}
              style={s.btnDanger}
              focusedStyle={s.btnDangerFocused}
            >
              {({ focused }) => (
                <>
                  <LogOut size={scale(18)} color={focused ? "#fff" : "#f87171"} />
                  <Text style={[s.btnDangerText, focused && { color: "#fff" }]}>
                    Cerrar sesión
                  </Text>
                </>
              )}
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
              <Text style={s.aboutItemLabel}>Estado de suscripción</Text>
              <Text style={[s.aboutItemValue, { color: "#22c55e" }]}>
                {user?.isActive ? "Suscripción Activa" : "Plan Estándar"}
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
        {/* Panel Izquierdo: Menú con proporciones limpias, elegantes y foco TV */}
        <View style={s.leftPanel}>
          <View style={s.leftPanelHeader}>
            <Text style={s.leftHeaderTitle}>Ajustes</Text>
            <Text style={s.leftHeaderSub}>Configuración de TV</Text>
          </View>

          <View style={s.menuList}>
            {MENU_ITEMS.map((item) => {
              const selected = item.id === active;
              const Icon = item.icon;
              return (
                <Focusable
                  key={item.id}
                  hasTVPreferredFocus={item.id === "account"}
                  nextFocusLeft={sidebarHandle ?? undefined}
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
          </View>

          {/* Tarjeta de usuario en pie del panel izquierdo */}
          <View style={s.userBadgeFooter}>
            <View style={s.userBadgeDot} />
            <Text style={s.userBadgeText} numberOfLines={1}>
              {user?.username || "Usuario TV"}
            </Text>
          </View>
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
    paddingRight: scale(16),
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
    justifyContent: "space-between",
  },
  leftPanelHeader: {
    marginBottom: scale(18),
    paddingLeft: scale(6),
  },
  leftHeaderTitle: {
    fontSize: scale(22),
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  leftHeaderSub: {
    fontSize: scale(13),
    color: "rgba(255,255,255,0.5)",
    marginTop: scale(2),
  },
  menuList: {
    gap: scale(10),
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    minHeight: scale(56),
    borderRadius: scale(14),
    paddingHorizontal: scale(16),
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
  userBadgeFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(10),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  userBadgeDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: "#22c55e",
  },
  userBadgeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(13),
    fontWeight: "700",
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
  accountActions: {
    flexDirection: "row",
    gap: scale(14),
    marginTop: scale(12),
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
