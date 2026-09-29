import React, { useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import OpenWifiGuard, { type GuardMode, isUnsafeNetworkError, useOpenWifiGuard } from 'react-native-wifi-security';

/** Demo screen: live guard state and a guarded request. Join an open Wi-Fi to see the gate. */
const StatusScreen = ({ mode, setMode }: { mode: GuardMode; setMode: (mode: GuardMode) => void }) => {
  const guard = useOpenWifiGuard();
  const [requestResult, setRequestResult] = useState('–');

  const sendRequest = async () => {
    setRequestResult('sending…');
    try {
      const response = await fetch('https://httpbin.org/get');
      setRequestResult(`HTTP ${response.status}`);
    } catch (error) {
      setRequestResult(isUnsafeNetworkError(error) ? `refused (${error.state})` : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Open Wi-Fi Guard</Text>
        <Row label="State" value={guard.state} />
        <Row label="Cause" value={guard.cause} />
        <Row label="Reason" value={guard.reason} />
        <Row label="Transport" value={guard.status?.transport ?? '–'} />
        <Row label="Wi-Fi security" value={guard.status?.wifiSecurity ?? '–'} />
        <Row label="Captive portal" value={String(guard.status?.captivePortal ?? '–')} />
        <Row label="Location permission" value={guard.status?.locationPermission ?? '–'} />
        <Row label="Source" value={guard.status?.source ?? '–'} />
        <View style={styles.row}>
          <Text style={styles.label}>Monitor mode (no gate)</Text>
          <Switch value={mode === 'monitor'} onValueChange={(on) => setMode(on ? 'monitor' : 'block')} />
        </View>
        <Button title="Check again" onPress={guard.retry} />
        <Button title="Send guarded request" onPress={sendRequest} />
        <Row label="Request" value={requestResult} />
      </ScrollView>
    </SafeAreaView>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const App = () => {
  const [mode, setMode] = useState<GuardMode>('block');
  return (
    <OpenWifiGuard mode={mode} guardFetch debug>
      <StatusScreen mode={mode} setMode={setMode} />
    </OpenWifiGuard>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 15, color: '#555' },
  value: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});

export default App;
