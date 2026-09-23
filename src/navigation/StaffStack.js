import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StaffDirectoryScreen from '../screens/staff/StaffDirectoryScreen';
import MyDayTimelineScreen from '../screens/shared/MyDayTimelineScreen';

const Stack = createNativeStackNavigator();

export default function StaffStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffDirectory" component={StaffDirectoryScreen} />
      <Stack.Screen name="MyDayTimeline" component={MyDayTimelineScreen} />
    </Stack.Navigator>
  );
}
