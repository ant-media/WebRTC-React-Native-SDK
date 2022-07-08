import React, {useCallback, useRef, useState, useEffect} from 'react';

import {useAntMedia, rtc_view} from '@antmedia/react-native-ant-media';

import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
} from 'react-native';

var defaultStreamName = 'streamTest1';
const webSocketUrl = 'ws://server.com:5080/WebRTCAppEE/websocket';
//or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

const Chat: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const events = useRef<{
    [key: string]: fn;
  }>({});
  const adaptor = useAntMedia({
    url: webSocketUrl,
    mediaConstraints: {
      video: false,
      audio: false,
    },
    onlyDataChannel: true,
    callback(command, data) {
      switch (command) {
        case 'pong':
          break;
        case 'publish_started':
          console.log('publish_started');
          setIsPlaying(true);
          break;
        case 'publish_finished':
          console.log('publish_finished');
          setIsPlaying(false);
          break;
        case 'data_channel_opened':
          console.log('data_channel_opened inside');
          break;
        case 'data_received':
          console.log(command, data.event.data);
          setMessages(msgs => [...msgs, 'Received: ' + data.event.data]);
          break;
        default:
          console.log(command);
          break;
      }
    },
    callbackError: (err, data) => {
      console.error('callbackError', err, data);
    },
    peer_connection_config: {
      iceServers: [
        {
          url: 'stun:stun.l.google.com:19302',
        },
      ],
    },
    debug: true,
  });

  const handleConnect = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.publish(defaultStreamName);
  }, [adaptor]);

  const sendMessage = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.sendData(defaultStreamName, message);
    setMessages(msgs => [...msgs, 'Sent: ' + message]);
    setMessage('');
    console.log('send message', message);
  }, [message, adaptor]);

  const handleLeave = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.stop(defaultStreamName);
    setIsPlaying(false);
  }, [adaptor]);

  useEffect(() => {
    events.current.handleLeave = handleLeave;
  }, [handleLeave]);

  useEffect(() => {
    const toLeave = events.current.handleLeave;
    return () => {
      if (defaultStreamName) {
        toLeave();
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Data Channel</Text>
        <ScrollView style={styles.TextContainer}>
          {messages.map((i, k) => (
            <Text style={styles.ChatText} key={k}>
              {i}
            </Text>
          ))}
        </ScrollView>
        {!isPlaying ? (
          <>
            <TouchableOpacity onPress={handleConnect} style={styles.button}>
              <Text>Publish</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              value={message}
              style={styles.input}
              onChangeText={setMessage}
              placeholder="Write your message to send players"
            />
            <TouchableOpacity style={styles.button} onPress={sendMessage}>
              <Text>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLeave} style={styles.button}>
              <Text>Stop</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

export default Chat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    alignSelf: 'center',
    width: '80%',
    height: '80%',
  },
  InputView: {
    marginBottom: 10,
  },
  TextContainer: {
    width: '100%',
    height: 'auto',
    flex: 1,
    marginTop: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'black',
  },
  ChatText: {
    color: '#1a1a1a',
    position: 'relative',
    fontSize: 15,
    padding: 3,
  },
  input: {
    width: '100%',
    height: 50,
    color: '#000',
    borderWidth: 1,
    marginBottom: 5,
    borderColor: '#232323',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#DDDDDD',
    padding: 10,
    marginBottom: 10,
  },
  heading: {
    alignSelf: 'center',
  },
});
