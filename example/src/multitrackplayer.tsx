import React, { useCallback, useEffect, useState } from 'react';

import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
// @ts-ignore
import { useAntMedia, rtc_view } from '@antmedia/react-native-ant-media';
// @ts-ignore
import { MediaStream } from 'react-native-webrtc';

export default function MultiTrackPlayer() {
  var defaultRoomName = 'room1';
  const webSocketUrl = 'wss://ovh36.antmedia.io:5443/LiveApp/websocket';

  const [isPlaying, setIsPlaying] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);

  const [remoteStreams, setremoteStreams] = useState<any>([]);
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
      switch (command) {
        case 'pong':
          break;
        case 'initialized':
          console.log('initialized');
          break;
        case 'play_started':
          console.log('play_started');
          //reset media streams
          setremoteStreams([]);
          break;
        case 'play_finished':
          console.log('play_finished');
          setremoteStreams([]);
          break;
        case 'closed':
          if (typeof data != undefined) {
            console.log('Connection closed ' + data);
          }
          break;
        case 'newStreamAvailable':
          console.log('newStreamAvailable');
          playVideo(data);
          break;
        case 'updatedStats':
          console.log("Average incoming kbits/sec: " + data.averageIncomingBitrate
            + " Current incoming kbits/sec: " + data.currentIncomingBitrate
            + " packetLost: " + data.packetsLost
            + " fractionLost: " + data.fractionLost);
          break;
        case 'trackList':
          console.log('trackList', data.trackList);
          addTrackList(data.streamId, data.trackList);
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

  function addTrackList(streamId: string, trackList: []) {
    tracks.push(streamId);
    trackList.forEach(function(trackId) {
      tracks.push(trackId);
    });
    console.log('addTrackList -> tracks', tracks);
  }

  function playVideo(obj: any) {
    console.log("new stream available with id: "
      + obj.streamId + "on the room:" + roomId);

    let index: string = "";
    if(obj.track.kind == "video") {
      //index = obj.trackId.replace("ARDAMSv", "");
    } else if(obj.track.kind == "audio") {
      //index = obj.trackId.replace("ARDAMSa", "");
    }

    if(index == roomId) {
      return;
    }

    let remoteStreamArr = remoteStreams;

    let a;
    if (obj.track !== undefined && obj.track !== null) {
      let mediaStream: MediaStream = new MediaStream([obj.track]);
    }

    tracks.push(obj.track);

    setremoteStreams(remoteStreamArr);
  }

  const handleConnect = useCallback(() => {
    let enabledTracks: string[] = [];
    tracks.forEach((track: any) => {
      if (track.enabled) {
        enabledTracks.push(track);
      }
    });
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
    console.log('useEffect -> tracks', tracks);
  }, [tracks]);

  // @ts-ignore
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Multi Track Player</Text>
        {!isPlaying ? (
          <>
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignSelf: 'center',
                    margin: 5,
                  }}
                >
                  {remoteStreams.map((a: MediaStream, index: any) => {
                    const count = tracks.length;
                    console.log('count', count);

                    if (a)
                      return (
                        <View key={index}>
                          <>{rtc_view(a, styles.players)}</>
                        </View>
                      );
                  })}
                </View>
              </>

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
