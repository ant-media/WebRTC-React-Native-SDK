import React, { useCallback, useRef, useState, useEffect } from 'react';

import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useAntMedia, rtc_view } from '@antmedia/react-native-ant-media';

export default function App() {
  var defaultStreamName = 'testv1';
  const webSocketUrl = 'ws://141.95.165.123:5080/WebRTCAppEE/websocket';

  const streamNameRef = useRef<string>(defaultStreamName);
  const [remoteMedia, setRemoteStream] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);

  const adaptor = useAntMedia({
    url: webSocketUrl,
    callback(command: any) {
      switch (command) {
        case 'pong':
          break;
        case 'play_started':
          console.log('play_started');
          setIsPlaying(true);
          break;
        case 'play_finished':
          console.log('play_finished');
          //InCallManager.stop();
          setIsPlaying(false);
          setRemoteStream('');
          break;
        default:
          console.log(command);
          break;
      }
    },
    callbackError: (err: any, data: any) => {
      console.error('callbackError', err, data);
    },
  });

  useEffect(() => {
    if (adaptor && Object.keys(adaptor.remoteStreams).length > 0) {
      for (let i in adaptor.remoteStreams) {
        let st =
          adaptor.remoteStreams[i] && 'toURL' in adaptor.remoteStreams[i]
            ? adaptor.remoteStreams[i].toURL()
            : null;
        setRemoteStream(st || '');
        break;
      }
    }
  }, [adaptor]);

  const handlePublish = useCallback(() => {
    if (!adaptor) {
      return;
    }

    adaptor.play(streamNameRef.current);
  }, [adaptor]);

  const handleStop = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.stop(streamNameRef.current);
  }, [adaptor]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Play</Text>
        {!isPlaying ? (
          <>
            <TouchableOpacity
              onPress={handlePublish}
              style={styles.startButton}
            >
              <Text>Start Playing</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {remoteMedia ? (
              <>{rtc_view(remoteMedia, styles.streamPlayer)}</>
            ) : (
              <></>
            )}
            <TouchableOpacity onPress={handleStop} style={styles.button}>
              <Text>Stop Playing</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    alignSelf: 'center',
    //marginVertical: 0,
    width: '80%',
    height: '80%',
  },
  streamPlayer: {
    //zIndex: 1,
    width: '100%',
    height: '80%',
    alignSelf: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#DDDDDD',
    padding: 10,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#DDDDDD',
    padding: 10,
    //marginTop: 400,
    top: 400,
  },
  heading: {
    alignSelf: 'center',
  },
});
