import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MainScreen from './MainScreen';
import AppScreen from './App';

import Publish from './Publish';
import Chat from './Chat';
import Peer from './Peer';
import Conference from './Conference';
import Play from './Play';

export type RootStackParamList = {
  MainScreen: undefined;
  AppScreen: undefined;
  Play: undefined;
  Peer: undefined;
  Conference: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MainScreen">
        <Stack.Screen name="MainScreen" component={MainScreen} options={{ title: 'Home' }} />
        <Stack.Screen name="AppScreen" component={AppScreen} />
        <Stack.Screen name="Publish" component={Publish} />
        <Stack.Screen name="Play" component={Play} />
        <Stack.Screen name="Peer" component={Peer} />
        <Stack.Screen name="Conference" component={Conference} />
        <Stack.Screen name="Chat" component={Chat} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
