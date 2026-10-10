import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useGlobal } from '../../contexts/GlobalContext';
import { LogOut, User as UserIcon, Calendar, Smartphone, ShieldCheck } from 'lucide-react-native';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import ScreenBackground from '../../components/tv/ScreenBackground';

function InfoRow({ icon, label, value, warn = false }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      {icon}
      <View style={s.infoText}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, warn && s.infoValueWarn]}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileTvScreen() {
  const { user, logout } = useGlobal();
  const [logoutFocused, setLogoutFocused] = useState(false);

  const isExpired = user?.expiresAt && new Date(user.expiresAt) < new Date();
  const expiry = user?.expiresAt
    ? new Date(user.expiresAt).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : 'Sin vencimiento';

  return (
    <View style={s.root}>
      <ScreenBackground />
      {/* Header */}
      <View style={s.header}>
        <UserIcon size={scale(30)} color={C.accent} strokeWidth={2} />
        <Text style={s.title}>Mi Perfil</Text>
      </View>

      <View style={s.body}>
        {/* Avatar card */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={s.username}>{user?.username}</Text>
            <View style={s.roleBadge}>
              <ShieldCheck size={scale(14)} color={C.accent} strokeWidth={2} />
              <Text style={s.roleText}>
                {user?.role === 'admin' ? 'Administrador' : 'Usuario Pro'}
              </Text>
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={s.infoRows}>
          <InfoRow
            icon={<Calendar size={scale(22)} color={C.textSecondary} strokeWidth={1.8} />}
            label="Vencimiento del plan"
            value={expiry}
            warn={!!isExpired}
          />
          <InfoRow
            icon={<Smartphone size={scale(22)} color={C.textSecondary} strokeWidth={1.8} />}
            label="Dispositivos simultáneos"
            value={`${user?.maxDevices ?? 1} pantallas`}
          />
        </View>

        {/* Logout */}
        <Pressable
          focusable
          onFocus={() => setLogoutFocused(true)}
          onBlur={() => setLogoutFocused(false)}
          onPress={logout}
          style={[s.logoutBtn, logoutFocused && s.logoutBtnFocused]}
        >
          <LogOut
            size={scale(20)}
            color={logoutFocused ? '#fff' : '#f87171'}
            strokeWidth={2}
          />
          <Text style={[s.logoutLabel, logoutFocused && s.logoutLabelFocused]}>
            Cerrar Sesión
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080808',
    paddingHorizontal: scale(48),
    paddingTop: scale(40),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    marginBottom: scale(40),
  },
  title: {
    fontSize: scale(38),
    fontWeight: '900',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },

  body: {
    maxWidth: scale(700),
    gap: scale(20),
  },

  // ── Avatar card ──
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(24),
    backgroundColor: C.bgPanel,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: scale(18),
    padding: scale(28),
  },
  avatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: C.accentGlow,
    borderWidth: 2,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: scale(34),
    fontWeight: '900',
    color: C.accentLight,
  },
  username: {
    fontSize: scale(28),
    fontWeight: '900',
    color: C.textPrimary,
    marginBottom: scale(8),
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingVertical: scale(4),
    paddingHorizontal: scale(12),
    borderRadius: scale(20),
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: scale(13),
    fontWeight: '700',
    color: C.accentLight,
    letterSpacing: 0.5,
  },

  // ── Info rows ──
  infoRows: {
    gap: scale(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(18),
    backgroundColor: C.bgPanel,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: scale(14),
    padding: scale(20),
  },
  infoText: {
    gap: scale(4),
  },
  infoLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: scale(20),
    fontWeight: '800',
    color: C.textPrimary,
  },
  infoValueWarn: {
    color: '#f87171',
  },

  // ── Logout ──
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: scale(14),
    padding: scale(18),
    paddingHorizontal: scale(28),
    alignSelf: 'flex-start',
    marginTop: scale(8),
  },
  logoutBtnFocused: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  logoutLabel: {
    fontSize: scale(18),
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.5,
  },
  logoutLabelFocused: {
    color: '#fff',
  },
});
