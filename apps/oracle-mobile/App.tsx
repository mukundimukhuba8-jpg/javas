import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import type { TabKey } from './src/components/BottomNav';

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [eaRunning, setEaRunning] = useState(false);
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([
    'EURUSD',
    'XAUUSD',
    'US30',
  ]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {tab === 'home' ? (
        <HomeScreen
          activeTab={tab}
          onTabChange={setTab}
          selectedSymbolIds={selectedSymbolIds}
          onChangeSelectedSymbols={setSelectedSymbolIds}
          eaRunning={eaRunning}
          onToggleEa={() => setEaRunning((v) => !v)}
        />
      ) : tab === 'scanner' ? (
        <PlaceholderScreen title="AI SCANNER" activeTab={tab} onTabChange={setTab} />
      ) : (
        <PlaceholderScreen title="METATRADER" activeTab={tab} onTabChange={setTab} />
      )}
    </SafeAreaProvider>
  );
}
