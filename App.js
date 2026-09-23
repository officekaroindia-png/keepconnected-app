import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from './src/theme/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { DayProvider, useDay } from './src/context/DayContext';
import ActionSheet from './src/components/ActionSheet';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import OfflineScreen from './src/screens/OfflineScreen';
import ActionsStack from './src/navigation/ActionsStack';
import TimelineStack from './src/navigation/TimelineStack';
import AdminStack from './src/navigation/AdminStack';
import StaffStack from './src/navigation/StaffStack';

const Tab = createBottomTabNavigator();
const ICONS = {
  Actions:  { on: 'apps',       off: 'apps-outline' },
  Timeline: { on: 'git-commit', off: 'git-commit-outline' },
  Admin:    { on: 'shield',     off: 'shield-outline' },
  Staff:    { on: 'people',     off: 'people-outline' },
};

function Tabs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { day, reload, sheetOpen, openSheet, closeSheet } = useDay();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMute,
          tabBarStyle: {
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
          tabBarIcon: ({ focused, color, size }) => {
            const set = ICONS[route.name];
            return <Ionicons name={focused ? set.on : set.off} size={size ?? 22} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Actions"
          component={ActionsStack}
          options={{ tabBarLabel: 'Actions' }}
          listeners={{ tabPress: () => { openSheet(); } }}
        />
        <Tab.Screen name="Timeline" component={TimelineStack} options={{ tabBarLabel: 'My Timeline' }} />
        {isAdmin
          ? <Tab.Screen name="Admin" component={AdminStack} />
          : <Tab.Screen name="Staff" component={StaffStack} />}
      </Tab.Navigator>
      <ActionSheet
        visible={sheetOpen}
        states={day?.actions}
        customActions={day?.customActions || []}
        compulsoryName={day?.compulsoryLocation?.name}
        checkinClosed={day?.checkinCutoff?.closed}
        onClose={closeSheet}
        onDone={reload}
      />
    </>
  );
}

// Possible screens before login:
//  'welcome'  → beautiful splash with 3 CTAs
//  'login'    → sign in form
//  'register_join'    → join a team form (pre-selected)
//  'register_company' → create company form (pre-selected)
//  'forgot'   → forgot password
function Gate() {
  const { user, booting, sessionExists } = useAuth();
  const [screen, setScreen] = useState('welcome');

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.white} size="large" />
      </View>
    );
  }
  if (user)           return <DayProvider><Tabs /></DayProvider>;
  if (sessionExists)  return <OfflineScreen />;

  if (screen === 'login') {
    return (
      <LoginScreen
        onBack={() => setScreen('welcome')}
        onForgotPassword={() => setScreen('forgot')}
      />
    );
  }
  if (screen === 'register_join') {
    return (
      <RegisterScreen
        onBack={() => setScreen('welcome')}
        initialMode="join"
        onGoLogin={() => setScreen('login')}
      />
    );
  }
  if (screen === 'register_company') {
    return (
      <RegisterScreen
        onBack={() => setScreen('welcome')}
        initialMode="company"
        onGoLogin={() => setScreen('login')}
      />
    );
  }
  if (screen === 'forgot') {
    return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
  }

  // Default: welcome splash
  return (
    <WelcomeScreen
      onSignIn={() => setScreen('login')}
      onJoinTeam={() => setScreen('register_join')}
      onNewCompany={() => setScreen('register_company')}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider>
          <NavigationContainer>
            <Gate />
          </NavigationContainer>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
