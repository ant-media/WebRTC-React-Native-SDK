import React, { useCallback, useRef, useState, useEffect } from 'react';

import {
  View,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
// @ts-ignore
import { useAntMedia, rtc_view } from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

export default function MultiTrackPlayer() {
  var defaultRoomName = 'room1';
  const webSocketUrl = 'wss://abc.mustafa-boleken-ams-test.tech:5443/LiveApp/websocket';

  const [remoteStreams, setremoteStreams] = useState<any>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);
  const [PlayStreamsListArr, updatePlayStreamsListArr] = useState<any>([]);

  const [tracks, setTracks] = useState<any>([]);

  const adaptor = useAntMedia({
    url: webSocketUrl,
    mediaConstraints: {
      audio: false,
      video: false,
    },
    sdpConstraints: {
      OfferToReceiveAudio : true,
      OfferToReceiveVideo : true
    },
    callback(command: any, data: any) {
      if (command != 'pong') {
        console.log('BOLA: callback', command, data);
      }
      switch (command) {
        case 'pong':
          break;
        case 'initialized':
          console.log('initialized');
          break;
        case 'play_started':
          console.log('play_started');
          break;
        case 'play_finished':
          console.log('play_finished');
          break;
        case 'closed':
          if (typeof data != undefined) {
            console.log('Connection closed ' + data);
          }
          break;
        case 'newStreamAvailable':
          console.log("***************************");
          // TODO: playVideo(data);
          break;
        case 'updatedStats':
          console.log("Average incoming kbits/sec: " + data.averageIncomingBitrate
            + " Current incoming kbits/sec: " + data.currentIncomingBitrate
            + " packetLost: " + data.packetsLost
            + " fractionLost: " + data.fractionLost);
          break;
        case 'trackList':
          // TODO: addTrackList(data.streamId, data.trackList);
          break;
        default:
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
      sdpSemantics: 'unified-plan'
    },
    debug: false,
    isPlayMode: true,
  });

  const handleConnect = useCallback(() => {
    let enabledTracks: string[] = [];
    tracks.forEach((track: any) => {
      if (track.enabled) {
        enabledTracks.push(track);
      }
    });
    console.log("------------------------------------");
    adaptor.play(roomId, "", roomId, enabledTracks, "", "", "");
    setIsPlaying(true);
  }, [adaptor, roomId]);

  const handleDisconnect = useCallback(() => {
    setIsPlaying(false);
    if (adaptor) {
      adaptor.stop(roomId);
    }
  }, [adaptor, roomId]);

  useEffect(() => {
    if (remoteStreams) {
      InCallManager.start({ media: 'video' });
    }
  }, [remoteStreams]);

  // @ts-ignore
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Multi Track Player</Text>
        {!isPlaying ? (
          <>
            <TouchableOpacity onPress={handleConnect} style={styles.button}>
              <Text>Start Playing</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handleDisconnect}>
              <Text style={styles.btnTxt}>Stop Playing</Text>
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
  players: {
    backgroundColor: '#DDDDDD',
    paddingVertical: 5,
    paddingHorizontal: 10,
    margin: 5,
    width: 100,
    height: 150,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  localPlayer: {
    backgroundColor: '#DDDDDD',
    borderRadius: 5,
    marginBottom: 5,
    height: 180,
    flexDirection: 'row',
  },
  btnTxt: {
    color: 'black',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDDDDD',
    padding: 10,
    width: '100%',
    marginTop: 20,
  },
  heading: {
    alignSelf: 'center',
    marginBottom: 5,
    padding: 2,
  },
  heading1: {
    alignSelf: 'center',
    marginTop: 20,
  },
});
