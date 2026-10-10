import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ScreenBackground() {
  return (
    <>
      <LinearGradient
        colors={['#1a0d05', '#0a0502', '#080808']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />
      <LinearGradient
        colors={['rgba(255,145,0,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
    </>
  );
}
