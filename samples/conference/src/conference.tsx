import React, {useCallback, useRef, useState, useEffect} from 'react';

import {
  View,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
import {useAntMedia, rtc_view} from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

export default function Conference() {
  var defaultRoomName = 'streamTest1';
  const webSocketUrl = 'ws://server.com:5080/WebRTCAppEE/websocket';
  //or webSocketUrl: 'wss://server.com:5443/WebRTCAppEE/websocket',

  const [localMedia, setLocalMedia] = useState('');
  const [remoteStreams, setremoteStreams] = useState<any>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomName);
  const stream = useRef({id: ''}).current;
  let roomTimerId: any = useRef(0).current;
  let streamsList: any = useRef([]).current;
  const [PlayStreamsListArr, updatePlayStreamsListArr] = useState<any>([]);

  let allStreams: any = [];

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
          console.log('joined the room!');

          const tok = data.ATTR_ROOM_NAME;
          adaptor.publish(data.streamId, tok);
          const streams = data.streams;

          if (streams != null) {
            streams.forEach((item: any) => {
              if (item === stream.id) return;
              adaptor.play(item, tok, roomId);
            });
            streamsList = streams;
            updatePlayStreamsListArr([]);

            //reset media streams
            setremoteStreams([]);

            updatePlayStreamsListArr(streams);
          }

          roomTimerId = setInterval(() => {
            adaptor.getRoomInfo(roomId, data.streamId);
          }, 5000);

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
          console.log('leavedFromRoom');

          clearRoomInfoInterval();

          if (PlayStreamsListArr != null) {
            PlayStreamsListArr.forEach(function (item: any) {
              removeRemoteVideo(item);
            });
          }

          // we need to reset streams list
          updatePlayStreamsListArr([]);

          //reset media streams
          setremoteStreams([]);
          break;
        case 'play_finished':
          console.log('play_finished');
          removeRemoteVideo(data.streamId);
          break;
        case 'roomInformation':
          //Checks if any new stream has added, if yes, plays.
          for (let str of data.streams) {
            if (!PlayStreamsListArr.includes(str)) {
              adaptor.play(str, tok, roomId);
            }
          }

          // Checks if any stream has been removed, if yes, removes the view and stops web rtc connection.
          for (let str of PlayStreamsListArr) {
            if (!data.streams.includes(str)) {
              removeRemoteVideo(str);
            }
          }

          //Lastly updates the current stream list with the fetched one.
          updatePlayStreamsListArr(data.streams);

          console.log(Platform.OS, 'data.streams', data.streams);
          console.log(Platform.OS, 'PlayStreamsListArr', PlayStreamsListArr);

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
        clearRoomInfoInterval();
      }
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
    console.log('interval cleared');
    clearInterval(roomTimerId);
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

      allStreams = [];

      clearRoomInfoInterval();
      setIsPlaying(false);
    }
  }, [adaptor, clearRoomInfoInterval, roomId]);

  const removeRemoteVideo = (streamId: any) => {
    streamsList = [];

    adaptor.stop(streamId);
    streamsList = PlayStreamsListArr.filter((item: any) => item !== streamId);
    updatePlayStreamsListArr(streamsList);
  };

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
    if (localMedia && remoteStreams) {
      InCallManager.start({media: 'video'});
    }
  }, [localMedia, remoteStreams]);

  const getRemoteStreams = () => {
    const remoteStreamArr: any = [];

    if (adaptor && Object.keys(adaptor.remoteStreamsMapped).length > 0) {
      for (let i in adaptor.remoteStreamsMapped) {
        let st =
          adaptor.remoteStreamsMapped[i] &&
          'toURL' in adaptor.remoteStreamsMapped[i]
            ? adaptor.remoteStreamsMapped[i].toURL()
            : null;

        if (PlayStreamsListArr.includes(i)) {
          if (st) remoteStreamArr.push(st);
        }
      }
    }

    setremoteStreams(remoteStreamArr);
  };

  useEffect(() => {
    const remoteStreamArr: any = [];

    if (adaptor && Object.keys(adaptor.remoteStreamsMapped).length > 0) {
      for (let i in adaptor.remoteStreamsMapped) {
        let st =
          adaptor.remoteStreamsMapped[i] &&
          'toURL' in adaptor.remoteStreamsMapped[i]
            ? adaptor.remoteStreamsMapped[i].toURL()
            : null;

        if (PlayStreamsListArr.includes(i)) {
          if (st) remoteStreamArr.push(st);
        }
      }
    }

    setremoteStreams(remoteStreamArr);
  }, [adaptor.remoteStreamsMapped]);

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
                <View
                  style={{
                    flexDirection: 'row',
                    alignSelf: 'center',
                    margin: 5,
                  }}>
                  {remoteStreams.map((a, index) => {
                    const count = remoteStreams.length;
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
