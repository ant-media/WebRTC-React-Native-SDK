import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  MainScreen: undefined;
  Publish: undefined;
  Play: undefined;
  Peer: undefined;
  Conference: undefined;
  Chat: undefined;
};

type MainScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'MainScreen'>;
};

const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sample Apps</Text>

      <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Publish')}>
        <Text style={styles.text}>Publish</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Play')}>
        <Text style={styles.text}>Play</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Peer')}>
        <Text style={styles.text}>Peer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Conference')}>
        <Text style={styles.text}>Conference</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.text}>Chat</Text>
        </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'black',
  },
  box: {
    width: 200,
    height: 60,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 10,
  },
  text: {
    color: 'white',
    fontSize: 18,
  },
});

export default MainScreen;
