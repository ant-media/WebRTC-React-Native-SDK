import { ReactText, useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  MediaStreamConstraints,
  EventOnCandidate,
  RTCSessionDescriptionType,
  RTCIceCandidateType,
  EventOnAddStream,
} from 'react-native-webrtc';

import {
  Params,
  RemoteDescriptionSet,
  CustomWebSocket,
  RemotePeerConnectionStats,
  RemotePeerConnection,
  RemoteStreams,
  Socket,
  Sender,
  IceCandidateList,
  Adaptor,
} from '../interfaces';

function useAntMedia(params: Params) {
  const {
    url,
    onopen,
    callbackError,
    callback,
    mediaConstraints,
    sdp_constraints,
    peerconnection_config,
    bandwidth: bwh,
    debug,
    onlyDataChannel,
  } = params;
  const [roomName, setRoomName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isTurnedOf, setIsTurnedOf] = useState(false);
  const [isPlayMode, setIsPlayMode] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>({});
  const [connected, setConnected] = useState(false);
  const localStream = useRef<null | MediaStream>(null);
  const socket = useRef<Socket>({
    ws: null,
  }).current;
  const playStreamIds = useRef<string[]>([]).current;
  const remotePeerConnection = useRef<RemotePeerConnection>({}).current;
  const remotePeerConnectionStats = useRef<RemotePeerConnectionStats>({})
    .current;
  const remoteDescriptionSet = useRef<RemoteDescriptionSet>({}).current;
  const iceCandidateList = useRef<IceCandidateList>({}).current;
  const bandwidth = useRef({ value: bwh || 900 }).current;

  const adaptorRef = useRef<null | Adaptor>(null);

  const closePeerConnection = useCallback((streamId: string) => {
    if (remotePeerConnection[streamId] != null) {
      // @ts-ignore
      if (remotePeerConnection[streamId].dataChannel != null)
        // @ts-ignore
        remotePeerConnection[streamId].dataChannel.close();

      setRemoteStreams(value => {
        const val = { ...value };
        const streams = [...remotePeerConnection[streamId].getLocalStreams()];
        streams.forEach(stream => {
          if (localStream.current?.toURL() !== stream.toURL()) {
            delete val[stream.toURL()];
          }
        });
        return val;
      });

      if (remotePeerConnection[streamId].signalingState !== 'closed') {
        remotePeerConnection[streamId].close();
        // @ts-ignore;
        remotePeerConnection[streamId] = null;

        delete remotePeerConnection[streamId];
        const playStreamIndex = playStreamIds.indexOf(streamId);

        if (playStreamIndex !== -1) {
          playStreamIds.splice(playStreamIndex, 1);
        }
      }
    }

    if (remotePeerConnectionStats[streamId] != null) {
      clearInterval(remotePeerConnectionStats[streamId].timerId);
      delete remotePeerConnectionStats[streamId];
    }
  }, []);

  const getVideoSender = useCallback((streamId: string) => {
    let videoSender = null;
    const senders: Sender[] = [];

    const rmS = remotePeerConnection[streamId].getRemoteStreams();

    setRemoteStreams(value => {
      const val = { ...value };
      const streams = [
        ...remotePeerConnection[streamId].getLocalStreams(),
        ...remotePeerConnection[streamId].getRemoteStreams(),
      ];
      streams.forEach(stream => {
        if (localStream.current?.toURL() !== stream.toURL()) {
          val[stream.toURL()] = stream;
        }
      });
      return val;
    });

    rmS.forEach(i => {
      i.getTracks().forEach(track => {
        senders.push({
          track,
          getParameters: () => ({}),
          setParameters: () => ({}),
        });
      });
    });

    for (let i = 0; i < senders.length; i++) {
      if (senders[i].track != null && senders[i].track.kind === 'video') {
        videoSender = senders[i];
        break;
      }
    }

    return videoSender;
  }, []);

  const changeBandwidth = useCallback(
    async (bw: ReactText, streamId: string) => {
      let errorDefinition = '';
      const videoSender = getVideoSender(streamId);

      if (videoSender !== null) {
        const parameters = videoSender.getParameters();

        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }

        if (bw === 'unlimited') {
          delete parameters.encodings[0].maxBitrate;
        } else {
          parameters.encodings[0].maxBitrate = parseInt(bw + '', 10) * 1000;
        }

        return videoSender.setParameters(parameters);
      }
      errorDefinition = 'Video sender not found to change bandwidth';

      throw new Error(errorDefinition);
    },
    [],
  );

  const iceCandidateReceived = useCallback(
    (event: EventOnCandidate, streamId: string) => {
      if (event.candidate) {
        const jsCmd = {
          command: 'takeCandidate',
          streamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        };

        if (socket.ws) socket.ws.sendJson(jsCmd);
      }
    },
    [],
  );

  const onTrack = useCallback((event, streamId: string) => {
    if (!remoteStreams[streamId]) {
      // setRemoteStreams(dt => {
      //   dt[streamId] = event.streams[0];
      //   return dt;
      // });
      const dataObj = {
        track: event.streams[0],
        streamId,
      };
      if (adaptorRef.current)
        callback.call(adaptorRef.current, 'newStreamAvailable', dataObj);
    }
  }, []);

  // data channel mode can be "publish" , "play" or "peer" based on this it is decided which way data channel is created
  const initPeerConnection = useCallback(
    async (streamId: string, dataChannelMode: 'publish' | 'play' | 'peer') => {
      if (remotePeerConnection[streamId] == null) {
        const closedStreamId = streamId;
        remotePeerConnection[streamId] = new RTCPeerConnection(
          peerconnection_config || {
            iceServers: [],
          },
        );
        remoteDescriptionSet[streamId] = false;
        iceCandidateList[streamId] = [];
        if (!playStreamIds.includes(streamId) && localStream.current) {
          remotePeerConnection[streamId].addStream(localStream.current);
        }
        try {
          remotePeerConnection[streamId].onicecandidate = event => {
            iceCandidateReceived(event, closedStreamId);
          };
          // @ts-ignore
          remotePeerConnection[streamId].ontrack = event => {
            if (debug) console.log('onTrack', event);
            onTrack(event, closedStreamId);
          };

          remotePeerConnection[streamId].onaddstream = (
            e: EventOnAddStream,
          ) => {
            setRemoteStreams(value => {
              const val = { ...value };
              const streams = [
                ...remotePeerConnection[streamId].getLocalStreams(),
                ...remotePeerConnection[streamId].getRemoteStreams(),
              ];
              streams.forEach(stream => {
                if (localStream.current?.toURL() !== stream.toURL()) {
                  val[stream.toURL()] = stream;
                }
              });
              return val;
            });
          };

          if (dataChannelMode === 'publish') {
            //open data channel if it's publish mode peer connection
            const dataChannelOptions = {
              ordered: true,
            };
            const dataChannelPeer = remotePeerConnection[
              streamId
            ].createDataChannel(streamId, dataChannelOptions);
            initDataChannel(streamId, dataChannelPeer);
          } else if (dataChannelMode === 'play') {
            //in play mode, server opens the data channel
            // Property 'ondatachannel' does not exist on type 'RTCPeerConnection' react-native-webrtc
            // @ts-ignore
            remotePeerConnection[streamId].ondatachannel = event => {
              initDataChannel(streamId, event.channel);
            };
          } else {
            //for peer mode do both for now
            const dataChannelOptions = {
              ordered: true,
            };

            const dataChannelPeer = remotePeerConnection[
              streamId
            ].createDataChannel(streamId, dataChannelOptions);
            initDataChannel(streamId, dataChannelPeer);

            // @ts-ignore
            remotePeerConnection[streamId].ondatachannel = (ev: any) => {
              initDataChannel(streamId, ev.channel);
            };
          }

          if (!isPlayMode) {
            remotePeerConnection[
              streamId
            ].oniceconnectionstatechange = event => {
              if (
                !event.target.iceConnectionState.match(
                  /(closed|disconnected|failed)/i,
                )
              ) {
                // console.log(event.target.iceConnectionState);
                try {
                  getVideoSender(streamId);
                } catch (err) {}
              }
              if (event.target.iceConnectionState === 'connected') {
                (async () => {
                  try {
                    await changeBandwidth(bandwidth.value, streamId);
                  } catch (e) {
                    if (debug) console.error(e);
                  }
                })();
              }
            };
          }
        } catch (err) {
          if (debug) console.error('initPeerConnectionError', err.message);
        }
      }
    },
    [isPlayMode, localStream],
  );

  const initDataChannel = useCallback((streamId: string, dataChannel: any) => {
    dataChannel.onerror = (error: any) => {
      // console.log("Data Channel Error:", error );
      const obj = {
        streamId: streamId,
        error: error,
      };
      // console.log("channel status: ", dataChannel.readyState);
      if (dataChannel.readyState !== 'closed' && callbackError) {
        callbackError('data_channel_error', obj);
      }
    };

    dataChannel.onmessage = (event: any) => {
      const obj = {
        streamId: streamId,
        event: event,
      };
      if (callback && adaptorRef.current)
        callback.call(adaptorRef.current, 'data_received', obj);
    };

    dataChannel.onopen = () => {
      // @ts-ignore
      remotePeerConnection[streamId].dataChannel = dataChannel;
      // console.log("Data channel is opened");
      if (callback && adaptorRef.current)
        callback.call(adaptorRef.current, 'data_channel_opened', streamId);
    };

    dataChannel.onclose = () => {
      // console.log("Data channel is closed");
      if (callback && adaptorRef.current)
        callback.call(adaptorRef.current, 'data_channel_closed', streamId);
    };
  }, []);

  const gotDescription = useCallback(
    async (configuration: RTCSessionDescriptionType, streamId: string) => {
      try {
        // const response =
        await remotePeerConnection[streamId].setLocalDescription(configuration);

        const jsCmd = {
          command: 'takeConfiguration',
          streamId,
          type: configuration.type,
          sdp: configuration.sdp,
        };

        if (socket.ws) socket.ws.sendJson(jsCmd);
      } catch (err) {
        if (debug) console.log('gotDescriptionError', err);
      }
    },
    [],
  );

  const startPublishing = useCallback(
    async (streamId: string) => {
      try {
        await initPeerConnection(streamId, 'publish');
        const configuration = await remotePeerConnection[streamId].createOffer(
          sdp_constraints,
        );
        await gotDescription(configuration, streamId);
      } catch (err) {
        if (debug) console.log('startPublishing error', err.message, err.stack);
      }
    },
    [initPeerConnection],
  );

  const getUserMedia = useCallback(async (mdC: MediaStreamConstraints) => {
    const stream = await mediaDevices.getUserMedia(mdC);
    if (typeof stream !== 'boolean') localStream.current = stream;
  }, []);

  const publish = useCallback(
    (
      streamId: string,
      token?: string,
      subscriberId?: string,
      subscriberCode?: string,
    ) => {
      let data = {} as any;
      if (onlyDataChannel) {
        data = {
          command: 'publish',
          streamId: streamId,
          token: token,
          subscriberId: typeof subscriberId !== undefined ? subscriberId : '',
          subscriberCode:
            typeof subscriberCode !== undefined ? subscriberCode : '',
          video: false,
          audio: false,
        };
      } else {
        if (!localStream.current) return;

        let [video, audio] = [false, false];

        // @ts-ignore
        video = localStream.current.getVideoTracks().length > 0;
        // @ts-ignore
        audio = localStream.current.getAudioTracks().length > 0;

        data = {
          command: 'publish',
          streamId,
          token,
          subscriberId: typeof subscriberId !== undefined ? subscriberId : '',
          subscriberCode:
            typeof subscriberCode !== undefined ? subscriberCode : '',
          video,
          audio,
        };
      }

      if (socket.ws) socket.ws.sendJson(data);
    },
    [],
  );

  const joinRoom = useCallback((room: string, streamId?: string) => {
    const data = {
      command: 'joinRoom',
      room,
      streamId,
    };
    setRoomName(room);

    if (socket.ws) socket.ws.sendJson(data);
  }, []);

  const leaveFromRoom = useCallback((room: string) => {
    const data = {
      command: 'leaveFromRoom',
      room,
    };
    setRoomName(room);
    if (socket.ws) socket.ws.sendJson(data);
  }, []);

  const join = useCallback((streamId: string) => {
    const data = {
      command: 'join',
      streamId,
    };
    if (socket.ws) socket.ws.sendJson(data);
  }, []);

  const leave = useCallback((streamId: string) => {
    const data = {
      command: 'leave',
      streamId,
    };
    if (socket.ws) socket.ws.sendJson(data);
  }, []);

  const play = useCallback(
    (streamId: string, token?: string, room?: string) => {
      playStreamIds.push(streamId);
      const data = {
        command: 'play',
        streamId,
        token,
        room,
      };

      if (token) {
        data.token = token;
      }

      if (socket.ws) socket.ws.sendJson(data);

      setIsPlayMode(true);
    },
    [],
  );

  const stop = useCallback((streamId: string) => {
    const data = {
      command: 'stop',
      streamId,
    };

    if (socket.ws) socket.ws.sendJson(data);
    setIsPlayMode(false);
  }, []);

  const handleTurnVolume = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    } else {
      if (callbackError) callbackError('NoActiveConnection');
    }
  }, []);

  const handleTurnCamera = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      track.enabled = !track.enabled;
      setIsTurnedOf(!track.enabled);
    } else {
      if (callbackError) callbackError('NoActiveConnection');
    }
  }, []);

  const getStreamInfo = useCallback((streamId: string) => {
    const jsCmd = {
      command: 'getStreamInfo',
      streamId,
    };
    if (socket.ws) socket.ws.sendJson(jsCmd);
  }, []);

  const addIceCandidate = useCallback(
    async (streamId: string, candidate: RTCIceCandidateType) => {
      try {
        if (debug) console.debug(`addIceCandidate ${streamId}`);
        await remotePeerConnection[streamId].addIceCandidate(candidate);
      } catch (err) {}
    },
    [],
  );

  const takeConfiguration = useCallback(
    async (idOfStream: string, configuration, typeOfConfiguration) => {
      const streamId = idOfStream;
      const type = typeOfConfiguration;
      const conf = configuration;
      const isTypeOffer = type === 'offer';

      let dataChannelMode: 'publish' | 'play' = 'publish';
      if (isTypeOffer) {
        dataChannelMode = 'play';
      }

      await initPeerConnection(streamId, dataChannelMode);
      try {
        const response = await remotePeerConnection[
          streamId
        ].setRemoteDescription(
          new RTCSessionDescription({
            sdp: conf,
            type,
          }),
        );

        remoteDescriptionSet[streamId] = true;
        const { length } = Object.keys(iceCandidateList[streamId]);

        for (let i = 0; i < length; i++) {
          await addIceCandidate(streamId, iceCandidateList[streamId][i]);
        }
        iceCandidateList[streamId] = [];

        if (isTypeOffer) {
          const configur = await remotePeerConnection[streamId].createAnswer(
            sdp_constraints,
          );
          await gotDescription(configur, streamId);
        }
      } catch (error) {
        if (
          error.toString().indexOf('InvalidAccessError') > -1 ||
          error.toString().indexOf('setRemoteDescription') > -1
        ) {
          /**
           * This error generally occurs in codec incompatibility.
           * AMS for a now supports H.264 codec. This error happens when some browsers try to open it from VP8.
           */
          if (callbackError) callbackError('notSetRemoteDescription');
        }
      }
    },
    [],
  );

  const takeCandidate = useCallback(
    async (idOfTheStream: string, tmpLabel, tmpCandidate, sdpMid) => {
      const streamId = idOfTheStream;
      const label = tmpLabel;
      const candidateSdp = tmpCandidate;

      const candidate = new RTCIceCandidate({
        sdpMLineIndex: label,
        candidate: candidateSdp,
        sdpMid,
      });

      await initPeerConnection(streamId, 'peer');

      if (remoteDescriptionSet[streamId] === true) {
        await addIceCandidate(streamId, candidate);
      } else {
        if (debug)
          console.debug(
            'Ice candidate is added to list because remote description is not set yet',
          );
        const index = iceCandidateList[streamId].findIndex(
          i => JSON.stringify(i) === JSON.stringify(candidate),
        );
        if (index === -1) {
          const keys = Object.keys(candidate);
          for (const key in keys) {
            // @ts-ignore
            if (candidate[key] === undefined || candidate[key] === '') {
              // @ts-ignore
              candidate[key] = null;
            }
          }
          iceCandidateList[streamId].push(candidate);
        }
      }
    },
    [],
  );

  const peerMessage = useCallback(
    (streamId: string, definition: any, data: any) => {
      const jsCmd = {
        command: 'peerMessageCommand',
        streamId: streamId,
        definition: definition,
        data: data,
      };
      if (socket.ws) socket.ws.sendJson(jsCmd);
    },
    [],
  );

  const sendData = useCallback((streamId: string, message: string) => {
    // @ts-ignore
    const dataChannel = remotePeerConnection[streamId].dataChannel;
    dataChannel.send(message);
  }, []);

  const signallingState = useCallback((streamId: string) => {
    if (remotePeerConnection[streamId] != null) {
      return remotePeerConnection[streamId].signalingState;
    }
    return null;
  }, []);

  const init = useCallback(async () => {
    if (
      !isPlayMode &&
      typeof mediaConstraints !== 'undefined' &&
      localStream.current == null &&
      !onlyDataChannel
    ) {
      await getUserMedia(mediaConstraints);
    }
  }, [isPlayMode, getUserMedia, mediaConstraints]);

  useEffect(() => {
    const ws = new WebSocket(url) as CustomWebSocket;
    let pingTimerId = -1;

    ws.onopen = (data: any) => {
      ws.sendJson = dt => {
        ws.send(JSON.stringify(dt));
      };
      pingTimerId = setInterval(() => {
        ws.sendJson({
          command: 'ping',
        });
      });
      init()
        .then(() => {
          if (onopen) onopen(data);
          socket.ws = ws;
          setConnected(true);
        })
        .catch(err => {
          if (callbackError) callbackError('initError', err);
        });
    };

    ws.onmessage = async event => {
      const data = JSON.parse(event.data);
      switch (data.command) {
        case 'start':
          startPublishing(data.streamId);
          break;
        case 'takeCandidate':
          takeCandidate(data.streamId, data.label, data.candidate, data.id);
          break;
        case 'takeConfiguration':
          takeConfiguration(data.streamId, data.sdp, data.type);
          break;
        case 'stop':
          closePeerConnection(data.streamId);
          break;
        case 'error':
          if (callbackError) {
            callbackError(data.definition, data);
          }
          break;
        case 'notification':
          if (adaptorRef.current)
            callback.call(adaptorRef.current, data.definition, data);
          if (
            data.definition === 'play_finished' ||
            data.definition === 'publish_finished'
          ) {
            closePeerConnection(data.streamId);
          }
          break;
        case 'streamInformation':
          if (adaptorRef.current)
            callback.call(adaptorRef.current, data.command, data);
          break;
        case 'pong':
          if (adaptorRef.current)
            callback.call(adaptorRef.current, data.command);
          break;
        default:
          break;
      }
    };
    ws.onerror = error => {
      setConnected(false);
      clearInterval(pingTimerId);
      if (callbackError) callbackError('Error on connect', error);
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingTimerId);
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      clearInterval(pingTimerId);
      setConnected(false);
    };
  }, [url]);

  useEffect(() => {
    adaptorRef.current = {
      publish,
      joinRoom,
      leaveFromRoom,
      join,
      leave,
      play,
      stop,
      localStream,
      remoteStreams,
      getUserMedia,
      getStreamInfo,
      signallingState,
      initPeerConnection,
      handleTurnVolume,
      handleTurnCamera,
      isTurnedOf,
      isMuted,
      peerMessage,
      sendData,
      // closePeerConnection
    };
  }, [connected]);

  return !connected
    ? null
    : ({
        publish,
        joinRoom,
        leaveFromRoom,
        join,
        leave,
        play,
        stop,
        localStream,
        remoteStreams,
        getUserMedia,
        getStreamInfo,
        signallingState,
        initPeerConnection,
        handleTurnVolume,
        handleTurnCamera,
        isTurnedOf,
        isMuted,
        peerMessage,
        sendData,
        // closePeerConnection
      } as Adaptor);
}

export default useAntMedia;
