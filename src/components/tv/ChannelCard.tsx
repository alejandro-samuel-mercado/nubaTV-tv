import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Heart, Tv } from 'lucide-react-native';
import { Channel } from '../../contexts/GlobalContext';
import { scale } from '../../lib/scale';
import { C, rowColor } from '../../lib/tvColors';

interface Props {
  channel: Channel;
  isActive?: boolean;
  isFav?: boolean;
  onPress: () => void;
  onFocus?: () => void;
  onToggleFav?: () => void;
}

export default function ChannelCard({ channel, isActive, isFav, onPress, onFocus, onToggleFav }: Props) {
  const [focused, setFocused] = useState(false);

  // Compute category color
  const catName = channel.category?.name || 'General';
  const color = rowColor(catName);

  return (
    <Pressable
      focusable
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[
        s.root,
        isActive && s.rootActive,
        focused && { borderColor: color, transform: [{ scale: 1.05 }], zIndex: 50, elevation: 10 }
      ]}
    >
      {/* Background / Logo */}
      <View style={s.logoContainer}>
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={[s.logo, focused && { opacity: 0.9, transform: [{ scale: 1.05 }] }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[s.fallbackIcon, { backgroundColor: `${color}16`, borderColor: `${color}22` }]}>
            <Tv size={scale(24)} color={color} opacity={0.8} />
          </View>
        )}
      </View>

      {/* Bottom Gradient (Web style) */}
      <LinearGradient
        colors={['transparent', 'rgba(10,5,2,0.6)', 'rgba(10,5,2,0.95)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Info */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{channel.name}</Text>
        <Text style={[s.category, { color }]}>
          {channel.groupTitle || 'LIVE'}
        </Text>
      </View>

      {/* Focused Play Icon */}
      {focused && (
        <View style={s.playOverlay}>
          <View style={[s.playBtn, { backgroundColor: `${color}40`, borderColor: `${color}80` }]}>
            <Play size={scale(18)} fill="#fff" color="#fff" style={{ marginLeft: scale(2) }} />
          </View>
        </View>
      )}

      {/* Active Badge */}
      {isActive && (
        <View style={[s.activeBadge, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}>
          <View style={[s.activeDot, { backgroundColor: color }]} />
          <Text style={[s.activeText, { color }]}>LIVE</Text>
        </View>
      )}

      {/* Fav Badge (If togglable or is Fav) */}
      {(isFav || focused) && onToggleFav && (
        <Pressable
          focusable
          onPress={onToggleFav}
          style={[
            s.favBtn,
            { backgroundColor: isFav ? 'rgba(255,77,109,0.3)' : 'rgba(0,0,0,0.6)' },
            { borderColor: isFav ? 'rgba(255,77,109,0.6)' : 'rgba(255,255,255,0.2)' }
          ]}
        >
          <Heart size={scale(12)} fill={isFav ? '#ff4d6d' : 'none'} color={isFav ? '#ff4d6d' : 'rgba(255,255,255,0.6)'} />
        </Pressable>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: {
    width: '100%',
    aspectRatio: 3/4,
    backgroundColor: C.bgCard,
    borderRadius: scale(16),
    borderWidth: scale(2),
    borderColor: C.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
  },
  rootActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoContainer: {
    ...StyleSheet.absoluteFill as any,
    padding: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  fallbackIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(12),
    zIndex: 10,
  },
  name: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: '900',
    marginBottom: scale(4),
  },
  category: {
    fontSize: scale(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: scale(24), // Offset above text
    zIndex: 5,
  },
  playBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    borderWidth: 1,
    zIndex: 20,
  },
  activeDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  activeText: {
    fontSize: scale(9),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  favBtn: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  }
});
