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

const DATA_HISTORY = [
  {
    id: 'D-1024',
    timestamp: '2026-01-18 • 09:41 UTC',
    location: 'Lake Biwa intake',
    predictedClass: 'Low microbiological risk',
    confidence: 0.92,
    status: 'Cleared',
  },
  {
    id: 'D-1019',
    timestamp: '2026-01-18 • 07:22 UTC',
    location: 'Rural well cluster',
    predictedClass: 'Nitrate elevation suspected',
    confidence: 0.84,
    status: 'Review',
  },
  {
    id: 'D-1007',
    timestamp: '2026-01-17 • 18:04 UTC',
    location: 'Irrigation canal segment B',
    predictedClass: 'Turbidity-driven risk',
    confidence: 0.89,
    status: 'Alert',
  },
];

const CONTAINER_HISTORY = [
  {
    id: 'C-208',
    timestamp: '2026-01-18 • 10:02 UTC',
    location: 'Plant intake bottle A',
    predictedClass: 'Fill level optimal',
    confidence: 0.95,
    status: 'Cleared',
  },
  {
    id: 'C-203',
    timestamp: '2026-01-18 • 08:55 UTC',
    location: 'Irrigation canal grab',
    predictedClass: 'Surface film anomaly',
    confidence: 0.81,
    status: 'Review',
  },
  {
    id: 'C-195',
    timestamp: '2026-01-17 • 19:11 UTC',
    location: 'Downstream industrial outflow',
    predictedClass: 'Strong color cast detected',
    confidence: 0.9,
    status: 'Alert',
  },
];

const STATUS_STYLES = {
  Cleared: 'border-emerald-500/60 bg-emerald-500/15',
  Review: 'border-amber-500/60 bg-amber-500/10',
  Alert: 'border-rose-500/60 bg-rose-500/10',
};

const STATUS_TEXT_CLASSES = {
  Cleared: 'text-sky-50',
  Review: 'text-amber-200',
  Alert: 'text-rose-200',
};

const PredictionHistoryScreen = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('data'); // 'data' | 'container'
  const [selectedId, setSelectedId] = useState(null);
  const screenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 450,
      delay: 80,
      useNativeDriver: true,
    }).start();
  }, [screenAnim]);

  const items = activeTab === 'data' ? DATA_HISTORY : CONTAINER_HISTORY;

  const renderCard = (item) => {
    const statusClass = STATUS_STYLES[item.status] || 'border-sky-700 bg-sky-900/40';
    const statusTextClass = STATUS_TEXT_CLASSES[item.status] || 'text-sky-100';
    const isSelected = selectedId === item.id;

    return (
      <View
        key={item.id}
        className="mb-3 rounded-2xl border border-sky-900/80 bg-aquadark/80 p-4"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
              {activeTab === 'data' ? 'Sample' : 'Container'}
            </Text>
            <Text className="mt-1 text-[13px] font-semibold text-sky-50">
              {item.location}
            </Text>
            <Text className="mt-0.5 text-[11px] text-slate-400">{item.id} • {item.timestamp}</Text>
          </View>
          <View
            className={`rounded-full border px-3 py-1 ${statusClass}`}
          >
            <Text className={`text-[11px] font-medium ${statusTextClass}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
              Predicted class
            </Text>
            <Text className="mt-1 text-[13px] text-sky-50">
              {item.predictedClass}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
              Confidence
            </Text>
            <Text className="mt-1 text-[13px] font-semibold text-sky-50">
              {(item.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        <View className="mt-3 h-1.5 w-full rounded-full bg-sky-900/60">
          <View
            className="h-full rounded-full bg-aquaprimary"
            style={{ width: `${Math.min(100, Math.max(5, item.confidence * 100))}%` }}
          />
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[11px] text-slate-500">
            Status combines model output with simple rules.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedId(isSelected ? null : item.id)}
            className="rounded-full border border-aquaprimary/70 bg-aquaprimary/10 px-3 py-1"
          >
            <Text className="text-[11px] font-medium text-sky-50">
              {isSelected ? 'Hide details' : 'View details'}
            </Text>
          </TouchableOpacity>
        </View>

        {isSelected && (
          <View className="mt-3 rounded-xl border border-sky-900/70 bg-sky-950/60 p-3">
            <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
              Details
            </Text>
            <Text className="mt-1 text-[12px] text-slate-300">
              This is a compact summary of the run. Integrate this
              card later with backend metadata (raw physicochemical
              values, analyst notes, and linked image batches).
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-aquadark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        className="flex-1"
        style={{
          opacity: screenAnim,
          transform: [
            {
              translateY: screenAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
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
        <Text className="text-[22px] font-bold text-sky-100">Predictions history</Text>
        <Text className="mt-1 text-[13px] text-slate-400">
          Review recent model runs across physicochemical samples and
          container images.
        </Text>

        <View className="mt-4 rounded-full bg-slate-950/70 p-1 flex-row">
          <TouchableOpacity
            activeOpacity={0.9}
            className={`flex-1 rounded-full px-3 py-1.5 ${
              activeTab === 'data' ? 'bg-aquaprimary/25' : 'bg-transparent'
            }`}
            onPress={() => setActiveTab('data')}
          >
            <Text
              className={`text-center text-[12px] font-medium ${
                activeTab === 'data' ? 'text-sky-50' : 'text-slate-400'
              }`}
            >
              Data history
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            className={`flex-1 rounded-full px-3 py-1.5 ${
              activeTab === 'container' ? 'bg-aquaprimary/25' : 'bg-transparent'
            }`}
            onPress={() => setActiveTab('container')}
          >
            <Text
              className={`text-center text-[12px] font-medium ${
                activeTab === 'container' ? 'text-sky-50' : 'text-slate-400'
              }`}
            >
              Container history
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="px-5"
        contentContainerClassName="pb-10 pt-1"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-1 rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            {activeTab === 'data' ? 'Data predictions' : 'Container predictions'}
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Each entry shows timestamp, sample or location, predicted
            class, confidence, status, and a quick details toggle.
          </Text>
        </View>

        <View className="mt-3">
          {items.map(renderCard)}
        </View>
      </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

export default PredictionHistoryScreen;
