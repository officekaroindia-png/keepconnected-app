import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import StaffStatusScreen from '../screens/admin/StaffStatusScreen';
import AttendanceDashboardScreen from '../screens/admin/AttendanceDashboardScreen';
import StaffTimelineScreen from '../screens/admin/StaffTimelineScreen';
import StaffMonthlyScreen from '../screens/admin/StaffMonthlyScreen';
import TaskSetupScreen from '../screens/admin/TaskSetupScreen';
import ManageAdminsScreen from '../screens/admin/ManageAdminsScreen';
import ShareAppScreen from '../screens/admin/ShareAppScreen';
import ContactScreen from '../screens/shared/ContactScreen';
import LeaderboardScreen from '../screens/shared/LeaderboardScreen';
import AnnouncementsScreen from '../screens/shared/AnnouncementsScreen';
import NewAnnouncementScreen from '../screens/admin/NewAnnouncementScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Stack = createNativeStackNavigator();
export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="StaffStatus" component={StaffStatusScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="AttendanceDashboard" component={AttendanceDashboardScreen} />
      <Stack.Screen name="StaffTimeline" component={StaffTimelineScreen} />
      <Stack.Screen name="StaffMonthly" component={StaffMonthlyScreen} />
      <Stack.Screen name="TaskSetup" component={TaskSetupScreen} />
      <Stack.Screen name="ManageAdmins" component={ManageAdminsScreen} />
      <Stack.Screen name="ShareApp" component={ShareAppScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="NewAnnouncement" component={NewAnnouncementScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
