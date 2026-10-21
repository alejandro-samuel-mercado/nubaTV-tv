import { useRouter } from "expo-router";
import {
    ArrowRight,
    Info,
    LayoutGrid,
    MonitorPlay,
    Palette,
    PlugZap,
    Shield,
    SlidersHorizontal,
    UserRound,
    X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGlobal } from "../../contexts/GlobalContext";
import { scale } from "../../lib/scale";
import { C } from "../../lib/tvColors";

const SIDEBAR_PAD = scale(88);

type SectionId =
  | "account"
  | "parental"
  | "appearance"
  | "design"
  | "integrations"
  | "playback"
  | "about";

const MENU_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: any;
  subtitle?: string;
}> = [
  { id: "account", label: "Cuenta", icon: UserRound },
  { id: "parental", label: "Control parental", icon: Shield },
  { id: "appearance", label: "Apariencia", icon: Palette },
  { id: "design", label: "Diseño", icon: LayoutGrid },
  { id: "integrations", label: "Integraciones", icon: PlugZap },
  { id: "playback", label: "Reproducción", icon: MonitorPlay },
  { id: "about", label: "Acerca de", icon: Info },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshAuth } = useGlobal();
  const [active, setActive] = useState<SectionId>("account");

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
      { label: "Prueba gratuita", value: user?.role === "admin" ? "Sí" : "No" },
      { label: "Conexiones activas", value: "0" },
      { label: "Máx. conexiones", value: String(user?.maxDevices ?? 3) },
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
                    size={scale(20)}
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
          <Text style={s.panelTitle}>{activeMenu.label}</Text>
          <Text style={s.panelSubtitle}>Estado de la cuenta</Text>

          <View style={s.infoTable}>
            {active === "account" ? (
              accountRows.map((row) => (
                <View key={row.label} style={s.row}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue}>{row.value}</Text>
                </View>
              ))
            ) : (
              <View style={s.emptyState}>
                <ActiveIcon size={scale(24)} color={C.accent} />
                <Text style={s.emptyTitle}>
                  Sección {activeMenu.label.toLowerCase()}
                </Text>
                <Text style={s.emptyText}>
                  Esta configuración estará disponible cuando se conecte con la
                  versión mobile y el backend real.
                </Text>
              </View>
            )}
          </View>

          <View style={s.footerActions}>
            <Pressable
              focusable
              onPress={() => refreshAuth()}
              style={[s.secondaryBtn]}
            >
              <SlidersHorizontal size={scale(18)} color="#f4f4f5" />
              <Text style={s.secondaryBtnText}>Actualizar</Text>
            </Pressable>

            <Pressable focusable onPress={handleLogout} style={[s.dangerBtn]}>
              <X size={scale(18)} color="#fff" />
              <Text style={s.dangerBtnText}>Cerrar sesión</Text>
            </Pressable>
          </View>
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
    paddingTop: scale(24),
    paddingBottom: scale(18),
  },
  shell: {
    flex: 1,
    flexDirection: "row",
    borderRadius: scale(28),
    padding: scale(22),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(90, 104, 120, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  leftPanel: {
    flex: 0.9,
    paddingRight: scale(18),
    justifyContent: "flex-start",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    minHeight: scale(64),
    borderRadius: scale(28),
    paddingHorizontal: scale(18),
    marginBottom: scale(12),
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  menuItemActive: {
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,255,255,0.03)",
    shadowColor: "#fff",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  menuItemFocused: {
    borderColor: "rgba(255,255,255,0.9)",
  },
  menuIconWrap: {
    width: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.82)",
    fontSize: scale(18),
    fontWeight: "700",
  },
  menuLabelActive: {
    color: "#fff",
    fontWeight: "800",
  },
  rightPanel: {
    flex: 1.3,
    borderRadius: scale(22),
    paddingHorizontal: scale(28),
    paddingTop: scale(18),
    paddingBottom: scale(20),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  panelTitle: {
    color: "#fff",
    fontSize: scale(30),
    fontWeight: "700",
    marginBottom: scale(4),
  },
  panelSubtitle: {
    color: "rgba(255,255,255,0.7)",
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
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
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
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: scale(20),
    gap: scale(12),
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryBtnFocus: {
    borderColor: "rgba(255,255,255,0.7)",
  },
  secondaryBtnText: {
    color: "#f2f2f2",
    fontSize: scale(18),
    fontWeight: "700",
  },
  dangerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: "rgba(255, 109, 109, 0.85)",
  },
  dangerBtnFocus: {
    backgroundColor: "rgba(255, 94, 94, 1)",
  },
  dangerBtnText: {
    color: "#fff",
    fontSize: scale(18),
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    paddingVertical: scale(18),
  },
  emptyTitle: {
    color: "#fff",
    fontSize: scale(20),
    fontWeight: "700",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: scale(14),
    textAlign: "center",
    paddingHorizontal: scale(24),
  },
});
