import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ActionsHomeScreen from '../screens/ActionsHomeScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import LeaderboardScreen from '../screens/shared/LeaderboardScreen';
import AnnouncementsScreen from '../screens/shared/AnnouncementsScreen';
import NewAnnouncementScreen from '../screens/admin/NewAnnouncementScreen';
import TaskSetupScreen from '../screens/admin/TaskSetupScreen';
import ManageAdminsScreen from '../screens/admin/ManageAdminsScreen';
import { useDay } from '../context/DayContext';

const Stack = createNativeStackNavigator();

export default function ActionsStack() {
  const { day, loading, reload } = useDay();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ActionsHome">
        {(props) => <ActionsHomeScreen {...props} day={day} loading={loading} reload={reload} />}
      </Stack.Screen>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="NewAnnouncement" component={NewAnnouncementScreen} />
      <Stack.Screen name="TaskSetup" component={TaskSetupScreen} />
      <Stack.Screen name="ManageAdmins" component={ManageAdminsScreen} />
    </Stack.Navigator>
  );
}
