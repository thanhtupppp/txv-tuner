import React, { useState } from 'react';
import { StyleSheet, View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Header } from './src/components/Header';
import { TxvTunerScreen } from './src/screens/TxvTunerScreen';
import { MonitorScreen } from './src/screens/MonitorScreen';
import { useTemperatures } from './src/hooks/useTemperatures';
import { THEME } from './src/constants/theme';
import { MaterialProvider, SkeuoButton, InstrumentIcon } from './src/components/SkeuoKit';
import { WebAccessibility } from './src/components/WebAccessibility';

export default function App() {
  const [themeMode, setThemeMode] = useState('light');
  const [flat, setFlat] = useState(false);
  const [activeTab, setActiveTab] = useState('txv');
  const theme = THEME[themeMode];
  const { data, history, connectionStatus, isDemoMode, toggleDemoMode, esp32Ip, saveEsp32Ip, reconnect, esp32Stats, statsLoading, refreshStats, offlineSensors } = useTemperatures();
  const sensors = data?.sensors || [];
  return (
    <SafeAreaProvider>
      <MaterialProvider themeMode={themeMode} flat={flat}>
        <WebAccessibility />
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]}>
          <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
          <Header connectionStatus={connectionStatus} isDemoMode={isDemoMode} toggleDemoMode={toggleDemoMode}
            themeMode={themeMode} toggleTheme={() => setThemeMode(prev => prev === 'light' ? 'dark' : 'light')}
            esp32Ip={esp32Ip} saveEsp32Ip={saveEsp32Ip} reconnect={reconnect} esp32Stats={esp32Stats}
            statsLoading={statsLoading} refreshStats={refreshStats} sensors={sensors} flat={flat} setFlat={setFlat} />
          <View style={[styles.mainBody, { backgroundColor: theme.bg }]}>
            <View style={[styles.mainBody, activeTab !== 'txv' && styles.hidden]} accessibilityElementsHidden={activeTab !== 'txv'} importantForAccessibility={activeTab !== 'txv' ? 'no-hide-descendants' : 'auto'}>
              <TxvTunerScreen liveT1={sensors[0]?.temp ?? null} liveT2={sensors[1]?.temp ?? null} liveT3={sensors[2]?.temp ?? null}
                isOnline={connectionStatus === 'connected'} isDemoMode={isDemoMode} themeMode={themeMode} offlineSensors={offlineSensors} />
            </View>
            {activeTab === 'monitor' && <MonitorScreen sensors={sensors} deltaAir={data?.deltaAir} history={history} themeMode={themeMode} />}
          </View>
          <View accessibilityRole="tablist" style={[styles.bottomNav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {[{ id: 'txv', icon: 'tune', label: 'Chỉnh TXV' }, { id: 'monitor', icon: 'chart', label: 'Giám sát' }].map(tab => {
              const isSelected = activeTab === tab.id;
              return (
                <SkeuoButton testID={`tab-${tab.id}`} key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.tabButton,
                    isSelected
                      ? { borderColor: theme.accent, borderBottomWidth: 3, borderBottomColor: theme.accent }
                      : { elevation: 0, shadowOpacity: 0, borderColor: theme.border, borderBottomWidth: 1 }
                  ]}
                  onPress={() => setActiveTab(tab.id)}>
                  <InstrumentIcon name={tab.icon} color={isSelected ? theme.accent : theme.inkMuted} />
                  <Text style={[styles.tabTitle, { color: isSelected ? theme.accent : theme.inkMuted }]}>{tab.label}</Text>
                </SkeuoButton>
              );
            })}
          </View>
        </SafeAreaView>
      </MaterialProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainBody: { flex: 1 },
  hidden: { display: 'none' },
  bottomNav: { flexDirection: 'row', minHeight: 76, width: '100%', maxWidth: 960, alignSelf: 'center', borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 10, gap: 8 },
  tabTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
});
