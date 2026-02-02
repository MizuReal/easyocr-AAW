import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import * as ImageManipulator from 'expo-image-manipulator';
import InputField from '../components/InputField';
import PredictButton from '../components/PredictButton';
import { uploadDataCardForOCR, validateFiducials, submitWaterSample } from '../utils/api';
import WaterResultScreen from './WaterResultScreen';

const colorOptions = ['Clear', 'Slightly tinted', 'Yellow-brown', 'Greenish'];
const sourceOptions = ['Surface water', 'Groundwater', 'Treated supply', 'Industrial effluent', 'Agricultural runoff'];

const numericFormFields = [
  'pH',
  'hardness',
  'solids',
  'chloramines',
  'sulfate',
  'conductivity',
  'organicCarbon',
  'trihalomethanes',
  'turbidity',
  'freeChlorineResidual',
];

const parseNumericInput = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const canonicalizeFieldKey = (key = '') => key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const backendFieldAliasMap = {
  ph: 'pH',
  hydrogenion: 'pH',
  hardness: 'hardness',
  totalhardness: 'hardness',
  solids: 'solids',
  totaldissolvedsolids: 'solids',
  tds: 'solids',
  chloramines: 'chloramines',
  sulfate: 'sulfate',
  sulphate: 'sulfate',
  conductivity: 'conductivity',
  electricalconductivity: 'conductivity',
  organiccarbon: 'organicCarbon',
  toc: 'organicCarbon',
  totalorganiccarbon: 'organicCarbon',
  trihalomethanes: 'trihalomethanes',
  thm: 'trihalomethanes',
  turbidity: 'turbidity',
  freechlorineresidual: 'freeChlorineResidual',
  freechlorine: 'freeChlorineResidual',
  residualchlorine: 'freeChlorineResidual',
};

const resolveOcrFieldKey = (key) => backendFieldAliasMap[canonicalizeFieldKey(key ?? '')];

const orientationRotationMap = {
  1: 0,
  3: 180,
  6: 90,
  8: -90,
};

const WATER_CARD_ASPECT = 1080 / 1240;
const WINDOW_DIMENSIONS = Dimensions.get('window');
const MAX_GUIDE_WIDTH = WINDOW_DIMENSIONS.width - 32;
const MAX_GUIDE_HEIGHT = WINDOW_DIMENSIONS.height * 0.78;
const CAPTURE_GUIDE_WIDTH = Math.min(MAX_GUIDE_WIDTH, MAX_GUIDE_HEIGHT * WATER_CARD_ASPECT);
const CAPTURE_GUIDE_HEIGHT = CAPTURE_GUIDE_WIDTH / WATER_CARD_ASPECT;
const AUTO_CAPTURE_START_THRESHOLD = 0.55; // Lower threshold - fiducials are the main check
const AUTO_CAPTURE_CANCEL_THRESHOLD = 0.35;
const AUTO_CAPTURE_START_MS = 1200; // Faster capture once ready
const MAX_ACCEL_DELTA = 0.35;
const FIDUCIAL_CHECK_INTERVAL_MS = 450; // Check more frequently
const MIN_FIDUCIALS_FOR_CAPTURE = 4; // Require all 4 corners

const deriveAlignmentScore = ({ x = 0, y = 0, z = 0 }) => {
  const magnitude = Math.max(1e-3, Math.sqrt(x * x + y * y + z * z));
  const normX = x / magnitude;
  const normY = y / magnitude;
  const normZ = z / magnitude;
  const gravityDrift = Math.min(1, Math.abs(magnitude - 1));
  const tiltPenalty = Math.min(1, Math.abs(Math.abs(normZ) - 1));
  const lateralMotion = Math.min(1, Math.sqrt(normX * normX + normY * normY));
  const score = 1 - (0.5 * tiltPenalty + 0.3 * gravityDrift + 0.2 * lateralMotion);
  return Math.max(0, Math.min(1, score));
};

const computeJitterPenalty = (previousSample, currentSample) => {
  if (!previousSample || !currentSample) {
    return 0;
  }
  const dx = (currentSample.x || 0) - (previousSample.x || 0);
  const dy = (currentSample.y || 0) - (previousSample.y || 0);
  const dz = (currentSample.z || 0) - (previousSample.z || 0);
  const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.min(1, delta / MAX_ACCEL_DELTA);
};

