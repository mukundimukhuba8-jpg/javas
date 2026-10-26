import { useEffect } from 'react';
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export const AUTH_DARK = '#000000';

/** Dark document chrome + scrollable body (no overflow:hidden trap) for auth screens. */
export function useDarkWebShell(styleId = 'oracle-auth-dark-shell') {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prev = {
      htmlBg: html.style.backgroundColor,
      htmlColor: html.style.color,
      htmlOverflow: html.style.overflow,
      bodyBg: body.style.backgroundColor,
      bodyColor: body.style.color,
      bodyOverflow: body.style.overflow,
      rootBg: root?.style.backgroundColor ?? '',
    };
    html.style.backgroundColor = AUTH_DARK;
    html.style.color = '#FFFFFF';
    html.style.overflow = 'hidden';
    body.style.backgroundColor = AUTH_DARK;
    body.style.color = '#FFFFFF';
    // Document chrome stays fixed; ScrollView inside auth screens owns scrolling
    body.style.overflow = 'hidden';
    if (root) {
      root.style.backgroundColor = AUTH_DARK;
      root.style.height = '100%';
      root.style.minHeight = '100%';
    }

    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        html, body, #root {
          background-color: ${AUTH_DARK} !important;
          color: #fff;
          height: 100%;
          min-height: 100%;
        }
        html, body {
          overflow: hidden !important;
          overscroll-behavior: none;
        }
        #root {
          display: flex;
          height: 100% !important;
          min-height: 100%;
          max-height: 100%;
          flex: 1;
        }
        /* Auth ScrollViews must scroll on mobile web (keyboard open) */
        [data-auth-scroll="1"] {
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }
        input, textarea {
          color-scheme: dark;
          caret-color: #fff;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        select:-webkit-autofill {
          -webkit-text-fill-color: #FFFFFF !important;
          caret-color: #FFFFFF !important;
          transition: background-color 99999s ease-out 0s;
          box-shadow: 0 0 0px 1000px #0C0E14 inset !important;
          background-color: #0C0E14 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      html.style.backgroundColor = prev.htmlBg;
      html.style.color = prev.htmlColor;
      html.style.overflow = prev.htmlOverflow;
      body.style.backgroundColor = prev.bodyBg;
      body.style.color = prev.bodyColor;
      body.style.overflow = prev.bodyOverflow;
      if (root) root.style.backgroundColor = prev.rootBg;
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [styleId]);
}

export const authStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_DARK,
    ...Platform.select({
      web: {
        minHeight: '100%' as unknown as number,
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  } as ViewStyle,
  blackFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AUTH_DARK,
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  flex: {
    flex: 1,
    backgroundColor: AUTH_DARK,
    minHeight: 0,
    ...Platform.select({
      web: {
        overflow: 'hidden',
        height: '100%',
        maxHeight: '100%',
      } as object,
      default: {},
    }),
  } as ViewStyle,
  scroll: {
    flex: 1,
    backgroundColor: AUTH_DARK,
    minHeight: 0,
    ...Platform.select({
      web: {
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        height: '100%',
        maxHeight: '100%',
      } as object,
      default: {},
    }),
  } as ViewStyle,
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    backgroundColor: AUTH_DARK,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  brandLabel: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginTop: 6,
  } as TextStyle,
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  } as TextStyle,
  sub: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  } as TextStyle,
  card: {
    backgroundColor: '#14161C',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(0,0,0,0.35)' } as object,
      default: {},
    }),
  } as ViewStyle,
  label: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  } as TextStyle,
  input: {
    backgroundColor: '#0C0E14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    ...Platform.select({
      web: {
        outlineWidth: 0,
        colorScheme: 'dark',
      } as object,
      default: {},
    }),
  } as TextStyle,
  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  info: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  continue: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
  },
  continueText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  } as TextStyle,
  footerLinks: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  linkSep: {
    color: '#4B5563',
    fontSize: 13,
  } as TextStyle,
});
