import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { AiScannerScreen } from './src/screens/AiScannerScreen';
import { MetaTraderScreen } from './src/screens/MetaTraderScreen';
import { EmailGateScreen } from './src/screens/EmailGateScreen';
import { PortalScreen } from './src/screens/portal/PortalScreen';
import { ThemeProvider } from './src/theme/ThemeContext';
import { EaProvider } from './src/ea/EaStore';
import { AccessProvider, useAccess } from './src/access/AccessStore';
import type { TabKey } from './src/components/BottomNav';
import type { PortalSectionId } from './src/screens/portal/portalSections';

/** Preload vector icon fonts in background — home UI uses OracleIcons (no wait). */
function useIconFonts() {
  useEffect(() => {
    void Font.loadAsync({
      ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
      materialcommunityicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    }).catch(() => {
      /* portal still works with fallbacks; home icons are geometric */
    });
  }, []);
}

function AppShell() {
  const { isAllowed } = useAccess();
  const [tab, setTab] = useState<TabKey>('home');
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalSection, setPortalSection] = useState<PortalSectionId>('dashboard');
  const [eaRunning, setEaRunning] = useState(false);
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([
    'EURUSD',
    'XAUUSD',
    'US30',
  ]);

  const openPortal = (section: PortalSectionId = 'dashboard') => {
    setPortalSection(section);
    setPortalOpen(true);
  };

  if (portalOpen) {
    return (
      <PortalScreen
        onExit={() => setPortalOpen(false)}
        initialSection={portalSection}
      />
    );
  }

  if (!isAllowed) {
    return (
      <EmailGateScreen onOpenAdminPortal={() => openPortal('reactivate-email')} />
    );
  }

  if (tab === 'home') {
    return (
      <HomeScreen
        activeTab={tab}
        onTabChange={setTab}
        selectedSymbolIds={selectedSymbolIds}
        onChangeSelectedSymbols={setSelectedSymbolIds}
        eaRunning={eaRunning}
        onToggleEa={() => setEaRunning((v) => !v)}
        onOpenPortal={() => openPortal('dashboard')}
        onCreateEa={() => openPortal('expert-adviser')}
      />
    );
  }

  if (tab === 'scanner') {
    return (
      <AiScannerScreen
        activeTab={tab}
        onTabChange={setTab}
        onOpenPortal={() => openPortal('dashboard')}
      />
    );
  }

  return (
    <MetaTraderScreen
      activeTab={tab}
      onTabChange={setTab}
      onOpenPortal={() => openPortal('dashboard')}
    />
  );
}

export default function App() {
  useIconFonts();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AccessProvider>
          <EaProvider>
            <StatusBar style="light" />
            <AppShell />
          </EaProvider>
        </AccessProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
