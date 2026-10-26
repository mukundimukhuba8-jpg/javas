import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { AiScannerScreen } from './src/screens/AiScannerScreen';
import { MetaTraderScreen } from './src/screens/MetaTraderScreen';
import { EmailGateScreen } from './src/screens/EmailGateScreen';
import { ActivateRobotScreen } from './src/screens/ActivateRobotScreen';
import { AdminSignInScreen } from './src/screens/AdminSignInScreen';
import { AdminRegisterScreen } from './src/screens/AdminRegisterScreen';
import { PortalScreen } from './src/screens/portal/PortalScreen';
import { ThemeProvider } from './src/theme/ThemeContext';
import { EaProvider } from './src/ea/EaStore';
import { AccessProvider, useAccess } from './src/access/AccessStore';
import { LicenseProvider, useLicenses } from './src/license/LicenseStore';
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
  const { isAllowed, sessionEmail } = useAccess();
  const { hasActivatedKey } = useLicenses();
  const [tab, setTab] = useState<TabKey>('home');
  const [portalOpen, setPortalOpen] = useState(false);
  const [adminSignIn, setAdminSignIn] = useState(false);
  const [adminRegister, setAdminRegister] = useState(false);
  const [portalSection, setPortalSection] = useState<PortalSectionId>('dashboard');
  const [eaRunning, setEaRunning] = useState(false);
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([
    'EURUSD',
    'XAUUSD',
    'US30',
  ]);

  const requestPortal = (section: PortalSectionId = 'dashboard') => {
    setPortalSection(section);
    setAdminRegister(false);
    setAdminSignIn(true);
  };

  const enterPortal = () => {
    setAdminRegister(false);
    setAdminSignIn(false);
    setPortalOpen(true);
  };

  const exitPortal = () => {
    setPortalOpen(false);
    setAdminRegister(false);
    setAdminSignIn(true);
  };

  if (portalOpen) {
    return <PortalScreen onExit={exitPortal} initialSection={portalSection} />;
  }

  if (adminRegister) {
    return (
      <AdminRegisterScreen
        onBackToSignIn={() => {
          setAdminRegister(false);
          setAdminSignIn(true);
        }}
      />
    );
  }

  if (adminSignIn) {
    return (
      <AdminSignInScreen
        onSuccess={enterPortal}
        onBackToMember={() => {
          setAdminRegister(false);
          setAdminSignIn(false);
        }}
        onOpenRegister={() => {
          setAdminSignIn(true);
          setAdminRegister(true);
        }}
      />
    );
  }

  // 1) Member sign in (email membership)
  if (!isAllowed || !sessionEmail) {
    return <EmailGateScreen onOpenAdminPortal={() => requestPortal('dashboard')} />;
  }

  // 2) Activate robot (skip if this email already activated a key)
  if (!hasActivatedKey(sessionEmail)) {
    return <ActivateRobotScreen />;
  }

  // 3) Home / app
  if (tab === 'home') {
    return (
      <HomeScreen
        activeTab={tab}
        onTabChange={setTab}
        selectedSymbolIds={selectedSymbolIds}
        onChangeSelectedSymbols={setSelectedSymbolIds}
        eaRunning={eaRunning}
        onToggleEa={() => setEaRunning((v) => !v)}
        onOpenPortal={() => requestPortal('dashboard')}
        onCreateEa={() => requestPortal('expert-adviser')}
      />
    );
  }

  if (tab === 'scanner') {
    return (
      <AiScannerScreen
        activeTab={tab}
        onTabChange={setTab}
        onOpenPortal={() => requestPortal('dashboard')}
      />
    );
  }

  return (
    <MetaTraderScreen
      activeTab={tab}
      onTabChange={setTab}
      onOpenPortal={() => requestPortal('dashboard')}
    />
  );
}

export default function App() {
  useIconFonts();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AccessProvider>
          <LicenseProvider>
            <EaProvider>
              <StatusBar style="light" />
              <AppShell />
            </EaProvider>
          </LicenseProvider>
        </AccessProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
