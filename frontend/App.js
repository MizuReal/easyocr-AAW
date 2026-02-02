import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import './global.css';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import DataInputScreen from './screens/DataInputScreen';
import ContainerAnalysisScreen from './screens/ContainerAnalysisScreen';
import PredictionHistoryScreen from './screens/PredictionHistoryScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import ProfileScreen from './screens/ProfileScreen';
import CommunityForumScreen from './screens/CommunityForumScreen';
import { supabase } from './utils/supabaseClient';
import MenuButton from './components/MenuButton';

const MENU_ITEMS = [
  { label: '📥 Data input', route: 'dataInput' },
  { label: '🧪 Container Analysis', route: 'containerAnalysis' },
  { label: '📊 Predictions History', route: 'predictionHistory' },
  { label: '💬 Community Forum', route: 'community' },
  { label: '📈 Analytics', route: 'analysis' },
  { label: '⚙️ Settings', route: null },
  { label: '👤 Profile', route: 'profile' },
  { label: '🚪 Logout', route: 'logout' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeScreen, setActiveScreen] = useState('home'); // 'home' | 'dataInput' | 'containerAnalysis' | 'predictionHistory' | 'analysis' | 'profile' | 'community'
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: menuOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuAnim]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Supabase] getSession error:', error.message);
        }
        if (isMounted) {
          setIsAuthenticated(!!data?.session);
        }
      } catch (e) {
        console.warn('[Supabase] Unexpected getSession error:', e);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
        if (!session) {
          setActiveScreen('home');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    console.log('[Supabase] Attempting sign out');
    supabase.auth
      .signOut()
      .then(({ error }) => {
        if (error) {
          console.warn('[Supabase] signOut error:', error);
        } else {
          console.log('[Supabase] Signed out successfully');
        }
      })
      .catch((e) => {
        console.warn('[Supabase] signOut unexpected error:', e);
      })
      .finally(() => setMenuOpen(false));
  };

  const handleNavigate = (route) => {
    if (!route) {
      return;
    }
    setMenuOpen(false);
    setActiveScreen(route);
  };

  let content = null;
  if (!isAuthenticated) {
    content = <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  } else if (activeScreen === 'home') {
    content = <HomeScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'dataInput') {
    content = <DataInputScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'containerAnalysis') {
    content = <ContainerAnalysisScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'predictionHistory') {
    content = <PredictionHistoryScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'analysis') {
    content = <AnalysisScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'profile') {
    content = <ProfileScreen onNavigate={setActiveScreen} />;
  } else if (activeScreen === 'community') {
    content = <CommunityForumScreen onNavigate={setActiveScreen} />;
  }

  return (
    <View className="flex-1 bg-aquadark">
      {content}
      {isAuthenticated && (
        <>
          <View className="absolute right-5 top-12 z-40">
            <MenuButton open={menuOpen} onToggle={() => setMenuOpen((prev) => !prev)} />
          </View>
          <Animated.View
            pointerEvents={menuOpen ? 'auto' : 'none'}
            style={{
              opacity: menuAnim,
              transform: [
                {
                  translateY: menuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            }}
            className="absolute inset-0 z-30"
          >
            <TouchableOpacity
              className="absolute inset-0"
              activeOpacity={1}
              onPress={() => setMenuOpen(false)}
            />
            <View className="absolute right-5 top-24 w-56 rounded-2xl border border-sky-900/80 bg-slate-950/95 p-2 shadow-xl shadow-sky-900/60">
              {MENU_ITEMS.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  activeOpacity={0.9}
                  className={`rounded-xl px-3 py-2 ${index === 0 ? 'bg-sky-900/40' : 'bg-transparent'}`}
                  onPress={() => {
                    setMenuOpen(false);
                    if (item.route === 'logout') {
                      handleLogout();
                    } else if (item.route) {
                      handleNavigate(item.route);
                    }
                  }}
                >
                  <Text className="text-[13px] text-sky-100">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </>
      )}
      <StatusBar style="light" />
    </View>
  );
}
