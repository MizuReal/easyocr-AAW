import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';

const RISK_SERIES = [
  { id: 'AQ-024', label: 'Now', value: 0.18 },
  { id: 'AQ-023', label: '-1h', value: 0.24 },
  { id: 'AQ-022', label: '-3h', value: 0.31 },
  { id: 'AQ-021', label: '-6h', value: 0.27 },
  { id: 'AQ-020', label: '-12h', value: 0.34 },
];

const STATUS_DISTRIBUTION = [
  { label: 'Cleared', value: 62, color: 'bg-emerald-500' },
  { label: 'Review', value: 26, color: 'bg-amber-400' },
  { label: 'Alert', value: 12, color: 'bg-rose-500' },
];

const PARAMETER_SUMMARY = [
  { label: 'pH', value: 7.2, band: 'Neutral', color: 'bg-sky-400' },
  { label: 'Turbidity (NTU)', value: 1.4, band: 'Clear', color: 'bg-emerald-400' },
  { label: 'Nitrate (mg/L)', value: 3.2, band: 'Comfortable', color: 'bg-amber-300' },
  { label: 'TDS (mg/L)', value: 220, band: 'Within range', color: 'bg-sky-500' },
];

const AnalysisScreen = ({ onNavigate }) => {
  const totalStatus = STATUS_DISTRIBUTION.reduce((sum, item) => sum + item.value, 0) || 1;
  const screenAnim = useRef(new Animated.Value(0)).current;

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
        <Text className="text-[22px] font-bold text-sky-100">Analysis & trends</Text>
        <Text className="mt-1 text-[13px] text-slate-400">
          High-level view of risk, recent predictions and core parameters.
        </Text>
      </View>

      <ScrollView
        className="px-5"
        contentContainerClassName="pb-10 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Overview card */}
        <View className="mt-1 rounded-2xl border border-emerald-500/70 bg-emerald-900/10 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
            System overview
          </Text>
          <Text className="mt-1 text-[14px] font-semibold text-emerald-100">
            Current risk is low and stable across the last sampling window.
          </Text>
          <Text className="mt-2 text-[12px] text-slate-300">
            Most recent physicochemical inputs sit within comfortable bands. A
            few batches are flagged for review, mainly driven by turbidity and
            nitrate shifts, but alerts remain a minority of runs.
          </Text>
        </View>

        {/* Risk trend mini-graph */}
        <View className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Risk index trend
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Simple view of the model risk index across recent samples.
          </Text>

          <View className="mt-3 h-24 flex-row items-end justify-between gap-2">
            {RISK_SERIES.map((point) => {
              const height = 30 + point.value * 80; // 0–1 mapped to 30–110
              return (
                <View key={point.id} className="items-center flex-1">
                  <View
                    className="w-5 rounded-full bg-aquaprimary/80"
                    style={{ height }}
                  />
                  <Text className="mt-1 text-[10px] text-slate-400">
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="mt-3 flex-row justify-between">
            <Text className="text-[11px] text-slate-400">
              Recent window: 12 hours of samples.
            </Text>
            <Text className="text-[11px] text-sky-200">Index range · 0.18–0.34</Text>
          </View>
        </View>

        {/* Status distribution graph */}
        <View className="rounded-2xl border border-sky-900/70 bg-aquadark/80 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Prediction outcomes
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Distribution of cleared, review and alert decisions.
          </Text>

          <View className="mt-3 h-3 w-full flex-row overflow-hidden rounded-full bg-slate-900/80">
            {STATUS_DISTRIBUTION.map((item) => (
              <View
                key={item.label}
                className={`${item.color}`}
                style={{ flex: item.value / totalStatus }}
              />
            ))}
          </View>

          <View className="mt-3 flex-row flex-wrap gap-y-1">
            {STATUS_DISTRIBUTION.map((item) => (
              <View key={item.label} className="mr-4 flex-row items-center">
                <View className={`mr-1.5 h-2 w-2 rounded-full ${item.color}`} />
                <Text className="text-[11px] text-slate-300">
                  {item.label} · {item.value}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Parameter bands */}
        <View className="rounded-2xl border border-sky-900/80 bg-sky-950/40 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Core parameters snapshot
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Normalized bars for the key physicochemical parameters feeding the model.
          </Text>

          <View className="mt-3 gap-3">
            {PARAMETER_SUMMARY.map((param) => {
              const normalized = 0.2 + Math.random() * 0.6; // placeholder until wired to real data
              return (
                <View key={param.label} className="mb-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12px] text-sky-100">{param.label}</Text>
                    <Text className="text-[11px] text-slate-400">
                      {param.value} · {param.band}
                    </Text>
                  </View>
                  <View className="mt-1 h-2 w-full rounded-full bg-slate-900/80">
                    <View
                      className={`h-full rounded-full ${param.color}`}
                      style={{ width: `${normalized * 100}%` }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

export default AnalysisScreen;