const preprocessImage = async (asset) => {
  if (!asset?.uri) {
    return asset;
  }

  const steps = [];
  const options = { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG };
  let workingUri = asset.uri;
  let currentWidth = asset.width;
  let currentHeight = asset.height;

  const orientation = asset.exif?.Orientation;
  const rotation = orientationRotationMap[orientation] || 0;
  if (rotation) {
    const rotated = await ImageManipulator.manipulateAsync(workingUri, [{ rotate: rotation }], options);
    workingUri = rotated.uri;
    currentWidth = rotated.width;
    currentHeight = rotated.height;
    steps.push(`orientation +${rotation}°`);
  }

  const targetEdge = 1600;
  const longestEdge = Math.max(currentWidth || 0, currentHeight || 0);
  if (longestEdge > targetEdge) {
    const resizeAction =
      (currentWidth || 0) >= (currentHeight || 0)
        ? { width: targetEdge }
        : { height: targetEdge };
    const resized = await ImageManipulator.manipulateAsync(workingUri, [{ resize: resizeAction }], options);
    workingUri = resized.uri;
    currentWidth = resized.width;
    currentHeight = resized.height;
    steps.push(`downscale → ${Math.round(Math.max(currentWidth, currentHeight))}px`);
  }

  if (currentWidth && currentHeight) {
    const marginX = Math.round(currentWidth * 0.025);
    const marginY = Math.round(currentHeight * 0.025);
    const cropWidth = currentWidth - marginX * 2;
    const cropHeight = currentHeight - marginY * 2;
    if (cropWidth > 0 && cropHeight > 0) {
      const cropped = await ImageManipulator.manipulateAsync(
        workingUri,
        [
          {
            crop: {
              originX: marginX,
              originY: marginY,
              width: cropWidth,
              height: cropHeight,
            },
          },
        ],
        options
      );
      workingUri = cropped.uri;
      currentWidth = cropped.width;
      currentHeight = cropped.height;
      steps.push('trim 5% border');
    }
  }

  return {
    ...asset,
    uri: workingUri,
    width: currentWidth,
    height: currentHeight,
    _preprocessSteps: steps,
  };
};

