import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ActionsHomeScreen from '../screens/ActionsHomeScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import LeaderboardScreen from '../screens/shared/LeaderboardScreen';
import AnnouncementsScreen from '../screens/shared/AnnouncementsScreen';
import NewAnnouncementScreen from '../screens/admin/NewAnnouncementScreen';
import TaskSetupScreen from '../screens/admin/TaskSetupScreen';
import CustomActionsScreen from '../screens/admin/CustomActionsScreen';
import CompulsoryLocationsScreen from '../screens/admin/CompulsoryLocationsScreen';
import ShiftsScreen from '../screens/admin/ShiftsScreen';
import SalariesScreen from '../screens/admin/SalariesScreen';
import SalaryDetailScreen from '../screens/admin/SalaryDetailScreen';
import AdminSalarySheetScreen from '../screens/admin/AdminSalarySheetScreen';
import AnimationsScreen from '../screens/admin/AnimationsScreen';
import AwayCheckinsScreen from '../screens/admin/AwayCheckinsScreen';
import MapPickerScreen from '../screens/admin/MapPickerScreen';
import ManageAdminsScreen from '../screens/admin/ManageAdminsScreen';
import AttendanceDashboardScreen from '../screens/admin/AttendanceDashboardScreen';
import MySalarySheetScreen from '../screens/shared/MySalarySheetScreen';
import ChangeSalaryPinScreen from '../screens/shared/ChangeSalaryPinScreen';
import SecurityQuestionsSetupScreen from '../screens/shared/SecurityQuestionsSetupScreen';
import CheckinSpotsScreen from '../screens/admin/CheckinSpotsScreen';
import MyDayTimelineScreen from '../screens/shared/MyDayTimelineScreen';
import StaffTimelineScreen from '../screens/admin/StaffTimelineScreen';
import StaffMonthlyScreen from '../screens/admin/StaffMonthlyScreen';
import StaffStatusScreen from '../screens/admin/StaffStatusScreen';
import StaffTimelinesScreen from '../screens/admin/StaffTimelinesScreen';
import ContactScreen from '../screens/shared/ContactScreen';
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
      <Stack.Screen name="CustomActions" component={CustomActionsScreen} />
      <Stack.Screen name="CompulsoryLocations" component={CompulsoryLocationsScreen} />
      <Stack.Screen name="Shifts" component={ShiftsScreen} />
      <Stack.Screen name="Salaries" component={SalariesScreen} />
      <Stack.Screen name="SalaryDetail" component={SalaryDetailScreen} />
      <Stack.Screen name="AdminSalarySheet" component={AdminSalarySheetScreen} />
      <Stack.Screen name="Animations" component={AnimationsScreen} />
      <Stack.Screen name="AwayCheckins" component={AwayCheckinsScreen} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} />
      <Stack.Screen name="ManageAdmins" component={ManageAdminsScreen} />
      <Stack.Screen name="AttendanceDashboard" component={AttendanceDashboardScreen} />
      <Stack.Screen name="MySalarySheet" component={MySalarySheetScreen} />
      <Stack.Screen name="ChangeSalaryPin" component={ChangeSalaryPinScreen} />
      <Stack.Screen name="SecurityQuestionsSetup" component={SecurityQuestionsSetupScreen} />
      <Stack.Screen name="CheckinSpots" component={CheckinSpotsScreen} />
      <Stack.Screen name="MyDayTimeline" component={MyDayTimelineScreen} />
      <Stack.Screen name="StaffTimeline" component={StaffTimelineScreen} />
      <Stack.Screen name="StaffMonthly" component={StaffMonthlyScreen} />
      <Stack.Screen name="StaffStatus" component={StaffStatusScreen} />
      <Stack.Screen name="StaffTimelines" component={StaffTimelinesScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
    </Stack.Navigator>
  );
}
