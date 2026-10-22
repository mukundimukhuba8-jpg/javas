import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { AiScannerScreen } from './src/screens/AiScannerScreen';
import { MetaTraderScreen } from './src/screens/MetaTraderScreen';
import { PortalScreen } from './src/screens/portal/PortalScreen';
import { ThemeProvider } from './src/theme/ThemeContext';
import type { TabKey } from './src/components/BottomNav';

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [portalOpen, setPortalOpen] = useState(false);
  const [eaRunning, setEaRunning] = useState(false);
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([
    'EURUSD',
    'XAUUSD',
    'US30',
  ]);

  const openPortal = () => setPortalOpen(true);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        {portalOpen ? (
          <PortalScreen onExit={() => setPortalOpen(false)} />
        ) : tab === 'home' ? (
          <HomeScreen
            activeTab={tab}
            onTabChange={setTab}
            selectedSymbolIds={selectedSymbolIds}
            onChangeSelectedSymbols={setSelectedSymbolIds}
            eaRunning={eaRunning}
            onToggleEa={() => setEaRunning((v) => !v)}
            onOpenPortal={openPortal}
          />
        ) : tab === 'scanner' ? (
          <AiScannerScreen
            activeTab={tab}
            onTabChange={setTab}
            onOpenPortal={openPortal}
          />
        ) : (
          <MetaTraderScreen
            activeTab={tab}
            onTabChange={setTab}
            onOpenPortal={openPortal}
          />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
