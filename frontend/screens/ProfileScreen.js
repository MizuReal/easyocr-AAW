import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';
import InputField from '../components/InputField';
import PredictButton from '../components/PredictButton';

const ProfileScreen = ({ onNavigate }) => {
  const [profile, setProfile] = useState({
    name: 'Water quality analyst',
    email: 'you@example.com',
    organization: 'Lab / utility name',
  });
  const screenAnim = useRef(new Animated.Value(0)).current;

  const handleChange = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Placeholder for backend integration
    console.log('Profile updated', profile);
  };

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 450,
      delay: 50,
      useNativeDriver: true,
    }).start();
  }, [screenAnim]);

  return (
    <Animated.View
      className="flex-1 bg-aquadark"
      style={{
        opacity: screenAnim,
        transform: [
          {
            translateY: screenAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View className="px-5 pt-10 pb-3">
        <View className="mb-2 flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.8}
            className="rounded-full border border-sky-900/70 bg-aquadark/80 px-3 py-1.5"
            onPress={() => onNavigate && onNavigate('home')}
          >
            <Text className="text-[12px] font-medium text-sky-100">⟵ Dashboard</Text>
          </TouchableOpacity>
          <View className="rounded-full border border-slate-800/70 bg-slate-950/70 px-3 py-1">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Ops Live
            </Text>
          </View>
        </View>

        <View className="mt-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-sky-900/80">
            <Text className="text-[18px] font-semibold text-sky-50">WA</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-semibold text-sky-100">
              {profile.name || 'Analyst profile'}
            </Text>
            <Text className="mt-0.5 text-[12px] text-slate-400">
              Profile, preferences and personal data footprint.
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="px-5"
        contentContainerClassName="pb-10 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Update account */}
        <View className="mt-1 rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Account
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Basic profile details used across reports and exports.
          </Text>

          <View className="mt-3">
            <InputField
              label="Display name"
              value={profile.name}
              onChangeText={(v) => handleChange('name', v)}
              placeholder="e.g. Lake operations team"
            />
          </View>
          <View className="mt-3">
            <InputField
              label="Email"
              value={profile.email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={(v) => handleChange('email', v)}
              placeholder="you@example.com"
            />
          </View>
          <View className="mt-3">
            <InputField
              label="Organization / lab"
              value={profile.organization}
              onChangeText={(v) => handleChange('organization', v)}
              placeholder="e.g. City water laboratory"
            />
          </View>

          <View className="mt-4">
            <PredictButton title="Save changes" onPress={handleSave} />
            <Text className="mt-2 text-[11px] text-slate-500">
              Changes are kept locally for now. Connect a backend later to
              sync across devices.
            </Text>
          </View>
        </View>

        {/* My data summary */}
        <View className="rounded-2xl border border-sky-900/80 bg-aquadark/80 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            My data
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Quick snapshot of how you have used the system recently.
          </Text>

          <View className="mt-3 gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[13px] text-sky-100">Samples logged</Text>
                <Text className="text-[11px] text-slate-400">
                  Physicochemical entries captured in the last week.
                </Text>
              </View>
              <View className="rounded-full bg-sky-900/80 px-3 py-1">
                <Text className="text-[12px] font-semibold text-sky-50">24</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[13px] text-sky-100">Container analyses</Text>
                <Text className="text-[11px] text-slate-400">
                  Imaging-based container checks you have run.
                </Text>
              </View>
              <View className="rounded-full bg-sky-900/80 px-3 py-1">
                <Text className="text-[12px] font-semibold text-sky-50">9</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[13px] text-sky-100">Alerts reviewed</Text>
                <Text className="text-[11px] text-slate-400">
                  Flagged runs you have inspected from history.
                </Text>
              </View>
              <View className="rounded-full bg-rose-500/10 px-3 py-1">
                <Text className="text-[12px] font-semibold text-rose-200">3</Text>
              </View>
            </View>
          </View>

          <View className="mt-4 flex-row justify-between">
            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-full border border-aquaprimary/70 bg-aquaprimary/10 px-3 py-1.5"
              onPress={() => onNavigate && onNavigate('predictionHistory')}
            >
              <Text className="text-[11px] font-medium text-sky-50">
                View prediction history
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-full border border-sky-800 bg-aquadark px-3 py-1.5"
              onPress={() => onNavigate && onNavigate('dataInput')}
            >
              <Text className="text-[11px] font-medium text-sky-100">
                New sample
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

export default ProfileScreen;
