import React, { useState, useEffect, useCallback } from 'react';
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
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ActionsStack from './src/navigation/ActionsStack';
import TimelineScreen from './src/screens/TimelineScreen';
import AdminStack from './src/navigation/AdminStack';
import StaffDirectoryScreen from './src/screens/staff/StaffDirectoryScreen';

const Tab = createBottomTabNavigator();
const ICONS = {
  Actions:  { on: 'apps', off: 'apps-outline' },
  Timeline: { on: 'git-commit', off: 'git-commit-outline' },
  Admin:    { on: 'shield', off: 'shield-outline' },
  Staff:    { on: 'people', off: 'people-outline' },
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
          tabBarStyle: { height: 58 + insets.bottom, paddingBottom: insets.bottom > 0 ? insets.bottom : 8, paddingTop: 8, backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
          tabBarIcon: ({ focused, color, size }) => { const set = ICONS[route.name]; return <Ionicons name={focused ? set.on : set.off} size={size ?? 22} color={color} />; },
        })}
      >
        <Tab.Screen
          name="Actions"
          component={ActionsStack}
          options={{ tabBarLabel: 'Actions' }}
          listeners={{ tabPress: () => { openSheet(); } }}
        />
        <Tab.Screen name="Timeline" component={TimelineScreen} options={{ tabBarLabel: 'My Timeline' }} />
        {isAdmin
          ? <Tab.Screen name="Admin" component={AdminStack} />
          : <Tab.Screen name="Staff" component={StaffDirectoryScreen} />}
      </Tab.Navigator>
      <ActionSheet visible={sheetOpen} states={day?.actions} onClose={closeSheet} onDone={reload} />
    </>
  );
}

function Gate() {
  const { user, booting } = useAuth();
  const [screen, setScreen] = useState('login');
  if (booting) return <View style={{ flex: 1, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={COLORS.white} size="large" /></View>;
  if (user) return <DayProvider><Tabs /></DayProvider>;
  return screen === 'login' ? <LoginScreen onGoRegister={() => setScreen('register')} /> : <RegisterScreen onBack={() => setScreen('login')} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider><NavigationContainer><Gate /></NavigationContainer></AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
