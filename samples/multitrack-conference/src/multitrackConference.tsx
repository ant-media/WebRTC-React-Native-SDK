import React, { useCallback, useRef, useState, useEffect } from 'react';

import {
  View,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAntMedia, rtc_view } from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';
var publishStreamId;

export default function Conference() {
  var defaultRoomName = 'room11';
  const webSocketUrl = 'ws://192.168.0.108:5080/LiveApp/websocket';
  //or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

  const [localMedia, setLocalMedia] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);
  const [remoteTracks, setremoteTracks] = useState<any>([]);


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
          setIsPublishing(true);
          break;
        case 'publish_finished':
          setIsPublishing(false);
          break;
        case 'play_finished':
          console.log('play_finished');
          removeRemoteVideo();
          break;
        case "newTrackAvailable": {
          setremoteTracks(prevTracks => {
            const updatedTracks = { ...prevTracks, [data.track.id]: data };
            return updatedTracks;
          });

          data.stream.onremovetrack = (event) => {
            console.log("track is removed with id: " + event.track.id)
            removeRemoteVideo(event.track.id);
          }
        }
          break;
        default:
          break;
      }
    },
    callbackError: (err: any, data: any) => {
      if (err === "no_active_streams_in_room") {
        // it throws this error when there is no stream in the room
        // so we shouldn't reset streams list
      } else {
        console.error('callbackError', err, data);
      }
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
    if (adaptor) {
      publishStreamId = generateRandomString(12);
      adaptor.publish(publishStreamId, undefined, undefined, undefined, undefined, roomId, "");
      adaptor.play(roomId, undefined, roomId, []);
      setIsPlaying(true);
    }
  }, [adaptor, roomId]);

  const handleDisconnect = useCallback(() => {
    if (adaptor) {
      adaptor.stop(publishStreamId);
      adaptor.stop(roomId);
      removeRemoteVideo();
      setIsPlaying(false);
      setIsPublishing(false);
    }
  }, [adaptor, roomId]);

  const removeRemoteVideo = (streamId?: string) => {
    if (streamId != null || streamId != undefined) {
      setremoteTracks(prevTracks => {
        const updatedTracks = { ...prevTracks };
        if (updatedTracks[streamId]) {
          delete updatedTracks[streamId];
          console.log('Deleting Remote Track:', streamId);
          return updatedTracks;
        } else {
          return prevTracks;
        }
      });
      return;
    }
    console.warn("clearing all the remote renderer", remoteTracks, streamId)
    setremoteTracks([]);
  };

  useEffect(() => {
    const verify = () => {
      if (adaptor.localStream.current && adaptor.localStream.current.toURL()) {
        let videoTrack = adaptor.localStream.current.getVideoTracks()[0];
        return setLocalMedia(videoTrack);
      }
      setTimeout(verify, 5000);
    };
    verify();
  }, [adaptor.localStream]);

  useEffect(() => {
    if (localMedia && remoteTracks) {
      InCallManager.start({ media: 'video' });
    }
  }, [localMedia, remoteTracks]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Multitrack Conference</Text>
        <Text style={styles.heading}>Local Stream</Text>
        {localMedia ? <>{rtc_view(localMedia, styles.localPlayer)}</> : <></>}
        {!isPlaying ? (
          <>
            <TouchableOpacity onPress={handleConnect} style={styles.button}>
              <Text>Join Room</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.heading1}>Remote Streams</Text>
            {
              <ScrollView
                horizontal={true}
                contentContainerStyle={{
                  flexDirection: 'column',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  margin: 5,
                }}
                style={{ overflow: 'hidden' }}
              >
                {Object.values(remoteTracks).map((trackObj, index) => {
                  console.log('index', index, trackObj.track.id);
                  if (trackObj)
                    return (
                      <View key={index} style={trackObj.track.kind === 'audio' ? { display: 'none' } : {}}>
                        <>{rtc_view(trackObj.track, styles.players)}</>
                      </View>
                    );
                })}
              </ScrollView>
            }
            <TouchableOpacity style={styles.button} onPress={handleDisconnect}>
              <Text style={styles.btnTxt}>Leave Room</Text>
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
    width: 150,
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