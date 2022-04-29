import React, {useCallback, useRef, useState, useEffect} from 'react';
import {useAntMedia} from '@antmedia/react-native-ant-media';
import InCallManager from 'react-native-incall-manager';
import {
  Container,
  Button,
  Text,
  Label,
  InputView,
  Input,
  LocalView,
} from './styles';
import {WEB_SOCKET_URL, DEFAULT_STREAM} from '@env';

const webSocketUrl = WEB_SOCKET_URL;
const defaultStreamName = DEFAULT_STREAM;

const Publish: React.FC = () => {
  const [localMedia, setLocalMedia] = useState('');
  const streamNameRef = useRef<string>(defaultStreamName);
  const [isPlaying, setIsPlaying] = useState(false);

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
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
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
        case 'publish_started':
          console.log('publish_started');
          setIsPlaying(true);
          break;
        case 'publish_finished':
          console.log('publish_finished');
          InCallManager.stop();
          setIsPlaying(false);
          break;
        default:
          console.log(command);
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

  const handlePublish = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.publish(streamNameRef.current);
  }, [adaptor]);

  const handleStop = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.stop(streamNameRef.current);
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
        setTimeout(verify, 5000);
      };
      verify();
    }
  }, [adaptor]);

  useEffect(() => {
    if (localMedia) {
      InCallManager.start({media: 'video'});
    }
  }, [localMedia]);

  return (
    <Container>
      {!isPlaying ? (
        <>
         <Label children="Ant Media React Native Publish Example" />

          <InputView>
            <Label children="Stream Name" />
            <Input
              defaultValue={defaultStreamName}
              onChangeText={handleSetStreamName}
            />
          </InputView>
          <Button
            onPress={handlePublish}
            style={{alignSelf: 'center', marginHorizontal: 'auto'}}
          >
            <Text>Start Publishing</Text>
          </Button>
        </>
      ) : (
        <>
          <LocalView zOrder={1} objectFit="cover" streamURL={localMedia} />
          <Button style={{marginTop: 'auto'}} onPress={handleStop}>
            <Text>Stop</Text>
          </Button>
        </>
      )}
    </Container>
  );
};

export default Publish;