const DataInputScreen = ({ onNavigate }) => {
  const [form, setForm] = useState({
    pH: '',
    hardness: '',
    solids: '',
    chloramines: '',
    sulfate: '',
    conductivity: '',
    organicCarbon: '',
    trihalomethanes: '',
    turbidity: '',
    freeChlorineResidual: '',
    color: 'Clear',
    source: 'Surface water',
  });
  const [capturePreview, setCapturePreview] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrApplied, setOcrApplied] = useState(false);
  const [preprocessing, setPreprocessing] = useState(false);
  const [preprocessNotes, setPreprocessNotes] = useState('');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [alignmentStatus, setAlignmentStatus] = useState('');
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState(0);
  const [predictionResult, setPredictionResult] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Fiducial detection state
  const [fiducialCount, setFiducialCount] = useState(0);
  const [fiducialQuality, setFiducialQuality] = useState(0);
  const [fiducialReady, setFiducialReady] = useState(false);
  const spinnerValue = useRef(new Animated.Value(0)).current;
  const spinnerLoop = useRef(null);
  const cameraRef = useRef(null);
  const heroAnim = useRef(new Animated.Value(0)).current;
  const sectionsAnim = useRef(new Animated.Value(0)).current;
  const accelerometerSubscriptionRef = useRef(null);
  const autoCaptureTimerRef = useRef(null);
  const autoCaptureLockRef = useRef(false);
  const lastAccelSampleRef = useRef(null);
  // Fiducial validation refs
  const fiducialCheckIntervalRef = useRef(null);
  const fiducialCheckInProgressRef = useRef(false);

  const clearAutoCaptureTimer = useCallback(
    (preserveLock = false) => {
      if (autoCaptureTimerRef.current) {
        clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      // Clear fiducial check interval
      if (fiducialCheckIntervalRef.current) {
        clearInterval(fiducialCheckIntervalRef.current);
        fiducialCheckIntervalRef.current = null;
      }
      fiducialCheckInProgressRef.current = false;
      if (!preserveLock) {
        autoCaptureLockRef.current = false;
      }
      setAutoCaptureCountdown(0);
    },
    []
  );

  const stopAlignmentMonitoring = useCallback(() => {
    accelerometerSubscriptionRef.current?.remove?.();
    accelerometerSubscriptionRef.current = null;
    lastAccelSampleRef.current = null;
    // Reset fiducial state
    if (fiducialCheckIntervalRef.current) {
      clearInterval(fiducialCheckIntervalRef.current);
      fiducialCheckIntervalRef.current = null;
    }
    fiducialCheckInProgressRef.current = false;
    setFiducialCount(0);
    setFiducialQuality(0);
    setFiducialReady(false);
  }, []);

  useEffect(() => {
    if (ocrLoading) {
      spinnerLoop.current?.stop();
      spinnerLoop.current = Animated.loop(
        Animated.timing(spinnerValue, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinnerLoop.current.start();
    } else {
      spinnerLoop.current?.stop();
      spinnerValue.setValue(0);
    }

    return () => {
      spinnerLoop.current?.stop();
    };
  }, [ocrLoading, spinnerValue]);

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 500,
        delay: 80,
        useNativeDriver: true,
      }),
      Animated.timing(sectionsAnim, {
        toValue: 1,
        duration: 500,
        delay: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, sectionsAnim]);

  // Fiducial validation function - captures a frame and sends to backend for validation
  const checkFiducials = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || fiducialCheckInProgressRef.current || autoCaptureLockRef.current) {
      return;
    }
    fiducialCheckInProgressRef.current = true;
    try {
      // Take a snapshot for corner detection (good quality for reliable detection)
      const snapshot = await cameraRef.current.takePictureAsync({
        quality: 0.75,  // Higher quality for better corner detection
        base64: false,
        exif: false,
        skipProcessing: false,  // Allow processing for better image
      });
      if (!snapshot?.uri) {
        return;
      }
      const result = await validateFiducials(snapshot);
      setFiducialCount(result.detected || 0);
      setFiducialQuality(result.quality || 0);
      setFiducialReady(result.ready || false);
      console.debug('[fiducial] Validation result:', result);
    } catch (error) {
      console.debug('[fiducial] Check failed:', error?.message);
    } finally {
      fiducialCheckInProgressRef.current = false;
    }
  }, [cameraReady]);

  useEffect(() => {
    if (!cameraVisible) {
      stopAlignmentMonitoring();
      clearAutoCaptureTimer();
      setAlignmentScore(0);
      setAlignmentStatus('');
      setFiducialCount(0);
      setFiducialQuality(0);
      setFiducialReady(false);
      lastAccelSampleRef.current = null;
      return;
    }
    Accelerometer.setUpdateInterval(150);
    accelerometerSubscriptionRef.current = Accelerometer.addListener((data) => {
      const baseScore = deriveAlignmentScore(data);
      const jitterPenalty = computeJitterPenalty(lastAccelSampleRef.current, data) * 0.45;
      lastAccelSampleRef.current = data;
      const composite = Math.max(0, Math.min(1, baseScore - jitterPenalty));
      setAlignmentScore((prev) => (Number.isFinite(prev) ? prev * 0.55 + composite * 0.45 : composite));
    });
    
    // Start periodic fiducial checks
    fiducialCheckIntervalRef.current = setInterval(() => {
      if (cameraReady && !autoCaptureLockRef.current) {
        checkFiducials();
      }
    }, FIDUCIAL_CHECK_INTERVAL_MS);
    
    return () => {
      stopAlignmentMonitoring();
      clearAutoCaptureTimer();
      setAlignmentScore(0);
      setAlignmentStatus('');
      setFiducialCount(0);
      setFiducialQuality(0);
      setFiducialReady(false);
      lastAccelSampleRef.current = null;
    };
  }, [cameraVisible, cameraReady, clearAutoCaptureTimer, stopAlignmentMonitoring, checkFiducials]);

  const spinnerRotation = spinnerValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const ensureCameraPermission = useCallback(async () => {
    try {
      const current = await Camera.getCameraPermissionsAsync();
      if (current.status === 'granted') {
        return true;
      }
      const requested = await Camera.requestCameraPermissionsAsync();
      if (requested.status === 'granted') {
        return true;
      }
    } catch (error) {
      console.error('Camera permission error:', error);
    }
    setCameraError('Camera access is required to capture parameter cards.');
    return false;
  }, []);

  const handlePhotoResult = useCallback(async (asset) => {
    if (!asset) return;
    setPreprocessNotes('');
    setPreprocessing(true);
    try {
      const previewAsset = await preprocessImage(asset);
      setCapturePreview(previewAsset);
      if (previewAsset?._preprocessSteps?.length) {
        setPreprocessNotes(`Preview normalized (${previewAsset._preprocessSteps.join(', ')})`);
      } else {
        setPreprocessNotes('Capture preview used as-is (already aligned).');
      }
      await processCaptureWithOCR(previewAsset || asset);
    } catch (error) {
      console.error('Preprocessing failed:', error);
      setCameraError('Failed to normalize capture for OCR. Try again.');
    } finally {
      setPreprocessing(false);
    }
  }, [processCaptureWithOCR]);

  const handleOpenCamera = useCallback(async () => {
    setCameraError('');
    setOcrError('');
    setOcrApplied(false);
    setPreprocessNotes('');
    setPreprocessing(false);
    clearAutoCaptureTimer();
    setAlignmentScore(0);
    setAlignmentStatus('');
    const granted = await ensureCameraPermission();
    if (!granted) return;
    setCameraReady(false);
    setCameraVisible(true);
  }, [clearAutoCaptureTimer, ensureCameraPermission]);

  const handleCloseCamera = useCallback(() => {
    setCameraVisible(false);
    setCameraReady(false);
    stopAlignmentMonitoring();
    clearAutoCaptureTimer();
    setAlignmentScore(0);
    setAlignmentStatus('');
    setAutoCaptureCountdown(0);
    autoCaptureLockRef.current = false;
  }, [clearAutoCaptureTimer, stopAlignmentMonitoring]);

  const handleTakePhoto = useCallback(
    async (autoTriggered = false) => {
      if (!cameraRef.current) return;
      if (!cameraReady) {
        setCameraError('Camera is still focusing. Hold steady.');
        return;
      }
      if (!autoTriggered) {
        clearAutoCaptureTimer();
      }
      console.debug('[capture] takePicture invoked', { autoTriggered });
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          base64: false,
          exif: true,
          skipProcessing: true,
        });
        handleCloseCamera();
        await handlePhotoResult(photo);
      } catch (error) {
        console.error('Capture failed:', error);
        setCameraError(`Unable to capture photo: ${error?.message || 'Unknown error'}`);
        handleCloseCamera();
      } finally {
        autoCaptureLockRef.current = false;
        clearAutoCaptureTimer();
      }
    },
    [cameraReady, clearAutoCaptureTimer, handleCloseCamera, handlePhotoResult]
  );

  useEffect(() => {
    if (!cameraVisible) {
      setAlignmentStatus('Camera closed');
      clearAutoCaptureTimer();
      return;
    }
    if (!cameraReady) {
      setAlignmentStatus('Focusing camera…');
      clearAutoCaptureTimer();
      return;
    }
    if (!autoCaptureEnabled) {
      setAlignmentStatus('Auto capture disabled');
      clearAutoCaptureTimer();
      return;
    }
    if (autoCaptureLockRef.current) {
      setAlignmentStatus('Capturing…');
      return;
    }
    
    // NEW: Require fiducial detection for auto-capture (like QR code scanning)
    const fiducialsOk = fiducialCount >= MIN_FIDUCIALS_FOR_CAPTURE && fiducialReady;
    const stabilityOk = alignmentScore >= AUTO_CAPTURE_START_THRESHOLD;
    const bothConditionsMet = fiducialsOk && stabilityOk;
    
    // Generate status message based on what's missing
    let statusMessage = '';
    if (fiducialCount === 0) {
      statusMessage = 'Position the form — looking for corner markers…';
    } else if (fiducialCount < MIN_FIDUCIALS_FOR_CAPTURE) {
      statusMessage = `Found ${fiducialCount}/4 corners — adjust position`;
    } else if (!fiducialReady) {
      statusMessage = `All corners found — improve alignment (${Math.round(fiducialQuality * 100)}%)`;
    } else if (!stabilityOk) {
      statusMessage = 'Corners detected ✓ — hold steady';
    } else {
      statusMessage = 'All corners detected ✓ — auto capture arming';
    }
    
    if (bothConditionsMet && !autoCaptureTimerRef.current) {
      console.debug('[capture] Fiducials ready + alignment stable, starting countdown', {
        fiducialCount,
        fiducialQuality,
        alignmentScore,
      });
      setAlignmentStatus('All corners detected ✓ — capturing soon');
      const started = Date.now();
      setAutoCaptureCountdown(AUTO_CAPTURE_START_MS);
      autoCaptureTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - started;
        const remaining = Math.max(0, AUTO_CAPTURE_START_MS - elapsed);
        setAutoCaptureCountdown(remaining);
        if (remaining <= 0) {
          console.debug('[capture] auto capture firing');
          clearAutoCaptureTimer(true);
          autoCaptureLockRef.current = true;
          handleTakePhoto(true);
        }
      }, 120);
    } else if (!bothConditionsMet) {
      // Cancel countdown if conditions are no longer met
      if (autoCaptureTimerRef.current) {
        console.debug('[capture] Conditions lost, cancelling countdown', {
          fiducialCount,
          fiducialReady,
          alignmentScore,
        });
        clearAutoCaptureTimer();
      }
      setAlignmentStatus(statusMessage);
    } else {
      setAlignmentStatus(statusMessage);
    }
  }, [
    alignmentScore,
    autoCaptureEnabled,
    cameraReady,
    cameraVisible,
    clearAutoCaptureTimer,
    handleTakePhoto,
    fiducialCount,
    fiducialQuality,
    fiducialReady,
  ]);

  const cameraModal = (
    <Modal
      visible={cameraVisible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleCloseCamera}
    >
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          ratio="4:3"
          enableTorch={torchEnabled}
          onCameraReady={() => setCameraReady(true)}
        />
        <View className="pointer-events-none absolute inset-0">
          <View className="flex-1 items-center justify-center px-4">
            <View
              className="rounded-[32px] border-2 border-emerald-300/80 bg-black/45"
              style={{ width: CAPTURE_GUIDE_WIDTH, height: CAPTURE_GUIDE_HEIGHT }}
            >
              <View className="absolute inset-4 rounded-[28px] border border-dashed border-emerald-200/70" />
              <View className="absolute inset-x-6 top-5 h-[3px] rounded-full bg-emerald-200/70" />
              <View className="absolute inset-x-6 bottom-5 h-[3px] rounded-full bg-emerald-200/70" />
            </View>
          </View>
          <View className="absolute top-12 w-full items-center px-6">
            <Text className="text-center text-[16px] font-semibold text-emerald-50">
              Align the card within the frame
            </Text>
            <Text className="mt-1 text-center text-[12px] text-emerald-100/80">
              Fill the tall frame, keep all four fiducial squares visible, and avoid glare.
            </Text>
          </View>
          <View className="absolute inset-x-0 bottom-36 items-center px-10">
            <View className="w-full max-w-[360px]">
              {/* Fiducial detection indicator */}
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[12px] font-semibold uppercase tracking-wide text-emerald-100/90">
                  Corner Markers
                </Text>
                <View className="flex-row items-center gap-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <View
                      key={idx}
                      className={`h-3 w-3 rounded-sm ${
                        idx < fiducialCount
                          ? fiducialReady
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
                          : 'bg-white/20'
                      }`}
                    />
                  ))}
                  <Text className="ml-1 text-[12px] font-semibold text-emerald-50">
                    {fiducialCount}/4
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] font-semibold uppercase tracking-wide text-emerald-100/90">
                  Stability
                </Text>
                <Text className="text-[12px] font-semibold text-emerald-50">{alignmentPercent}%</Text>
              </View>
              <View className="mt-2 h-2 rounded-full bg-white/15">
                <View
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${Math.min(100, Math.max(0, alignmentPercent))}%` }}
                />
              </View>
              <Text className="mt-1 text-[11px] text-emerald-100/80">
                {alignmentStatus || 'Center the sheet and hold steady'}
              </Text>
            </View>
          </View>
        </View>
        <View className="absolute bottom-0 w-full px-6 pb-8">
          <View className="mb-4 flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.85}
              className={`flex-1 rounded-full border px-4 py-2 ${
                torchEnabled ? 'border-amber-300/80 bg-amber-500/30' : 'border-white/40 bg-black/50'
              }`}
              onPress={() => setTorchEnabled((prev) => !prev)}
            >
              <Text className="text-center text-[13px] font-semibold text-white">
                Flash {torchEnabled ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              className={`flex-1 rounded-full border px-4 py-2 ${
                autoCaptureEnabled ? 'border-emerald-300/80 bg-emerald-500/20' : 'border-white/40 bg-black/50'
              }`}
              onPress={() => {
                setAutoCaptureEnabled((prev) => {
                  const next = !prev;
                  if (!next) {
                    clearAutoCaptureTimer();
                  }
                  return next;
                });
              }}
            >
              <Text className="text-center text-[13px] font-semibold text-white">
                Auto Capture {autoCaptureEnabled ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="mb-3 h-[1px] bg-white/30" />
          <View className="flex-row items-center justify-between gap-4">
            <TouchableOpacity
              activeOpacity={0.8}
              className="flex-1 rounded-full border border-white/40 bg-black/60 px-4 py-3"
              onPress={handleCloseCamera}
            >
              <Text className="text-center text-[14px] font-medium text-white">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              className={`flex-1 rounded-full px-4 py-3 ${
                cameraReady ? 'bg-emerald-500' : 'bg-emerald-500/40'
              }`}
              disabled={!cameraReady}
              onPress={handleTakePhoto}
            >
              <Text className="text-center text-[15px] font-semibold text-emerald-50">Capture</Text>
            </TouchableOpacity>
          </View>
          <Text className="mt-2 text-center text-[11px] text-white/70">{captureStatusText}</Text>
        </View>
      </View>
    </Modal>
  );

  const processCaptureWithOCR = useCallback(async (asset) => {
    if (!asset) return;
    setOcrLoading(true);
    setOcrError('');
    setOcrApplied(false);
    try {
      console.log('OCR upload starting:', asset.uri);
      const response = await uploadDataCardForOCR(asset);
      const parsed = response?.parsed || {};
      console.log('OCR parsed payload:', parsed);
      const sanitized = {};
      Object.entries(parsed).forEach(([rawKey, value]) => {
        const canonicalKey = resolveOcrFieldKey(rawKey);
        if (!canonicalKey) {
          console.warn('[ocr] Unmapped field from backend:', rawKey, value);
          return;
        }
        if (!numericFormFields.includes(canonicalKey)) {
          console.warn('[ocr] Ignoring non-numeric field:', canonicalKey, value);
          return;
        }
        if (value === undefined || value === null || value === '') {
          console.warn('[ocr] Empty value skipped for field:', canonicalKey);
          return;
        }
        sanitized[canonicalKey] = String(value).trim();
      });

      if (Object.keys(sanitized).length === 0) {
        console.warn('[ocr] No mapped numeric fields detected from payload:', parsed);
        setOcrError('No structured values detected. Manually enter them.');
        return;
      }

      setForm((prev) => ({ ...prev, ...sanitized }));
      console.log('OCR parsing succeeded with fields:', sanitized);
      setOcrApplied(true);
    } catch (error) {
      console.error('OCR processing failed:', error);
      setOcrError(error.message || 'Failed to process capture.');
    } finally {
      setOcrLoading(false);
      console.log('OCR upload finished');
    }
  }, [setForm]);

  const handleCloseResult = useCallback(() => {
    setResultModalVisible(false);
  }, []);

  const buildSamplePayload = useCallback(() => {
    return {
      ph: parseNumericInput(form.pH),
      hardness: parseNumericInput(form.hardness),
      solids: parseNumericInput(form.solids),
      chloramines: parseNumericInput(form.chloramines),
      sulfate: parseNumericInput(form.sulfate),
      conductivity: parseNumericInput(form.conductivity),
      organicCarbon: parseNumericInput(form.organicCarbon),
      trihalomethanes: parseNumericInput(form.trihalomethanes),
      turbidity: parseNumericInput(form.turbidity),
      freeChlorineResidual: parseNumericInput(form.freeChlorineResidual),
      color: form.color,
      source: form.source,
    };
  }, [form]);

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    setResultModalVisible(false);
    const payload = buildSamplePayload();
    const numericValues = [
      payload.ph,
      payload.hardness,
      payload.solids,
      payload.chloramines,
      payload.sulfate,
      payload.conductivity,
      payload.organicCarbon,
      payload.trihalomethanes,
      payload.turbidity,
      payload.freeChlorineResidual,
    ].filter((value) => typeof value === 'number' && Number.isFinite(value));

    if (numericValues.length < 3) {
      setSubmitError('Enter at least three numeric parameters before running checks.');
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await submitWaterSample(payload);
      setPredictionResult(result);
      setResultModalVisible(true);
    } catch (error) {
      setSubmitError(error?.message || 'Failed to save and analyze sample.');
    } finally {
      setSubmitLoading(false);
    }
  }, [buildSamplePayload]);

  const alignmentPercent = Math.round(alignmentScore * 100);
  const countdownSeconds = (autoCaptureCountdown / 1000).toFixed(1);
  const countdownLabel = autoCaptureEnabled && autoCaptureCountdown > 0 ? ` · auto capture in ${countdownSeconds}s` : '';
  const captureStatusText = cameraReady
    ? autoCaptureEnabled
      ? `${alignmentStatus || 'Hold steady for auto capture'} · alignment ${alignmentPercent}%${countdownLabel}`
      : `Manual capture · alignment ${alignmentPercent}%`
    : 'Initializing camera…';

  return (
    <>
      {cameraModal}
      <WaterResultScreen
        visible={resultModalVisible && Boolean(predictionResult)}
        result={predictionResult}
        onClose={handleCloseResult}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-aquadark"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="px-5 pt-10"
          contentContainerClassName="pb-20 gap-6"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            }}
            className="rounded-[34px] border border-sky-900/70 bg-gradient-to-br from-slate-950/90 via-sky-950/30 to-emerald-900/20 px-5 pb-6 pt-7"
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                activeOpacity={0.85}
                className="rounded-full border border-sky-900/70 bg-slate-950/60 px-3 py-1.5"
                onPress={() => onNavigate && onNavigate('home')}
              >
                <Text className="text-[12px] font-semibold text-sky-100">Dashboard</Text>
              </TouchableOpacity>
              <View className="items-center gap-1">
                <View className="h-16 w-16 items-center justify-center rounded-[22px] border border-sky-800/70 bg-slate-950/70">
                  <Text className="text-[18px] font-semibold text-sky-50">AC</Text>
                </View>
                <Text className="text-[13px] font-semibold text-sky-50">Aria Collins</Text>
                <Text className="text-[11px] text-slate-400">Field intelligence</Text>
              </View>
              <View className="rounded-2xl border border-emerald-500/50 bg-emerald-900/20 px-3 py-2">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                  Auto-sync ready
                </Text>
              </View>
            </View>

            <View className="mt-6">
              <Text className="text-[11px] uppercase tracking-[3px] text-sky-400">
                Field capture
              </Text>
              <Text className="mt-2 text-[22px] font-semibold text-sky-50">
                New water sample intake
              </Text>
              <Text className="mt-2 text-[13px] text-slate-400">
                Manual + OCR capture for downstream risk scoring and model retraining.
              </Text>
            </View>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
                <Text className="text-[11px] uppercase tracking-wide text-slate-400">
                  Last sample
                </Text>
                <Text className="mt-2 text-[18px] font-semibold text-sky-50">
                  Lake Biwa intake
                </Text>
                <Text className="text-[12px] text-slate-400">ID #AQ-024 at 09:41</Text>
              </View>
              <View className="flex-1 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
                <Text className="text-[11px] uppercase tracking-wide text-slate-400">
                  Queue
                </Text>
                <Text className="mt-2 text-[18px] font-semibold text-sky-50">02 cards</Text>
                <Text className="text-[12px] text-slate-400">Awaiting OCR review</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: sectionsAnim,
              transform: [
                {
                  translateY: sectionsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
            className="rounded-[34px] border border-sky-900/80 bg-slate-950/70 p-5"
          >
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                  Image-assisted capture
                </Text>
                <Text className="mt-2 text-[13px] text-slate-300">
                  Snap the standardized sheet; EasyOCR fills all 10 water-quality fields instantly when legible.
                </Text>
              </View>
              <View className="rounded-2xl border border-sky-900/60 bg-slate-900/60 px-3 py-2">
                <Text className="text-[11px] font-semibold text-sky-200">
                  {capturePreview ? 'Retake ready' : 'Camera idle'}
                </Text>
              </View>
            </View>
            <View className="mt-5">
              <PredictButton
                title={capturePreview ? 'Retake capture' : 'Capture data card'}
                onPress={handleOpenCamera}
              />
              {cameraError ? (
                <Text className="mt-2 text-[11px] text-rose-400">{cameraError}</Text>
              ) : null}
              {preprocessing ? (
                <Text className="mt-2 text-[11px] text-slate-300">Optimizing capture for OCR...</Text>
              ) : null}
              {preprocessNotes && !preprocessing ? (
                <Text className="mt-2 text-[11px] text-slate-400">{preprocessNotes}</Text>
              ) : null}
              {ocrLoading ? (
                <View className="mt-3 flex-row items-center">
                  <Animated.View
                    className="h-3.5 w-3.5 rounded-full border-2 border-sky-300 border-t-transparent"
                    style={{ transform: [{ rotate: spinnerRotation }] }}
                  />
                  <Text className="ml-2 text-[11px] text-emerald-300">
                    Extracting values with EasyOCR...
                  </Text>
                </View>
              ) : null}
              {ocrApplied && !ocrLoading ? (
                <Text className="mt-2 text-[11px] text-emerald-300">
                  Fields updated automatically. Review before saving.
                </Text>
              ) : null}
              {ocrError ? (
                <Text className="mt-2 text-[11px] text-rose-400">{ocrError}</Text>
              ) : null}
            </View>
            {capturePreview ? (
              <View className="mt-5 flex-row gap-3">
                <View className="h-24 w-20 overflow-hidden rounded-2xl border border-sky-900/80 bg-slate-900">
                  <Image
                    source={{ uri: capturePreview.uri }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-sky-100">OCR preview</Text>
                  <Text className="mt-1 text-[12px] text-slate-400">
                    Preview for alignment only. Backend OCR uses the raw capture for numeric extraction.
                  </Text>
                </View>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            style={{
              opacity: sectionsAnim,
              transform: [
                {
                  translateY: sectionsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
            className="gap-5"
          >
            <View className="rounded-[32px] border border-sky-900/70 bg-slate-950/80 p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Core parameters
              </Text>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <InputField
                    label="pH (dimensionless)"
                    placeholder="e.g. 7.2"
                    keyboardType="numeric"
                    value={form.pH}
                    onChangeText={(v) => updateField('pH', v)}
                  />
                </View>
                <View className="flex-1">
                  <InputField
                    label="Hardness (mg/L as CaCO₃)"
                    placeholder="e.g. 180"
                    keyboardType="numeric"
                    value={form.hardness}
                    onChangeText={(v) => updateField('hardness', v)}
                  />
                </View>
              </View>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <InputField
                    label="Solids (mg/L)"
                    placeholder="e.g. 320"
                    keyboardType="numeric"
                    value={form.solids}
                    onChangeText={(v) => updateField('solids', v)}
                  />
                </View>
                <View className="flex-1">
                  <InputField
                    label="Conductivity (µS/cm)"
                    placeholder="e.g. 410"
                    keyboardType="numeric"
                    value={form.conductivity}
                    onChangeText={(v) => updateField('conductivity', v)}
                  />
                </View>
              </View>
            </View>

            <View className="rounded-[32px] border border-sky-900/70 bg-slate-950/80 p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Chemical compounds
              </Text>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <InputField
                    label="Chloramines (mg/L)"
                    placeholder="e.g. 4.0"
                    keyboardType="numeric"
                    value={form.chloramines}
                    onChangeText={(v) => updateField('chloramines', v)}
                  />
                </View>
                <View className="flex-1">
                  <InputField
                    label="Sulfate (mg/L)"
                    placeholder="e.g. 250"
                    keyboardType="numeric"
                    value={form.sulfate}
                    onChangeText={(v) => updateField('sulfate', v)}
                  />
                </View>
              </View>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <InputField
                    label="Organic Carbon (mg/L)"
                    placeholder="e.g. 12.5"
                    keyboardType="numeric"
                    value={form.organicCarbon}
                    onChangeText={(v) => updateField('organicCarbon', v)}
                  />
                </View>
                <View className="flex-1">
                  <InputField
                    label="Trihalomethanes (µg/L)"
                    placeholder="e.g. 80"
                    keyboardType="numeric"
                    value={form.trihalomethanes}
                    onChangeText={(v) => updateField('trihalomethanes', v)}
                  />
                </View>
              </View>
            </View>

            <View className="rounded-[32px] border border-sky-900/70 bg-slate-950/80 p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Physical & disinfectant
              </Text>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <InputField
                    label="Turbidity (NTU)"
                    placeholder="e.g. 4.5"
                    keyboardType="numeric"
                    value={form.turbidity}
                    onChangeText={(v) => updateField('turbidity', v)}
                  />
                </View>
                <View className="flex-1">
                  <InputField
                    label="Free Chlorine Residual (mg/L)"
                    placeholder="e.g. 0.5"
                    keyboardType="numeric"
                    value={form.freeChlorineResidual}
                    onChangeText={(v) => updateField('freeChlorineResidual', v)}
                  />
                </View>
              </View>
            </View>

            <View className="rounded-[32px] border border-sky-900/80 bg-slate-950/80 p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Visual & context
              </Text>
              <View className="mt-4">
                <Text className="mb-2 text-[13px] font-semibold text-sky-100">Color</Text>
                <View className="flex-row flex-wrap gap-2">
                  {colorOptions.map((option) => {
                    const selected = form.color === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.85}
                        className={`rounded-full border px-3 py-1.5 ${
                          selected
                            ? 'border-aquaaccent bg-aquaaccent/15'
                            : 'border-slate-800 bg-slate-950'
                        }`}
                        onPress={() => updateField('color', option)}
                      >
                        <Text
                          className={`text-[12px] ${
                            selected ? 'text-aquaaccent' : 'text-slate-300'
                          }`}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View className="mt-5">
                <Text className="mb-2 text-[13px] font-semibold text-sky-100">
                  Source (sampling context)
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {sourceOptions.map((option) => {
                    const selected = form.source === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.85}
                        className={`rounded-full border px-3 py-1.5 ${
                          selected
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : 'border-slate-800 bg-slate-950'
                        }`}
                        onPress={() => updateField('source', option)}
                      >
                        <Text
                          className={`text-[12px] ${
                            selected ? 'text-emerald-50' : 'text-slate-300'
                          }`}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </Animated.View>

          <View className="rounded-[32px] border border-sky-900/70 bg-slate-950/80 p-5">
            <Text className="text-[12px] text-slate-400">
              Finalize and sync this sample to kick off anomaly detection, historical comparisons, and model retraining cues.
            </Text>
            <PredictButton
              title={submitLoading ? 'Saving sample…' : 'Save sample & run checks'}
              onPress={handleSubmit}
              className="mt-4"
              disabled={submitLoading}
            />
            {submitLoading ? (
              <View className="mt-3 flex-row items-center justify-center gap-2">
                <ActivityIndicator color="#34d399" size="small" />
                <Text className="text-[12px] text-emerald-200">
                  Syncing and running model checks…
                </Text>
              </View>
            ) : null}
            {submitError ? (
              <Text className="mt-3 text-center text-[12px] text-rose-300">{submitError}</Text>
            ) : null}
            <Text className="mt-2 text-center text-[11px] text-slate-500">
              Values feed into image-assisted models for early disease detection.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default DataInputScreen;
