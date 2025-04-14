import React, {useCallback, useRef, useState, useEffect} from 'react';

import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import {useAntMedia, rtc_view} from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

var publishStreamId:string;

export default function App() {
  var defaultStreamName = 'streamTest1';
  const webSocketUrl = 'ws://test.antmedia.io:5080/WebRTCAppEE/websocket';
  //or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

  const streamNameRef = useRef<string>(defaultStreamName);
  const [localMedia, setLocalMedia] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaitingWebsocketInit, setIsWaitingWebsocketInit] = useState(false);

  let localStream: any = useRef(null);

  useEffect(() => {
    console.log(' localStream.current ', localStream.current);
  }, []);

  const adaptor = useAntMedia({
    url: webSocketUrl,
    mediaConstraints: {
      audio: true,
      video: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'front',
      },
    },
    callback(command: any, data: any) {
      switch (command) {
        case 'pong':
          break;
        case 'publish_started':
          console.log('publish_started');
          setIsPlaying(true);
          break;
        case 'publish_finished':
          console.log('publish_finished');
          InCallManager.stop();
          setIsPlaying(false);
          adaptor.closeWebSocket();
          break;
        case 'local_stream_updated':
          console.log('local_stream_updated');
          verify();
          break;
        case 'websocket_not_initialized':
          setIsWaitingWebsocketInit(true);
          adaptor.initialiseWebSocket();
          break;
        case 'websocket_closed':
          console.log('websocket_closed');
          adaptor.stopLocalStream();
          break;
        default:
          console.log(command);
          break;
      }
    },
    callbackError: (err: any, data: any) => {
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

  const generateRandomString = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charactersLength);
      result += characters.charAt(randomIndex);
    }
    return result;
  };

  const verify = () => {
    console.log('in verify');
    if (adaptor.localStream.current && adaptor.localStream.current.toURL()) {
      console.log('in verify if adaptor local stream', adaptor.localStream);
      if (isWaitingWebsocketInit) {
        setIsWaitingWebsocketInit(false);
        publishStreamId = generateRandomString(12);
        adaptor.publish(publishStreamId);
      }
      return setLocalMedia(adaptor.localStream.current.toURL());
    }
    setTimeout(verify, 5000);
  };

  useEffect(() => {
    verify();
  }, [adaptor.localStream]);

  useEffect(() => {
    if (localMedia) {
      InCallManager.start({media: 'video'});
    }
  }, [localMedia]);

  const handlePublish = useCallback(() => {
    if (!adaptor) {
      return;
    }
    publishStreamId = generateRandomString(12);
    adaptor.publish(publishStreamId);
  }, [adaptor]);

  const handleStop = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.stop(publishStreamId);
  }, [adaptor]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Publish</Text>
        {localMedia ? <>{rtc_view(localMedia, styles.streamPlayer, 'cover')}</> : <></>}
        {!isPlaying ? (
          <>
            <TouchableOpacity onPress={handlePublish} style={styles.button}>
              <Text>Start Publishing</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={handleStop} style={styles.button}>
              <Text>Stop Publishing</Text>
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
    width: '80%',
    height: '80%',
  },
  streamPlayer: {
    width: '100%',
    height: '80%',
    alignSelf: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#AAAAAA',
    padding: 10,
    marginBottom: 10,
  },
  heading: {
    alignSelf: 'center',
    color: 'black'
  },
});
