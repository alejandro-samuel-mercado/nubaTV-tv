import { useRouter } from "expo-router";
import {
  ArrowRight,
  Info,
  LogOut,
  MonitorPlay,
  Shield,
  UserRound,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
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

type QualityMode = "Auto" | "HD";
type LayoutMode = "Lista" | "Cuadrícula";

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
  subtitlesEnabled: true,
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
}> = [
  { id: "account", label: "Cuenta", icon: UserRound },
  { id: "parental", label: "Control parental", icon: Shield },

  { id: "playback", label: "Reproducción", icon: MonitorPlay },
  { id: "about", label: "Acerca de", icon: Info },
];

const SECTION_SUBTITLE: Record<SectionId, string> = {
  account: "Estado de la cuenta",
  parental: "Configuración",
  appearance: "Configuración",
  design: "Configuración",
  integrations: "Configuración",
  playback: "Configuración",
  about: "Información",
};

const qualityOptions: QualityMode[] = ["Auto", "HD"];
const layoutOptions: LayoutMode[] = ["Lista", "Cuadrícula"];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useGlobal();
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
        value: user?.isActive ? "Active" : "Inactive",
      },
      {
        label: "Fecha de expiración",
        value: user?.expiresAt
          ? new Date(user.expiresAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "No definida",
      },

      { label: "Máx. conexiones", value: String(user?.maxDevices ?? 3) },
    ],
    [user],
  );

  const activeMenu =
    MENU_ITEMS.find((item) => item.id === active) ?? MENU_ITEMS[0];
  const ActiveIcon = activeMenu.icon;
  const panelSubtitle = SECTION_SUBTITLE[active];

  const renderSettingRow = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <View key={label} style={s.optionRow}>
      <Text style={s.optionLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "rgba(255,255,255,0.18)", true: "#7dd3fc" }}
        thumbColor={value ? "#ffffff" : "#f4f4f5"}
      />
    </View>
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const renderSectionContent = () => {
    if (active === "account") {
      return (
        <View style={s.accountSection}>
          {accountRows.map((row) => (
            <View key={row.label} style={s.row}>
              <Text style={s.rowLabel}>{row.label}</Text>
              <Text style={s.rowValue}>{row.value}</Text>
            </View>
          ))}

          <Pressable
            focusable
            onPress={handleLogout}
            style={s.accountLogoutBtn}
          >
            <LogOut size={scale(18)} color="#fff" />
            <Text style={s.accountLogoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      );
    }

    if (active === "parental") {
      return (
        <View style={s.optionList}>
          {renderSettingRow({
            label: "Bloquear contenido +18",
            value: settings.parentalLock,
            onToggle: () =>
              updateSetting("parentalLock", !settings.parentalLock),
          })}
          {renderSettingRow({
            label: "Ocultar contenido restringido",
            value: settings.hideRestricted,
            onToggle: () =>
              updateSetting("hideRestricted", !settings.hideRestricted),
          })}
        </View>
      );
    }

    if (active === "appearance") {
      return (
        <View style={s.optionList}>
          {renderSettingRow({
            label: "Modo compacto",
            value: settings.compactMode,
            onToggle: () => updateSetting("compactMode", !settings.compactMode),
          })}
          {renderSettingRow({
            label: "Mostrar metadatos de contenido",
            value: settings.showMetaDetails,
            onToggle: () =>
              updateSetting("showMetaDetails", !settings.showMetaDetails),
          })}
        </View>
      );
    }

    if (active === "design") {
      return (
        <View style={s.optionList}>
          <View style={s.optionGroup}>
            <Text style={s.optionLabel}>Vista por defecto</Text>
            <View style={s.segmentedRow}>
              {layoutOptions.map((option) => {
                const selected = settings.layoutMode === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => updateSetting("layoutMode", option)}
                    style={[s.segmentButton, selected && s.segmentButtonActive]}
                  >
                    <Text
                      style={[s.segmentText, selected && s.segmentTextActive]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    if (active === "integrations") {
      return (
        <View style={s.optionList}>
          {renderSettingRow({
            label: "Real-Debrid",
            value: settings.integrations.realDebrid,
            onToggle: () =>
              updateIntegration(
                "realDebrid",
                !settings.integrations.realDebrid,
              ),
          })}
          {renderSettingRow({
            label: "Trakt",
            value: settings.integrations.trakt,
            onToggle: () =>
              updateIntegration("trakt", !settings.integrations.trakt),
          })}
          {renderSettingRow({
            label: "Plex",
            value: settings.integrations.plex,
            onToggle: () =>
              updateIntegration("plex", !settings.integrations.plex),
          })}
        </View>
      );
    }

    if (active === "playback") {
      return (
        <View style={s.optionList}>
          {renderSettingRow({
            label: "Reproducir siguiente automáticamente",
            value: settings.autoPlayNext,
            onToggle: () =>
              updateSetting("autoPlayNext", !settings.autoPlayNext),
          })}
          {renderSettingRow({
            label: "Subtítulos por defecto",
            value: settings.subtitlesEnabled,
            onToggle: () =>
              updateSetting("subtitlesEnabled", !settings.subtitlesEnabled),
          })}

          <View style={s.optionGroup}>
            <Text style={s.optionLabel}>Calidad por defecto</Text>
            <View style={s.segmentedRow}>
              {qualityOptions.map((option) => {
                const selected = settings.defaultQuality === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => updateSetting("defaultQuality", option)}
                    style={[s.segmentButton, selected && s.segmentButtonActive]}
                  >
                    <Text
                      style={[s.segmentText, selected && s.segmentTextActive]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={s.aboutBox}>
        <Text style={s.aboutTitle}>NUBATV TV</Text>
        <Text style={s.aboutText}>Versión: 1.0.0</Text>
        <Text style={s.aboutText}>
          Backend: {"nubatv-api.unixxtech.online"}
        </Text>
        <Text style={s.aboutText}>
          Estado: {user?.isActive ? "Cuenta activa" : "Cuenta inactiva"}
        </Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.shell}>
        <View style={s.leftPanel}>
          {MENU_ITEMS.map((item) => {
            const selected = item.id === active;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                focusable
                onPress={() => setActive(item.id)}
                style={({ focused }: any) => [
                  s.menuItem,
                  selected && s.menuItemActive,
                  focused && s.menuItemFocused,
                ]}
              >
                <View style={s.menuIconWrap}>
                  <Icon
                    size={scale(21)}
                    color={selected ? "#fff" : "rgba(255,255,255,0.72)"}
                  />
                </View>
                <Text style={[s.menuLabel, selected && s.menuLabelActive]}>
                  {item.label}
                </Text>
                <ArrowRight
                  size={scale(18)}
                  color={selected ? "#fff" : "rgba(255,255,255,0.58)"}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={s.rightPanel}>
          <View style={s.headerRow}>
            <View style={s.headerTitleWrap}>
              <Text style={s.panelTitle}>{activeMenu.label}</Text>
              <Text style={s.panelSubtitle}>{panelSubtitle}</Text>
            </View>
          </View>

          <View style={s.infoTable}>{renderSectionContent()}</View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#090d12",
    paddingLeft: SIDEBAR_PAD,
    paddingRight: scale(20),
    paddingTop: scale(22),
    paddingBottom: scale(18),
  },
  shell: {
    flex: 1,
    flexDirection: "row",
    borderRadius: scale(28),
    padding: scale(22),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(79, 90, 106, 0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
  },
  leftPanel: {
    flex: 0.96,
    paddingRight: scale(18),
    justifyContent: "flex-start",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: scale(70),
    borderRadius: scale(30),
    paddingHorizontal: scale(18),
    marginBottom: scale(12),
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  menuItemActive: {
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowColor: "#fff",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  menuItemFocused: {
    borderColor: "rgba(255,255,255,0.95)",
  },
  menuIconWrap: {
    width: scale(22),
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(10),
  },
  menuLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.82)",
    fontSize: scale(20),
    fontWeight: "700",
  },
  menuLabelActive: {
    color: "#fff",
    fontWeight: "800",
  },
  rightPanel: {
    flex: 1.46,
    borderRadius: scale(22),
    paddingHorizontal: scale(28),
    paddingTop: scale(16),
    paddingBottom: scale(18),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: scale(12),
    marginBottom: scale(10),
  },
  headerTitleWrap: {
    flex: 1,
  },
  panelTitle: {
    color: "#fff",
    fontSize: scale(30),
    fontWeight: "700",
    marginBottom: scale(2),
  },
  panelSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: scale(17),
    fontWeight: "400",
    marginBottom: scale(18),
  },
  infoTable: {
    flex: 1,
    justifyContent: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(18),
    fontWeight: "400",
  },
  rowValue: {
    color: "#fff",
    fontSize: scale(18),
    fontWeight: "600",
    textAlign: "right",
    marginLeft: scale(12),
  },
  optionList: {
    gap: scale(8),
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: scale(52),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingVertical: scale(6),
  },
  optionLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.8)",
    fontSize: scale(18),
    fontWeight: "500",
    marginRight: scale(12),
  },
  optionGroup: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingVertical: scale(8),
  },
  segmentedRow: {
    flexDirection: "row",
    gap: scale(8),
    marginTop: scale(8),
  },
  segmentButton: {
    flex: 1,
    borderRadius: scale(10),
    paddingVertical: scale(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  segmentButtonActive: {
    backgroundColor: "rgba(125, 211, 252, 0.18)",
    borderColor: "rgba(125, 211, 252, 0.7)",
  },
  segmentText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(15),
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
  },
  aboutBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    gap: scale(8),
    paddingVertical: scale(18),
  },
  aboutTitle: {
    color: "#fff",
    fontSize: scale(22),
    fontWeight: "700",
  },
  aboutText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: scale(16),
  },
  footerActionsOld: {
    display: "none",
  },
  secondaryBtn: {
    display: "none",
  },
  secondaryBtnText: {
    display: "none",
  },
  dangerBtn: {
    display: "none",
  },
  dangerBtnText: {
    display: "none",
  },
  accountSection: {
    flex: 1,
    justifyContent: "flex-start",
  },
  accountLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: scale(50),
    borderRadius: scale(10),
    paddingHorizontal: scale(18),
    marginTop: scale(12),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  accountLogoutText: {
    color: "#fff",
    fontSize: scale(16),
    fontWeight: "500",
    marginLeft: scale(8),
  },
});
