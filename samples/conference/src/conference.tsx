import React, {useCallback, useRef, useState, useEffect} from 'react';

import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
import {useAntMedia, rtc_view} from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

export default function Conference() {
  var defaultRoomName = 'roomTest1';
  const webSocketUrl = 'ws://server.com:5080/WebRTCAppEE/websocket';
  //or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

  const [localMedia, setLocalMedia] = useState('');
  const [remoteStreams, setremoteStreams] = useState([]);
  const [remoteStreams1, updateRemoteStreams1] = useState([]);
  const [remoteMedia, setRemoteStream] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);
  const [maximizedStream, setMaximizedStream] = useState(null);
  const stream = useRef({id: ''}).current;
  let roomTimerId: any = useRef(null).current;
  let streamsList: any = useRef([]).current;

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
        case 'joinedTheRoom':
          const tok = data.ATTR_ROOM_NAME;
          adaptor.initPeerConnection(data.streamId);
          adaptor.publish(data.streamId, tok);
          stream.id = data.streamId;
          const streams = data.streams;

          if (streams != null) {
            streams.forEach((item: any) => {
              if (item === stream.id) {
                return;
              }
              adaptor.play(item, tok, roomId);
            });
            streamsList = streams;
          }
          roomTimerId = setInterval(() => {
            adaptor.getRoomInfo(roomId, data.streamId);
          }, 3000);

          break;
        case 'publish_started':
          setIsPublishing(true);
          break;
        case 'publish_finished':
          streamsList = [];
          setIsPublishing(false);
          break;
        case 'streamJoined':
          adaptor.play(data.streamId, undefined, roomId);
          break;
        case 'leavedFromRoom':
          const remoteStreamsArr: any = [];
          updateRemoteStreams1(remoteStreamsArr);

          clearRoomInfoInterval();
          break;
        case 'roomInformation':
          const token = data.ATTR_ROOM_NAME;
          for (let str of data.streams) {
            if (!streamsList.includes(str)) {
              adaptor.play(str, token, roomId);
            }
          }
          streamsList = data.streams;
          break;
        default:
          break;
      }
    },
    callbackError: (err: any, data: any) => {
      console.error('callbackError', err, data);
      clearRoomInfoInterval();
    },
    peer_connection_config: {
      iceServers: [
        {
          url: 'stun:stun.l.google.com:19302',
        },
      ],
    },
    debug: false,
  });

  const clearRoomInfoInterval = () => {
    if (roomTimerId != null) {
      clearInterval(roomTimerId);
    }
  };

  const handleConnect = useCallback(() => {
    if (adaptor) {
      adaptor.joinRoom(roomId, undefined);
      setIsPlaying(true);
    }
  }, [adaptor, roomId]);

  const handleDisconnect = useCallback(() => {
    if (adaptor) {
      adaptor.leaveFromRoom(roomId);
      clearRoomInfoInterval();
      setIsPlaying(false);
      setMaximizedStream(null);
    }
  }, [adaptor, clearRoomInfoInterval, roomId]);

  useEffect(() => {
    const verify = () => {
      if (adaptor.localStream.current && adaptor.localStream.current.toURL()) {
        return setLocalMedia(adaptor.localStream.current.toURL());
      }
      setTimeout(verify, 5000);
    };
    verify();
  }, [adaptor.localStream]);

  useEffect(() => {
    if (localMedia && remoteMedia) {
      InCallManager.start({media: 'video'});
    }
  }, [localMedia, remoteMedia]);

  const getRemoteStreams = () => {
    const remoteStreamsFn: any = [];
    updateRemoteStreams1(remoteStreamsFn);
    if (adaptor && Object.keys(adaptor.remoteStreams).length > 0) {
      for (let i in adaptor.remoteStreams) {
        if (i !== stream.id) {
          let st =
            adaptor.remoteStreams[i] && 'toURL' in adaptor.remoteStreams[i]
              ? adaptor.remoteStreams[i].toURL()
              : null;

          if (st) {
            remoteStreamsFn.push(st);
          }
        }
      }

      updateRemoteStreams1(remoteStreamsFn);
    }

    setremoteStreams(remoteStreams1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.heading}>Ant Media WebRTC Conference</Text>
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
            {remoteStreams.length <= 3 ? (
              <>
                <View style={styles.remotePlayersWrap}>
                  {remoteStreams.map((a, index) => {
                    if (a)
                      return (
                        <View key={index}>
                          <>{rtc_view(a, styles.players)}</>
                        </View>
                      );
                  })}
                </View>
              </>
            ) : (
              <></>
            )}
            <TouchableOpacity style={styles.button} onPress={handleDisconnect}>
              <Text style={styles.btnTxt}>Leave Room</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.button} onPress={getRemoteStreams}>
          <Text style={styles.btnTxt}>Refresh Room</Text>
        </TouchableOpacity>
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
  remotePlayersWrap: {
    flexDirection: 'row',
    alignSelf: 'center',
    margin: 5,
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
