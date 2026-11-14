/**
 * useNavThrottle — Sistema de foco y estabilización para Android TV
 *
 * Proporciona el handle del sidebar como estado reactivo para que
 * los componentes que lo usan se re-rendericen cuando esté listo.
 * Además ofrece utilidades para estabilizar la navegación rápida con D-pad.
 */

import React from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

// Handle a nivel módulo (sincrónico)
export let globalSidebarNodeHandle: number | null = null;

// Suscriptores React — se llaman cuando el handle cambia
const _subscribers = new Set<(handle: number | null) => void>();

export function setGlobalSidebarNodeHandle(handle: number | null) {
  if (globalSidebarNodeHandle === handle) return;
  globalSidebarNodeHandle = handle;
  _subscribers.forEach((fn) => fn(handle));
}

/**
 * Hook: retorna el handle del sidebar como estado reactivo.
 * El componente que lo use se re-renderizará cuando el sidebar esté listo.
 */
export function useSidebarHandle(): number | null {
  const [handle, setHandle] = React.useState<number | null>(globalSidebarNodeHandle);
  React.useEffect(() => {
    setHandle(globalSidebarNodeHandle);
    _subscribers.add(setHandle);
    return () => { _subscribers.delete(setHandle); };
  }, []);
  return handle;
}

// Handle de contenido principal preferido al salir de la barra lateral hacia la derecha (ej. reproductor en /channels)
export let globalPreferredContentHandle: number | null = null;
const _contentSubscribers = new Set<(handle: number | null) => void>();

export function setGlobalPreferredContentHandle(handle: number | null) {
  if (globalPreferredContentHandle === handle) return;
  globalPreferredContentHandle = handle;
  _contentSubscribers.forEach((fn) => fn(handle));
}

export function usePreferredContentHandle(): number | null {
  const [handle, setHandle] = React.useState<number | null>(globalPreferredContentHandle);
  React.useEffect(() => {
    setHandle(globalPreferredContentHandle);
    _contentSubscribers.add(setHandle);
    return () => { _contentSubscribers.delete(setHandle); };
  }, []);
  return handle;
}

// Control de throttle global para callbacks de navegación rápida
let _globalFocusTimer: any = null;

export function registerFocusable(_id: string, _ref: any) {}
export function unregisterFocusable(_id: string) {}

export function handleGlobalFocus(_id: string, onFocusExecute: () => void, delayMs = 80) {
  if (_globalFocusTimer) {
    clearTimeout(_globalFocusTimer);
    _globalFocusTimer = null;
  }
  _globalFocusTimer = setTimeout(() => {
    _globalFocusTimer = null;
    onFocusExecute();
  }, delayMs);
}

export function cancelGlobalFocus(_id?: string) {
  if (_globalFocusTimer) {
    clearTimeout(_globalFocusTimer);
    _globalFocusTimer = null;
  }
}

export function resetNavThrottle() {
  cancelGlobalFocus();
}
export { resetNavThrottle as resetNavLock };

/**
 * Hook: al enfocar cualquier elemento del Hero (botones o portadas 2x2),
 * desplaza el ScrollView completamente hasta y = 0 para que todo el Hero
 * sea visible en un solo paso sin tener que subir dos veces.
 */
export function useHeroScrollToTop() {
  const scrollRef = React.useRef<any>(null);
  const timerRef = React.useRef<any>(null);
  const isInHeroRef = React.useRef<boolean>(true);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleHeroFocus = React.useCallback(() => {
    // Si ya estamos en el Hero arriba del todo, no disparar scrollTo redundante al moverse entre botones/cards del Hero
    if (isInHeroRef.current) return;
    isInHeroRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Espera tras el auto-scroll parcial nativo de Android TV para imponer y = 0
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      scrollRef.current?.scrollTo?.({ y: 0, animated: true });
    }, 40);
  }, []);

  const cancelHeroScroll = React.useCallback(() => {
    isInHeroRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { scrollRef, handleHeroFocus, cancelHeroScroll };
}

export interface TVRemoteKeyEvent {
  eventType: 'up' | 'down' | 'left' | 'right' | 'select' | 'menu' | 'playPause' | string;
  repeatCount?: number;
}

/**
 * Escucha teclas reales del control remoto TV emitidas desde MainActivity (`onTVRemoteKey`),
 * ya que react-native estándar no incluye useTVEventHandler.
 * En Web también mapea teclas de teclado equivalentes.
 */
export function useTVRemoteKey(handler: (evt: TVRemoteKeyEvent) => void) {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = DeviceEventEmitter.addListener('onTVRemoteKey', (evt: TVRemoteKeyEvent) => {
        if (evt && evt.eventType) {
          handlerRef.current(evt);
        }
      });
      return () => sub.remove();
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const map: Record<string, string> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
          Enter: 'select',
          ' ': 'playPause',
          MediaPlayPause: 'playPause',
          m: 'menu',
          M: 'menu',
          ContextMenu: 'menu',
        };
        const eventType = map[e.key];
        if (eventType) {
          if (e.key === ' ' || e.key.startsWith('Arrow')) {
            e.preventDefault();
          }
          handlerRef.current({ eventType, repeatCount: e.repeat ? 1 : 0 });
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, []);
}
