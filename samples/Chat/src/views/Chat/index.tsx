import React, {useCallback, useRef, useState, useEffect} from 'react';

import {useAntMedia} from '@antmedia/react-native-ant-media';

import {Container, Button, Text, TextContainer,InputView,Label, Input} from './styles';

import {WEB_SOCKET_URL, DEFAULT_STREAM} from '@env';

const webSocketUrl = WEB_SOCKET_URL;
const defaultStreamName = DEFAULT_STREAM;

const Chat: React.FC = () => {
  const streamNameRef = useRef<string>(defaultStreamName);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [message, setMessage] = useState('');
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
   // mediaConstraints: {},
    onlyDataChannel: true,
   // sdp_constraints: {},
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
        case 'joined':
          setIsPlaying(true);
          break;
          case 'data_channel_opened':
            console.log('data_channel_opened inside');
            break;
          case 'data_received':
             console.log(command, data.event.data);
            setMessages((msgs) => [...msgs, data.event.data]);
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

  const handleConnect = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.join(streamNameRef.current);
  }, [adaptor]);

  const sendMessage = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.sendData(streamNameRef.current, message);
    setMessages((msgs) => [...msgs, message]);
    setMessage('');
  }, [message, adaptor]);

  const handleLeave = useCallback(() => {
    if (!adaptor) {
      return;
    }
    adaptor.leave(streamNameRef.current);
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

  return (
    <Container>
      {!isPlaying ? (
        <>
         <Label children="Ant Media React Native Chat Example" />

         <InputView>
            <Label children="Stream Name" />
            <Input
              defaultValue={defaultStreamName}
              onChangeText={handleSetStreamName}
            />
          </InputView>
         
          <Button
            onPress={handleConnect}
            style={{alignSelf: 'center', marginHorizontal: 'auto'}}>
            <Text>ENTER</Text>
          </Button>
        </>
      ) : (
        <>
          <TextContainer>
            {messages.map((i, k) => (
              <Text key={k}>{i}</Text>
            ))}
          </TextContainer>
          <Input value={message} onChangeText={setMessage} />
          <Button style={{marginTop: 10}} onPress={sendMessage}>
            <Text>Send</Text>
          </Button>
          <Button onPress={handleLeave} style={{marginTop: 20}}>
            <Text>Stop</Text>
          </Button>
        </>
      )}
    </Container>
  );
};

export default Chat;
