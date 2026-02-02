import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, ScrollView } from 'react-native';
import LottieView from 'lottie-react-native';
import InputField from '../components/InputField';
import PredictButton from '../components/PredictButton';
import { supabase } from '../utils/supabaseClient';

const LoginScreen = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const modeAnim = useRef(new Animated.Value(0)).current; // 0 = login, 1 = register
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 500,
        delay: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 500,
        delay: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, cardAnim]);

  const handleLogin = async () => {
    setError('');
    setNotice('');
    setCanResend(false);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      console.log('Supabase signIn data: (implicit, no data field)');
      console.log('Supabase signIn error:', signInError);

      if (signInError) {
        const msg = (signInError.message || '').toLowerCase();

        if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password.');
        } else if (msg.includes('email not confirmed') || msg.includes('confirm your email')) {
          setError('Your email is not verified yet. You can resend the confirmation email below.');
          setCanResend(true);
        } else {
          setError(signInError.message || 'Unable to sign in. Please try again.');
        }
        return;
      }

      setError('');
      setCanResend(false);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (e) {
      console.error('Unexpected signIn error', e);
      setError('Unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setNotice('');
    setCanResend(false);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword || !confirmPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      console.log('Supabase signUp data:', data);
      console.log('Supabase signUp error:', signUpError);

      if (signUpError) {
        const msg = (signUpError.message || '').toLowerCase();

        if (msg.includes('user already registered') || msg.includes('already registered')) {
          setError('An account with this email already exists. Try signing in instead.');
        } else {
          setError(signUpError.message || 'Unable to register. Please try again.');
        }
        return;
      }

      // Depending on your Supabase settings, a confirmation email may be required.
      if (!data.session) {
        setNotice('Email sent. Please check your inbox to verify your account.');
        setCanResend(true);
        return;
      }

      setError('');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (e) {
      console.error('Unexpected signUp error', e);
      setError('Unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');
    setNotice('');
    setCanResend(false);
    setPassword('');
    setConfirmPassword('');
    Animated.timing(modeAnim, {
      toValue: nextMode === 'login' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-aquadark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 px-5 pt-12"
        contentContainerClassName="pb-20 gap-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: heroAnim,
            transform: [
              {
                translateY: heroAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              },
            ],
          }}
          className="rounded-[36px] border border-sky-900/70 bg-gradient-to-br from-slate-950/90 via-sky-950/30 to-emerald-900/20 px-6 pt-8 pb-6 shadow-2xl shadow-sky-900/50"
        >
          <View className="items-center">
            <View className="h-28 w-28 items-center justify-center rounded-full border border-sky-800/70 bg-slate-950/60">
              <LottieView
                source={require('../assets/public/AI.json')}
                autoPlay
                loop
                style={{ width: 120, height: 120 }}
              />
            </View>
            <Text className="mt-4 px-4 text-center text-[15px] font-semibold text-sky-50">
              Edge intelligence for water labs
            </Text>
            <Text className="mt-2 px-3 text-center text-[13px] text-slate-300">
              AI driven physicochemical capture, forecasting, and disease-risk prediction.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          }}
          className="rounded-[32px] border border-sky-900/80 bg-slate-950/80 p-6 shadow-xl shadow-sky-900/40"
        >
          <View className="items-center">
            <Animated.View
              style={{
                opacity: modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  {
                    translateY: modeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -6],
                    }),
                  },
                ],
              }}
            >
              <Text className="text-base font-semibold text-sky-100 text-center">
                Sign in to continue
              </Text>
              <Text className="mt-1 text-[13px] text-sky-200/80 text-center">
                Monitor samples and trigger AI assisted diagnostics.
              </Text>
            </Animated.View>

            <Animated.View
              style={{
                position: 'absolute',
                opacity: modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [
                  {
                    translateY: modeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 0],
                    }),
                  },
                ],
              }}
            >
              <Text className="text-base font-semibold text-sky-100 text-center">
                Create an account
              </Text>
              <Text className="mt-1 text-[13px] text-sky-200/80 text-center">
                Secure access to capture cards and review predictions.
              </Text>
            </Animated.View>
          </View>

          <View className="mt-6 mb-4 flex-row rounded-full bg-slate-900/70 px-1 py-1">
            <TouchableOpacity
              className={`flex-1 items-center rounded-full py-1.5 ${
                mode === 'login' ? 'bg-sky-900/60' : 'bg-transparent'
              }`}
              activeOpacity={0.85}
              onPress={() => switchMode('login')}
            >
              <Animated.Text
                className="text-[13px] font-semibold text-sky-100"
                style={{
                  opacity: modeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.7],
                  }),
                  transform: [
                    {
                      scale: modeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.05, 1],
                      }),
                    },
                  ],
                }}
              >
                Login
              </Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`ml-1 flex-1 items-center rounded-full py-1.5 ${
                mode === 'register' ? 'bg-sky-900/60' : 'bg-transparent'
              }`}
              activeOpacity={0.85}
              onPress={() => switchMode('register')}
            >
              <Animated.Text
                className="text-[13px] font-semibold text-sky-100"
                style={{
                  opacity: modeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                  transform: [
                    {
                      scale: modeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05],
                      }),
                    },
                  ],
                }}
              >
                Register
              </Animated.Text>
            </TouchableOpacity>
          </View>

          <View className="h-5" />

          <InputField
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <View className="h-3.5" />

          <InputField
            label="Password"
            placeholder="Enter password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'register' && (
            <>
              <View className="h-3.5" />
              <InputField
                label="Confirm password"
                placeholder="Re-enter password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </>
          )}

          {error ? (
            <Text className="mt-2 text-[12px] text-red-400">{error}</Text>
          ) : null}

          {!error && notice ? (
            <Text className="mt-2 text-[12px] text-emerald-400">{notice}</Text>
          ) : null}

          {canResend && (
            <TouchableOpacity
              className="mt-2 self-start"
              activeOpacity={0.8}
              onPress={async () => {
                const trimmedEmail = email.trim();

                if (!trimmedEmail) {
                  setError('Please enter your email above before resending.');
                  setNotice('');
                  return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                  setError('Please enter a valid email address.');
                  setNotice('');
                  return;
                }

                setError('');
                setNotice('');
                setResending(true);
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: trimmedEmail,
                  });

                  if (resendError) {
                    console.log('Supabase resend error:', resendError);
                    setError(resendError.message || 'Unable to resend email. Please try again.');
                  } else {
                    setNotice('Email sent. Please check your inbox to verify your account.');
                  }
                } catch (e) {
                  console.error('Unexpected resend error', e);
                  setError('Unexpected error occurred. Please try again.');
                } finally {
                  setResending(false);
                }
              }}
              disabled={resending}
            >
              <Text
                className={`text-[12px] font-semibold ${
                  resending ? 'text-sky-500/60' : 'text-sky-300'
                }`}
              >
                {resending ? 'Resending email...' : 'Resend confirmation email'}
              </Text>
            </TouchableOpacity>
          )}

          <View className="h-5" />

          <PredictButton
            title={
              mode === 'login'
                ? loading
                  ? 'Signing in...'
                  : 'Continue'
                : loading
                ? 'Creating account...'
                : 'Create account'
            }
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          />

          <TouchableOpacity
            className="mt-4 rounded-2xl border border-sky-900/70 bg-slate-950/70 px-4 py-3"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full border border-sky-800/70 bg-slate-900/80">
                <Text className="text-[16px] font-semibold text-sky-200">?</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-sky-100">
                  Need access?
                </Text>
                <Text className="text-[11px] text-slate-400">
                  Contact your lab admin to enable secure sign-in for your workspace.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
export default LoginScreen;
