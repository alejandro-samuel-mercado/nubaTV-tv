import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useGlobal } from '../../contexts/GlobalContext';
import { scale } from '../../lib/scale';
import { C } from '../../lib/tvColors';
import { Home, Compass, Heart, User, Search } from 'lucide-react-native';

// ── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'home',      label: 'Inicio',    icon: Home,    route: '/(tv)' },
  { key: 'explore',   label: 'Explorar', icon: Search, route: '/(tv)/explore' },
  { key: 'favorites', label: 'Favoritos', icon: Heart,   route: '/(tv)/favorites' },
];

// ── NavButton ────────────────────────────────────────────────────────────────
function NavButton({
  item,
  isActive,
}: {
  item: (typeof NAV_ITEMS)[0];
  isActive: boolean;
}) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const Icon = item.icon;

  const active = isActive || focused;

  return (
    <Pressable
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => router.push(item.route as any)}
      style={[
        s.navBtn,
        active && s.navBtnActive,
        focused && s.navBtnFocused,
      ]}
    >
      <Icon
        size={scale(20)}
        color={focused ? '#000' : isActive ? C.accentLight : C.textSecondary}
        strokeWidth={isActive || focused ? 2.5 : 1.8}
      />
      <Text style={[
        s.navBtnLabel,
        isActive && s.navBtnLabelActive,
        focused && s.navBtnLabelFocused,
      ]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────
export default function TVLayout() {
  const { loading, user } = useGlobal();
  const pathname = usePathname();
  const router = useRouter();
  const isPlayerScreen = pathname.includes('/player');

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const getIsActive = (item: (typeof NAV_ITEMS)[0]) =>
    pathname === item.route || pathname === item.route + '/';

  return (
    <View style={s.root}>
      {/* ── Background Glow (Web Style) ── */}

      {/* ── Top Navigation Bar ── */}
      {!isPlayerScreen && (
        <View style={s.topBarContainer}>
          <View style={s.topBar}>
            {/* Brand */}
            <Text style={s.brand}>
              Nuba<Text style={s.brandAccent}>TV</Text>
            </Text>

            {/* Nav Items */}
            <View style={s.navItems}>
              {NAV_ITEMS.map(item => (
                <NavButton
                  key={item.key}
                  item={item}
                  isActive={getIsActive(item)}
                />
              ))}
            </View>

            {/* User Profile */}
            <Pressable
              focusable
              onPress={() => router.push('/(tv)/profile')}
              style={({ focused }) => [
                s.userBadge,
                focused && s.userBadgeFocused
              ]}
            >
              {({ focused }) => (
                <>
                  <View style={[s.userAvatar, focused && s.userAvatarFocused]}>
                    <User size={scale(16)} color={focused ? '#000' : '#fff'} strokeWidth={2.5} />
                  </View>
                  <Text style={[s.userName, focused && s.userNameFocused]}>
                    {loading ? 'Cargando...' : (user?.username || 'Invitado')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Screen Content ── */}
      <View style={isPlayerScreen ? { flex: 1 } : s.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#080808' },
            animation: 'none',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="profile" />
        </Stack>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const BAR_HEIGHT = scale(72);

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgBase,
  },

  // ── Top Bar ──
  topBarContainer: {
    paddingTop: scale(24),
    paddingHorizontal: scale(48),
    paddingBottom: scale(16),
    backgroundColor: C.bgBase,
    zIndex: 100,
  },
  topBar: {
    height: scale(64),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(28),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: scale(32),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  brand: {
    fontSize: scale(26),
    fontWeight: '900',
    color: C.textPrimary,
    letterSpacing: -0.5,
    marginRight: scale(56),
  },
  brandAccent: {
    color: C.accent,
  },

  navItems: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },

  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: scale(8),
    paddingHorizontal: scale(20),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navBtnActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: C.accentBorder,
  },
  navBtnFocused: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },

  navBtnLabel: {
    fontSize: scale(15),
    fontWeight: '700',
    color: C.textSecondary,
    letterSpacing: 0.2,
  },
  navBtnLabelActive: {
    color: C.accentLight,
  },
  navBtnLabelFocused: {
    color: '#000',
  },

  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: scale(6),
    paddingHorizontal: scale(16),
    paddingLeft: scale(8),
    borderRadius: scale(24),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userBadgeFocused: {
    backgroundColor: C.accentLight,
    borderColor: C.accentLight,
    transform: [{ scale: 1.05 }],
  },
  userAvatar: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarFocused: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  userName: {
    fontSize: scale(14),
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  userNameFocused: {
    color: '#000',
  },

  // ── Content below top bar ──
  content: {
    flex: 1,
    marginTop: 0,
  },
});
