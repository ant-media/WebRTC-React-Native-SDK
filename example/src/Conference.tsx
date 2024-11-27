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
import Icon from 'react-native-vector-icons/Ionicons';
import { DeviceEventEmitter } from 'react-native';
import InCallManager from 'react-native-incall-manager';

var publishStreamId: string;

export default function Conference() {
  var defaultRoomName = 'room1';
  const webSocketUrl = 'ws://test.antmedia.io:5080/WebRTCAppEE/websocket';
  //or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

  const [localMedia, setLocalMedia] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);
  const [remoteTracks, setremoteTracks] = useState<any>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [isWaitingWebsocketInit, setIsWaitingWebsocketInit] = useState(false);

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
        case 'initiated':
          console.log('initiated');
          break;
        case 'pong':
          break;
        case 'publish_started':
          adaptor.play(roomId, undefined, roomId, []);
          setIsPlaying(true);
          setIsPublishing(true);
          break;
        case 'publish_finished':
          setIsPublishing(false);
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
        case 'play_finished':
          console.log('play_finished');
          removeRemoteVideo();
          break;
        case "newTrackAvailable":
          {
            var incomingTrackId = data.track.id.substring("ARDAMSx".length);

            if (incomingTrackId == roomId || incomingTrackId == publishStreamId) {
              return;
            }
            console.log("new track available with id ", incomingTrackId);

            setremoteTracks((prevTracks: any) => {
              const updatedTracks = { ...prevTracks, [data.track.id]: data };
              return updatedTracks;
            });

            data.stream.onremovetrack = (event: any) => {
              console.log("track is removed with id: " + event.track.id)
              removeRemoteVideo(event.track.id);
            }
          }
          break;
        case "data_received":
          console.log('data_received', data);
          handleNotificationEvent(data);
          break;
        case "available_devices":
          console.log('available_devices', data);
          break;
        default:
          break;
      }
    },
    callbackError: (err: any, data: any) => {
      if (err === "no_active_streams_in_room" || err === "no_stream_exist") {
        // it throws this error when there is no stream in the room
        // so we shouldn't reset streams list
      } else {
        console.error('callbackError', err, data);
      }
    },
    debug: true,
  });

  const verify = () => {
    console.log('in verify');
    if (adaptor.localStream.current && adaptor.localStream.current.toURL()) {
      console.log('in verify if adaptor local stream', adaptor.localStream);
      if (isWaitingWebsocketInit) {
        setIsWaitingWebsocketInit(false);
        publishStreamId = generateRandomString(12);
        adaptor.publish(publishStreamId, undefined, undefined, undefined, undefined, roomId, "");
      }
      return setLocalMedia(adaptor.localStream.current.toURL());
    }
    setTimeout(verify, 5000);
  };

  const handleNotificationEvent = (notificationEvent: any) => {
    //var notificationEvent = JSON.parse(data);
    if (notificationEvent != null && typeof notificationEvent == "object") {
      var eventStreamId = notificationEvent.streamId;
      var eventType = notificationEvent.eventType;

      if (eventType == "VIDEO_TRACK_ASSIGNMENT_LIST") {
        var videoTrackAssignmentList = notificationEvent.payload;
        console.log("VIDEO_TRACK_ASSIGNMENT_LIST", videoTrackAssignmentList);
      } else if (eventType == "AUDIO_TRACK_ASSIGNMENT") {
        console.log("AUDIO_TRACK_ASSIGNMENT", notificationEvent.payload);
      } else if (eventType == "TRACK_LIST_UPDATED") {
        console.log("TRACK_LIST_UPDATED", notificationEvent.payload);
        adaptor.requestVideoTrackAssignments(roomId);
      }

    }
  };

  const handleMic = useCallback(() => {
    if (adaptor) {
      (isMuted) ? adaptor.unmuteLocalMic() : adaptor.muteLocalMic();
      setIsMuted(!isMuted);
    }
  }, [adaptor, isMuted]);

  const handleCamera = useCallback(() => {
    if (adaptor) {
      (isCameraOpen) ? adaptor.turnOffLocalCamera() : adaptor.turnOnLocalCamera();
      setIsCameraOpen(!isCameraOpen);
    }
  }, [adaptor, isCameraOpen]);

  const handleConnect = useCallback(() => {
    if (adaptor) {
      publishStreamId = generateRandomString(12);
      adaptor.publish(publishStreamId, undefined, undefined, undefined, undefined, roomId, "");
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

  /*
    const handleRemoteAudio = useCallback((streamId: string) => {
      if (adaptor) {
        adaptor?.muteRemoteAudio(streamId, roomId);
        //adaptor?.unmuteRemoteAudio(streamId, roomId);
      }
    }, [adaptor]);
  */

  const removeRemoteVideo = (streamId?: string) => {
    if (streamId != null || streamId != undefined) {
      setremoteTracks((prevTracks: any) => {
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
    console.info("clearing all the remote renderer", remoteTracks, streamId)
    setremoteTracks([]);
  };

  useEffect(() => {
    if (localMedia && remoteTracks) {
      InCallManager.start({ media: 'video' });
      DeviceEventEmitter.addListener("onAudioDeviceChanged", (event) => {
        console.log("onAudioDeviceChanged", event.availableAudioDeviceList);
      });
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
        <Text style={styles.heading}>Ant Media WebRTC Multi-track Conference</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <TouchableOpacity onPress={handleMic} style={styles.roundButton}>
                <Icon name={isMuted ? 'mic-off-outline' : 'mic-outline'} size={15} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCamera} style={styles.roundButton}>
                <Icon name={isCameraOpen ? 'videocam-outline' : 'videocam-off-outline'} size={15} color="#000" />
              </TouchableOpacity>
            </View>
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
                  //@ts-ignore
                  console.log('index', index, trackObj.track.id);
                  if (trackObj)
                    return (
                      // @ts-ignore
                      <View key={index} style={trackObj.track.kind === 'audio' ? { display: 'none' } : {}}>
                        <>{
                          // @ts-ignore
                          rtc_view(trackObj.track, styles.players)
                        }</>
                        {/*
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                          <TouchableOpacity onPress={()=>{
                            // @ts-ignore
                            handleRemoteAudio(trackObj.track.id.substring("ARDAMSx".length))
                            }} style={styles.roundButton}>
                              <Icon name={trackObj.track.enabled ? 'mic-outline' : 'mic-off-outline'} size={15} color="#000" />
                          </TouchableOpacity>
                        </View>
                        */}
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
  roundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDDDDD',
    padding: 5,
    borderRadius: 25, // This will make the button round
    width: 30, // Diameter of the button
    height: 30, // Diameter of the button
    marginTop: 10,
    marginHorizontal: 10,
  },
});
