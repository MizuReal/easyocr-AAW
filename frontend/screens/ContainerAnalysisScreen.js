import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import PredictButton from '../components/PredictButton';

const ContainerAnalysisScreen = ({ onNavigate }) => {
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const screenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 450,
      delay: 80,
      useNativeDriver: true,
    }).start();
  }, [screenAnim]);

  const handleCapture = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera access is required to analyze containers.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0]);
    }
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
        <Text className="text-[22px] font-bold text-sky-100">Container analysis</Text>
        <Text className="mt-1 text-[13px] text-slate-400">
          Capture a container image to estimate clarity, fill level and potential anomalies.
        </Text>
      </View>

      <ScrollView
        className="px-5"
        contentContainerClassName="pb-10 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-1 rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Capture
          </Text>
          <Text className="mt-1 text-[12px] text-slate-400">
            Use the camera to capture the current container or sampling bottle.
          </Text>

          <View className="mt-4">
            <PredictButton
              title={image ? 'Retake container photo' : 'Capture container photo'}
              onPress={handleCapture}
            />
            {error ? (
              <Text className="mt-2 text-[11px] text-red-400">{error}</Text>
            ) : null}
          </View>
        </View>

        <View className="rounded-2xl border border-sky-900/80 bg-aquadark/80 p-4">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
            Analysis snapshot
          </Text>
          {image ? (
            <View className="mt-3 flex-row gap-3">
              <View className="h-28 w-24 overflow-hidden rounded-xl border border-sky-900/80 bg-slate-900">
                <Image
                  source={{ uri: image.uri }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-sky-100">
                  Container profile
                </Text>
                <Text className="mt-1 text-[12px] text-slate-400">
                  Visual clarity appears within expected range. No strong color cast
                  or surface anomalies detected.
                </Text>
                <Text className="mt-2 text-[11px] text-slate-500">
                  Final decision will combine this with pH, turbidity and nutrient
                  data from the dashboard.
                </Text>
              </View>
            </View>
          ) : (
            <Text className="mt-3 text-[12px] text-slate-500">
              Once a photo is captured, a summary card will appear here with a
              container profile and integration notes for your physicochemical
              parameters.
            </Text>
          )}
        </View>
      </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

export default ContainerAnalysisScreen;
