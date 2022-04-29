import React, {useCallback, useEffect, useRef, useState} from 'react';

import {useAntMedia} from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

import {
  Container,
  Input,
  Label,
  Text,
  Button,
  InputView,
  LocalView,
  RemoteView,
} from './styles';

import {WEB_SOCKET_URL, DEFAULT_STREAM} from '@env';

const webSocketUrl = WEB_SOCKET_URL;
const defaultStreamName = DEFAULT_STREAM;

type fn = () => void;

const Peer: React.FC = () => {
  const [localMedia, setLocalMedia] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const streamNameRef = useRef<string>(defaultStreamName);
  const [remoteMedia, setRemoteStream] = useState<string>('');
  const events = useRef<{
    [key: string]: fn;
  }>({});
  const adaptor = useAntMedia({
    url: webSocketUrl,
   
    mediaConstraints: {
      video: {
        mandatory: {
          minFrameRate: 30,
          minHeight: 480,
          minWidth: 640,
        },
        optional: [],
        facingMode: 'user',
      },
      audio: true,
    },
    sdp_constraints: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true,
    },
    bandwidth: 300,
    peerconnection_config: {
      iceServers: [
        {
          url: 'stun:stun.l.google.com:19302',
        },
      ],
    },
    callback(command, data) {
      switch (command) {
        case 'pong':
          break;
        case 'joined':
          setIsPlaying(true);
          break;
        default:
          break;
      }
    },
    callbackError: (err, data) => {
      console.error('callbackError', err, data);
    },
  });

  const handleSetStreamName = useCallback((value) => {
    streamNameRef.current = value || '';
  }, []);

  const handleLeave = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.leave(streamNameRef.current);
    InCallManager.stop();
    setIsPlaying(false);
  }, [adaptor]);

  useEffect(() => {
    events.current.handleLeave = handleLeave;
  }, [handleLeave]);

  useEffect(() => {
    const toLeave = events.current.handleLeave;
    return () => {
      if (streamNameRef.current) {
        toLeave();
      }
    };
  }, []);

  const handleJoin = useCallback(() => {
    if (!adaptor || !streamNameRef.current) {
      return;
    }
    adaptor.join(streamNameRef.current);
  }, [adaptor]);

  useEffect(() => {
    if (adaptor) {
      const verify = () => {
        if (
          adaptor.localStream.current &&
          adaptor.localStream.current.toURL()
        ) {
          return setLocalMedia(adaptor.localStream.current.toURL());
        }
        setTimeout(verify, 3000);
      };
      verify();
    }
  }, [adaptor]);

  useEffect(() => {
    if (localMedia && remoteMedia) {
      InCallManager.start({media: 'video'});
    }
  }, [localMedia, remoteMedia]);

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

  return (
    <Container is-playing={isPlaying}>
      {!isPlaying ? (
        <>
          <Label children="Ant Media Peer To Peer Example" />
          <InputView>
            <Label children="Stream Name" />
            <Input
              defaultValue={defaultStreamName}
              onChangeText={handleSetStreamName}
            />
          </InputView>
          <Button onPress={handleJoin}>
            <Text>Play</Text>
          </Button>
        </>
      ) : (
        <>
          <RemoteView zOrder={1} objectFit="cover" streamURL={remoteMedia} />
          <LocalView zOrder={2} objectFit="cover" streamURL={localMedia} />
          <Button style={{marginTop: 'auto'}} onPress={handleLeave}>
            <Text>Stop</Text>
          </Button>
        </>
      )}
    </Container>
  );
};

export default Peer;