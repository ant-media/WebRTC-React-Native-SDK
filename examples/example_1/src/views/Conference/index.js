import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Platform,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';

// NOTE: remove this dependency if you want don't want loud speaker ability
//import RNSwitchAudioOutput from 'react-native-switch-audio-output';

import StreamView from './StreamView';
import useAntMedia from './useAntMedia';
import styles from './styles';
import {WEB_SOCKET_URL, DEFAULT_STREAM} from '@env';

const pc_config = {iceServers: [{urls: 'stun:stun1.l.google.com:19302'}]};

const webSocketUrl = WEB_SOCKET_URL;
const defaultStreamName = DEFAULT_STREAM;

const App = () => {
  const [localStream, setLocalStream] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [roomId, setRoomId] = useState(defaultStreamName);
  const [isMute, setIsMute] = useState(false);
  const [isMuteVideo, setIsMuteVideo] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isFront, setIsFront] = useState(true);
  const [maximizedStream, setMaximizedStream] = useState(null);
  const stream = useRef({id: ''}).current;
  let roomTimerId = useRef(null).current;
  let streamsList = useRef([]).current;

  const {width, height} = Dimensions.get('screen');

  const adaptor = useAntMedia({
    url: webSocketUrl,

    mediaConstraints: {
      video: true,
      audio: true,
    },
    sdp_constraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    },
    bandwidth: 300,
    peerconnection_config: pc_config,
    callback(command, data) {
      switch (command) {
        case 'pong':
          break;
        case 'joinedTheRoom':
          const tok = data.ATTR_ROOM_NAME;
          this.initPeerConnection(data.streamId);
          this.publish(data.streamId, tok);
          stream.id = data.streamId;
          const streams = data.streams;

          if (streams != null) {
            streams.forEach((item) => {
              if (item === stream.id) return;
              this.play(item, tok, roomId);
            });
            streamsList = streams;
          }
          roomTimerId = setInterval(() => {
            this.getRoomInfo(roomId, data.streamId);
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
          this.play(data.streamId, undefined, roomId);
          break;
        case 'leavedFromRoom':
          console.log('leavedFromRoom');
          clearRoomInfoInterval();
          break;
        case 'roomInformation':
          const token = data.ATTR_ROOM_NAME;
          for (let str of data.streams) {
            if (!streamsList.includes(str)) {
              this.play(str, token, roomId);
            }
          }
          streamsList = data.streams;
          console.log(Platform.OS, 'roomInformation', data);
          break;
        default:
          break;
      }
    },
    callbackError: (err, data) => {
      console.log('callbackError', err, data);
      clearRoomInfoInterval();
    },
  });

  const clearRoomInfoInterval = () => {
    if (roomTimerId != null) {
      console.log('interval cleared');
      clearInterval(roomTimerId);
    }
  };

  const handleConnect = useCallback(() => {
    if (adaptor) {
      adaptor.joinRoom(roomId, undefined);
      setIsPublishing(true);
    }
  }, [adaptor, roomId]);

  const handleDisconnect = useCallback(() => {
    if (adaptor) {
      adaptor.leaveFromRoom(roomId);
      clearRoomInfoInterval();
      setIsPublishing(false);
      setMaximizedStream(null);
    }
  }, [adaptor, roomId, roomTimerId]);

  const handleMute = useCallback(() => {
    if (adaptor) {
      adaptor.handleTurnVolume();
      setIsMute(!isMute);
    }
  }, [adaptor, isMute]);

  const handleVideo = useCallback(() => {
    if (adaptor) {
      adaptor.handleTurnCamera();
      setIsMuteVideo(!isMuteVideo);
    }
  }, [adaptor, isMuteVideo]);

  const switchCamera = useCallback(() => {
    if (adaptor) {
      adaptor.switchCamera();
      setIsFront(!isFront);
    }
  }, [adaptor, isFront]);

  useEffect(() => {
    if (adaptor) {
      const verify = () => {
        if (
          adaptor.localStream.current &&
          adaptor.localStream.current.toURL()
        ) {
          return setLocalStream(adaptor.localStream.current.toURL());
        }
        setTimeout(verify, 3000);
      };
      verify();
    }
  }, [adaptor]);

  const getRemoteStreams = () => {
    const remoteStreams = [];
    if (adaptor && Object.keys(adaptor.remoteStreams).length > 0) {
      for (let i in adaptor.remoteStreams) {
        if (i !== stream.id) {
          let st =
            adaptor.remoteStreams[i][0] &&
            'toURL' in adaptor.remoteStreams[i][0]
              ? adaptor.remoteStreams[i][0].toURL()
              : null;
          if (st) remoteStreams.push(st);
        }
      }
    }
    return remoteStreams;
  };

  const renderStream = ({item: _stream}) => {
    const count = allStreams.length;
    let wScale = 1;
    let hScale = 1;
    if (count > 3 && count < 6) wScale = 2;
    else if (count > 6) wScale = 2;

    if (count % 3 === 0 || count >= 5) hScale = 2;
   // else if (count < 5 && count !== 1) hScale = 2;

    return (
      <TouchableOpacity
        onPress={() => setMaximizedStream(_stream)}
        activeOpacity={0.9}
        style={{width: width / wScale, height: height / hScale}}
      >
        {!maximizedStream && <StreamView stream={_stream} />}
      </TouchableOpacity>
    );
  };

  const renderMaximizedStream = () => {
    if (!maximizedStream) return null;
    return (
      <View style={styles.fullscreen}>
        <StreamView stream={maximizedStream} />
        <TouchableOpacity
          onPress={() => setMaximizedStream(null)}
          style={styles.closeBtn}
        >
          <Text style={styles.btnTxt}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const remoteStreams = getRemoteStreams();
  let allStreams = [];
  if (localStream) allStreams = [localStream];
  if (remoteStreams.length) allStreams = [...allStreams, ...remoteStreams];

  const numColumns =
    allStreams.length <= 3
      ? 1
      : allStreams.length > 3 && allStreams.length <= 6
      ? 2
      : 3;

  return (
    <View style={styles.container}>
      <FlatList
        renderItem={renderStream}
        data={allStreams}
        keyExtractor={(item) => item}
        numColumns={numColumns}
        key={numColumns}
      />
      {!isPublishing ? (
        <View style={styles.formView}>
          <Text style={styles.title}>WebRTC{'\n'}Conference</Text>
          <TextInput
            style={styles.txtInput}
            placeholder="Enter Room"
            value={roomId}
            onChangeText={setRoomId}
          />
          <TouchableOpacity
            disabled={!localStream}
            style={[
              styles.joinBtn,
              !localStream ? {backgroundColor: 'red'} : {},
            ]}
            onPress={handleConnect}
          >
            <Text style={styles.btnTxt}>Join room</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomAction}>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleMute}>
            <Text style={styles.btnTxt}>{isMute ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <View style={{width: 10}} />
          <TouchableOpacity style={styles.leaveBtn} onPress={handleVideo}>
            <Text style={styles.btnTxt}>
              {isMuteVideo ? 'On' : 'Off'} Video
            </Text>
          </TouchableOpacity>
          <View style={{width: 10}} />
          <TouchableOpacity style={styles.leaveBtn} onPress={handleDisconnect}>
            <Text style={styles.btnTxt}>Leave room</Text>
          </TouchableOpacity>
          <View style={{width: 10}} />
          <TouchableOpacity style={styles.leaveBtn} onPress={switchCamera}>
            <Text style={styles.btnTxt}>Switch Camera</Text>
          </TouchableOpacity>
          <View style={{width: 10}} />
        </View>
      )}
      {renderMaximizedStream(4)}
    </View>
  );
};

export default App;
