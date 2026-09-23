import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TimelineScreen from '../screens/TimelineScreen';
import AttendanceDashboardScreen from '../screens/admin/AttendanceDashboardScreen';
import MySalarySheetScreen from '../screens/shared/MySalarySheetScreen';
import ChangeSalaryPinScreen from '../screens/shared/ChangeSalaryPinScreen';
import MyDayTimelineScreen from '../screens/shared/MyDayTimelineScreen';
import StaffMonthlyScreen from '../screens/admin/StaffMonthlyScreen';

const Stack = createNativeStackNavigator();

// The "My Timeline" tab is a stack so the timeline can push the user's own
// Attendance Chart (and Salary Sheet) without leaving the tab.
export default function TimelineStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TimelineHome" component={TimelineScreen} />
      <Stack.Screen name="AttendanceDashboard" component={AttendanceDashboardScreen} />
      <Stack.Screen name="MySalarySheet" component={MySalarySheetScreen} />
      <Stack.Screen name="ChangeSalaryPin" component={ChangeSalaryPinScreen} />
      <Stack.Screen name="MyDayTimeline" component={MyDayTimelineScreen} />
      <Stack.Screen name="StaffMonthly" component={StaffMonthlyScreen} />
    </Stack.Navigator>
  );
}
