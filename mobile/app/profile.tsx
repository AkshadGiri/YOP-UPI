import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { getApiErrorMessage } from '../services/api';
import * as userService from '../services/userService';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../utils/theme';
import { EditProfileForm, editProfileSchema } from '../utils/validation';

function formatCreatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  });

  // Refresh from the server on mount, in case the profile changed elsewhere
  // (e.g. another device) since this session's cached copy was written.
  useEffect(() => {
    userService
      .getProfile()
      .then((fresh) => {
        setUser(fresh);
        form.reset({ name: fresh.name, email: fresh.email });
      })
      .catch(() => {
        // Non-fatal — fall back to the cached copy already in the store.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access in your device settings to change your profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const updated = await userService.updateProfile({ profilePictureUrl: result.assets[0].uri });
      setUser(updated);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function onSave(values: EditProfileForm) {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const updated = await userService.updateProfile(values);
      setUser(updated);
      setIsEditing(false);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function onCancelEdit() {
    form.reset({ name: user?.name ?? '', email: user?.email ?? '' });
    setErrorMessage(null);
    setIsEditing(false);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.avatarSection}>
          <Pressable onPress={handlePickImage} disabled={isUploadingPhoto}>
            <Avatar name={user.name} uri={user.profilePictureUrl} size={96} />
            <View style={styles.avatarBadge}>
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.avatarBadgeText}>Edit</Text>
              )}
            </View>
          </Pressable>
        </View>

        {isEditing ? (
          <View style={styles.form}>
            <TextField
              label="Full name"
              autoCapitalize="words"
              value={form.watch('name')}
              onChangeText={(t) => form.setValue('name', t)}
              error={form.formState.errors.name?.message}
            />
            <TextField
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.watch('email')}
              onChangeText={(t) => form.setValue('email', t)}
              error={form.formState.errors.email?.message}
            />
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
            <PrimaryButton
              label="Save changes"
              loading={isSaving}
              onPress={form.handleSubmit(onSave)}
            />
            <Text style={styles.cancelLink} onPress={onCancelEdit}>
              Cancel
            </Text>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <InfoRow label="Name" value={user.name} />
            <InfoRow label="UPI ID" value={user.upiId} highlight />
            <InfoRow label="Phone" value={user.phone} note="Cannot be changed" />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Member since" value={formatCreatedDate(user.createdAt)} />
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
            <PrimaryButton label="Edit profile" onPress={() => setIsEditing(true)} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
      {note ? <Text style={styles.infoNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing.lg, flexGrow: 1 },
  headerRow: { marginBottom: spacing.md },
  backLink: { color: colors.primary, fontSize: typography.body.fontSize, fontWeight: '600' },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  avatarBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  form: {},
  errorBanner: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: typography.caption.fontSize,
  },
  cancelLink: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
  },
  infoSection: {},
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  infoValueHighlight: { color: colors.primary },
  infoNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
