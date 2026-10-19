import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, spacing, typography } from '../../utils/theme';
import * as qrService from '../../services/qrService';
import { getApiErrorMessage } from '../../services/api';

export default function QrScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning || resolving) return;
    setScanning(false);
    setResolving(true);
    setError(null);
    try {
      const resolved = await qrService.resolveQr(data);
      router.replace({
        pathname: '/send/qr',
        params: {
          uri: data,
          name: resolved.name,
          upiId: resolved.upiId,
          amount: resolved.amount ?? '',
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setResolving(false);
      setTimeout(() => {
        setScanning(true);
        setError(null);
      }, 2000);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Permission</Text>
          <Text style={styles.permissionText}>
            Camera access is needed to scan QR codes for payments.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
          <Text style={styles.topTitle}>Scan QR Code</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.bottomBar}>
          {resolving ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.statusText}>Resolving recipient...</Text>
            </View>
          ) : error ? (
            <View style={[styles.statusCard, styles.errorCard]}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.statusCard}>
              <Text style={styles.hintText}>Point camera at a UPI QR code</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME_SIZE = 240;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { color: colors.white, fontSize: 20 },
  topTitle: { ...typography.h3, color: colors.white },

  scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.white,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: radius.sm },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: radius.sm },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: radius.sm },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: radius.sm },

  bottomBar: {
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
  },
  errorCard: { backgroundColor: colors.dangerLight },
  statusText: { ...typography.body, color: colors.textPrimary },
  hintText: { ...typography.body, color: colors.textSecondary },
  errorIcon: { fontSize: 20 },
  errorText: { ...typography.body, color: colors.danger, flex: 1 },

  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  permissionIcon: { fontSize: 64 },
  permissionTitle: { ...typography.h2, color: colors.textPrimary },
  permissionText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  permissionBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  permissionBtnText: { ...typography.bodyMedium, color: colors.white },
  cancelText: { ...typography.body, color: colors.textSecondary },
});