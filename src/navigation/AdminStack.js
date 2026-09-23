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
import CustomActionsScreen from '../screens/admin/CustomActionsScreen';
import CompulsoryLocationsScreen from '../screens/admin/CompulsoryLocationsScreen';
import CheckinSpotsScreen from '../screens/admin/CheckinSpotsScreen';
import ShiftsScreen from '../screens/admin/ShiftsScreen';
import SalariesScreen from '../screens/admin/SalariesScreen';
import SalaryDetailScreen from '../screens/admin/SalaryDetailScreen';
import AdminSalarySheetScreen from '../screens/admin/AdminSalarySheetScreen';
import AnimationsScreen from '../screens/admin/AnimationsScreen';
import AwayCheckinsScreen from '../screens/admin/AwayCheckinsScreen';
import MapPickerScreen from '../screens/admin/MapPickerScreen';
import StaffTimelinesScreen from '../screens/admin/StaffTimelinesScreen';
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
      <Stack.Screen name="CustomActions" component={CustomActionsScreen} />
      <Stack.Screen name="CompulsoryLocations" component={CompulsoryLocationsScreen} />
      <Stack.Screen name="CheckinSpots" component={CheckinSpotsScreen} />
      <Stack.Screen name="Shifts" component={ShiftsScreen} />
      <Stack.Screen name="Salaries" component={SalariesScreen} />
      <Stack.Screen name="SalaryDetail" component={SalaryDetailScreen} />
      <Stack.Screen name="AdminSalarySheet" component={AdminSalarySheetScreen} />
      <Stack.Screen name="Animations" component={AnimationsScreen} />
      <Stack.Screen name="AwayCheckins" component={AwayCheckinsScreen} />
      <Stack.Screen name="StaffTimelines" component={StaffTimelinesScreen} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} />
      <Stack.Screen name="ManageAdmins" component={ManageAdminsScreen} />
      <Stack.Screen name="ShareApp" component={ShareAppScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="NewAnnouncement" component={NewAnnouncementScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
