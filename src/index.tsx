import React, {
  useCallback,
  useEffect,
  useRef,
  MutableRefObject,
} from 'react';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';

import 'react-native-url-polyfill/auto';

//Interfaces
export interface Params {
  url: string;
  mediaConstraints: any;
  callback(this: Adaptor, message: string, data?: any): void;
  callbackError?: (errorMessage: string, data?: any) => void;
  peer_connection_config?: any;
  debug?: boolean;
  onlyDataChannel?: boolean;
  playMode?: boolean;
}
export interface RemoteStreams {
  [key: string]: MediaStream;
}

export interface Adaptor {
  publish: (streamId: string, token?: string, subscriberId?:string , subscriberCode?: string, streamName?: string, mainTrack?:string, metaData?:string) => void;
  play: (streamId: string, token?: string, room?: string , enableTracks?: MediaStream[],subscriberId?:string , subscriberCode?: string,  metaData?:string) => void;
  stop: (streamId: string) => void;
  stopLocalStream: () => void;
  initialiseWebSocket: () => void;
  closeWebSocket: () => void;
  join: (streamId: string) => void;
  leave: (streamId: string) => void;
  getRoomInfo: (room: string, streamId?: string) => void;
  initPeerConnection: (
    streamId: string,
    dataChannelMode: 'publish' | 'play' | 'peer'
  ) => Promise<void>;
  localStream: MutableRefObject<MediaStream | null>;
  peerMessage: (streamId: string, definition: any, data: any) => void;
  sendData: (streamId: string, message: string) => void;
  muteLocalMic: () => void;
  unmuteLocalMic: () => void;
  setLocalMicVolume: (volume: number) => void;
  setRemoteAudioVolume: (volume: number, streamId: string, roomName: string|undefined) => void;
  muteRemoteAudio: (streamId: string, roomName: string|undefined) => void;
  unmuteRemoteAudio: (streamId: string, roomName: string|undefined) => void;
  turnOffLocalCamera: () => void;
  turnOnLocalCamera: () => void;
  turnOffRemoteCamera: () => void;
  turnOnRemoteCamera: () => void;
  switchCamera: () => void;
  getDevices: () => Promise<any>;
}
export interface RemotePeerConnection {
  [key: string]: RTCPeerConnection;
}
export interface RemotePeerConnectionStats {
  [key: string]: { timerId: number };
}

export interface RemoteDescriptionSet {
  [key: string]: boolean;
}
export interface IceCandidateList {
  [key: string]: RTCIceCandidate[];
}
export interface Sender {
  track: MediaStreamTrack;
  getParameters: () => {
    encodings?: any;
  };
  setParameters: (data: any) => Record<string, unknown>;
}
//useAntMedia main adaptor function
export function useAntMedia(params: Params) {

  const {
    url,
    mediaConstraints,
    callbackError,
    callback,
    peer_connection_config,
    debug,
    onlyDataChannel,
    playMode,
  } = params;

  var websocketUrl = url;

  const adaptorRef: any = useRef<null | Adaptor>(null);

  const isPlayMode = playMode || false;

  const updatedUrl = new URL(websocketUrl);
  if (!['origin', 'edge'].includes(updatedUrl.searchParams.get('target') ?? '')) {
    updatedUrl.searchParams.set('target', isPlayMode ? 'edge' : 'origin');
    websocketUrl = updatedUrl.toString();
  }

  const wsRef: any = useRef<null | WebSocket>(new WebSocket(websocketUrl));

  var ws = wsRef.current;

  let localStream: any = useRef(null);

  const remotePeerConnection = useRef<RemotePeerConnection>({}).current;
  const remotePeerConnectionStats = useRef<RemotePeerConnectionStats>(
    {}
  ).current;

  const remoteDescriptionSet = useRef<RemoteDescriptionSet>({}).current;
  const iceCandidateList = useRef<IceCandidateList>({}).current;

  const config: any = peer_connection_config;

  const playStreamIds = useRef<string[]>([]).current;

  var pingTimer: any = -1;

  var idMapping = new Array();

  const closePeerConnection = useCallback(
    (streamId: string) => {
      if (debug) console.log('closePeerConnection');

      var peerConnection: RTCPeerConnection = remotePeerConnection[streamId];

      if (peerConnection != null) {
        delete remotePeerConnection[streamId];

        // @ts-ignore
        if (peerConnection.dataChannel != null) {
          // @ts-ignore
          peerConnection.dataChannel.close();
        }
        if (peerConnection.signalingState !== 'closed') {
          peerConnection.close();
        }
        const playStreamIndex = playStreamIds.indexOf(streamId);

        if (playStreamIndex !== -1) {
          playStreamIds.splice(playStreamIndex, 1);
        }
      }

      if (remotePeerConnectionStats[streamId] != null) {
        clearInterval(remotePeerConnectionStats[streamId].timerId);
        delete remotePeerConnectionStats[streamId];
      }

      clearPingTimer();
    },
    [playStreamIds, remotePeerConnection, remotePeerConnectionStats]
  );

  const iceCandidateReceived = useCallback(
    (event: any, streamId: string) => {
      if (event.candidate) {
        const jsCmd = {
          command: 'takeCandidate',
          streamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        };

        if (ws) ws.sendJson(jsCmd);
      }
    },
    [ws]
  );

  const onTrack = useCallback(
    (event: any, streamId: any) => {
        const dataObj = {
          stream: event.streams[0],
          track: event.track,
          streamId: streamId,
          trackId: idMapping[streamId] != undefined? idMapping[streamId][event.transceiver.mid]:undefined,
        }
        if (adaptorRef.current) {
          callback.call(adaptorRef.current, 'newStreamAvailable', dataObj);
          callback.call(adaptorRef.current, 'newTrackAvailable', dataObj);
        }
    },
    [callback]
  );

  const initDataChannel = useCallback((streamId: string, dataChannel: any) => {
    dataChannel.onerror = (error: any) => {
      console.log('Data Channel Error:', error);
      const obj = {
        streamId: streamId,
        error: error,
      };
      console.log('channel status: ', dataChannel.readyState);
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
      console.log('Data channel is opened');
      if (callback && adaptorRef.current)
        callback.call(adaptorRef.current, 'data_channel_opened', streamId);
    };

    dataChannel.onclose = () => {
      console.log('Data channel is closed');
      if (callback && adaptorRef.current)
        callback.call(adaptorRef.current, 'data_channel_closed', streamId);
    };
  }, []);

  const initPeerConnection = useCallback(
    async (streamId: string, dataChannelMode: 'publish' | 'play' | 'peer') => {
      if (debug) console.log('in initPeerConnection');

      if (remotePeerConnection[streamId] == null) {
        const closedStreamId = streamId;
        remotePeerConnection[streamId] = new RTCPeerConnection(config || { iceServers: [] });
        remoteDescriptionSet[streamId] = false;
        iceCandidateList[streamId] = [];

        if (!playStreamIds.includes(streamId) && localStream.current) {
          // @ts-ignore
          localStream.current.getTracks().forEach((track) => {
            remotePeerConnection[streamId].addTrack(track, localStream.current);
//            localStream.current.getTracks().forEach((track: MediaStreamTrack) => { remotePeerConnection[streamId].addTrack(track, localStream.current); });
          });

        }

        try {
          // @ts-ignore
          remotePeerConnection[streamId].onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (debug) console.log('onicecandidate', event);
            iceCandidateReceived(event, closedStreamId);
          };
          // @ts-ignore
          remotePeerConnection[streamId].ontrack = (event: any) => {
            if (debug) console.log('onTrack', event);
            onTrack(event, closedStreamId);
          };

          // @ts-ignore
          remotePeerConnection[streamId].ondatachannel = (event: RTCDataChannelEvent) => {
            initDataChannel(streamId, event.channel);
          };

          if (dataChannelMode === 'publish') {
            const dataChannelOptions = {
              ordered: true,
            };
            const dataChannelPeer = remotePeerConnection[streamId].createDataChannel(streamId, dataChannelOptions);
            initDataChannel(streamId, dataChannelPeer);
          } else if (dataChannelMode === 'play') {
            // @ts-ignore
            remotePeerConnection[streamId].ondatachannel = (event: RTCDataChannelEvent) => {
              initDataChannel(streamId, event.channel);
            };
          } else {
            const dataChannelOptions = {
              ordered: true,
            };
            const dataChannelPeer = remotePeerConnection[streamId].createDataChannel(streamId, dataChannelOptions);
            initDataChannel(streamId, dataChannelPeer);
            // @ts-ignore
            remotePeerConnection[streamId].ondatachannel = (event: RTCDataChannelEvent) => {
              initDataChannel(streamId, event.channel);
            };
          }
        } catch (err: any) {
          if (debug) console.error('initPeerConnectionError', err.message);
        }
      }
    },
    [
      config,
      debug,
      iceCandidateList,
      iceCandidateReceived,
      onTrack,
      playStreamIds,
      remoteDescriptionSet,
      remotePeerConnection,
    ]
  );

  const gotDescription = useCallback(
    async (configuration: any, streamId: string) => {
      try {
        if (debug) console.log('in gotDescription');

        // const response =
        await remotePeerConnection[streamId].setLocalDescription(configuration);

        const jsCmd = {
          command: 'takeConfiguration',
          streamId,
          type: configuration.type,
          sdp: configuration.sdp,
        };

        if (ws) ws.sendJson(jsCmd);
      } catch (err: any) {
        if (debug) console.log('gotDescriptionError', err);
      }
    },
    [debug, remotePeerConnection, ws]
  );

  const startPublishing = useCallback(
    async (streamId: string) => {
      try {
        if (debug) console.log('in start publishing');

        await initPeerConnection(streamId, 'publish');
        const configuration = await remotePeerConnection[streamId].createOffer(
          config
        );
        await gotDescription(configuration, streamId);
      } catch (err: any) {
        if (debug) console.log('startPublishing error', err.message, err.stack);
      }
    },
    [config, debug, gotDescription, initPeerConnection, remotePeerConnection]
  );

  const addIceCandidate = useCallback(
    async (streamId: string, candidate: any) => {
      try {
        if (debug) console.log('in addIceCandidate');
        if (debug) console.debug(`addIceCandidate ${streamId}`);
        if (debug) console.debug('candidate', candidate);
        await remotePeerConnection[streamId].addIceCandidate(candidate);
      } catch (err) {}
    },
    [debug, remotePeerConnection]
  );

  const takeConfiguration = useCallback(
    async (streamId: any, configuration: string, typeOfConfiguration: string , idMap?:string) => {
      const type = typeOfConfiguration;
      var conf = configuration;
      conf = conf.replace("a=extmap:13 urn:3gpp:video-orientation\r\n", "");
      const isTypeOffer = type === 'offer';
      idMapping[streamId] = idMap;

      if (debug) console.log('in takeConfiguration');
      let dataChannelMode: 'publish' | 'play' = 'publish';
      if (isTypeOffer) {
        dataChannelMode = 'play';
      }
      await initPeerConnection(streamId, dataChannelMode);
      try {
        await remotePeerConnection[streamId].setRemoteDescription(
          new RTCSessionDescription({
            sdp: conf,
            type,
          })
        );
        remoteDescriptionSet[streamId] = true;
        const { length } = Object.keys(iceCandidateList[streamId]);
        for (let i = 0; i < length; i++) {
          await addIceCandidate(streamId, iceCandidateList[streamId][i]);
        }
        iceCandidateList[streamId] = [];
        if (isTypeOffer) {
          const configur = await remotePeerConnection[streamId].createAnswer(

          );
          await gotDescription(configur, streamId);
        }
      } catch (error: any) {
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
    [
      addIceCandidate,
      callbackError,
      debug,
      gotDescription,
      iceCandidateList,
      initPeerConnection,
      remoteDescriptionSet,
      remotePeerConnection,
    ]
  );

  const takeCandidate = useCallback(
    // @ts-ignore
    async (idOfTheStream: string, tmpLabel, tmpCandidate, sdpMid) => {
      if (debug) console.log('in takeCandidate');

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
            'Ice candidate is added to list because remote description is not set yet'
          );
        const index = iceCandidateList[streamId].findIndex(
          (i) => JSON.stringify(i) === JSON.stringify(candidate)
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
    [
      addIceCandidate,
      debug,
      iceCandidateList,
      initPeerConnection,
      remoteDescriptionSet,
    ]
  );

  const setWebSocketListeners = useCallback(() => {
        if (!ws) return;
        ws.sendJson = (dt: any) => {
          if (ws && ws.send && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(dt));
          }
        };

        ws.onopen = () => {
          if (debug) console.log('web socket opened !');
          callback.call(adaptorRef.current, 'initiated');
          // connection opened

          getDevices();

          if (!onlyDataChannel && !isPlayMode) {
            mediaDevices.getUserMedia(mediaConstraints)
              .then((stream: any) => {
                // Got stream!
                if (debug) console.log('got stream');

                localStream.current = stream;
                if (adaptorRef.current) callback.call(adaptorRef.current, 'local_stream_updated', stream);
                if (debug) console.log('in stream', localStream.current);
              })
              .catch((error: any) => {
                // Log error
                if (debug) console.log('got error', error , mediaConstraints);
              });
          } else {
            if (debug) console.log('only data channel or play only');
          }
          setPingTimer();
        };

        ws.onmessage = (e: any) => {
          // a message was received
          const data = JSON.parse(e.data);
          if (debug) console.log(' onmessage', data);

          switch (data.command) {
            case 'start':
              // start  publishing
              startPublishing(data.streamId);
              break;
            case 'takeCandidate':
              //console.log(' in takeCandidate', data);
              takeCandidate(data.streamId, data.label, data.candidate, data.id);
              break;
            case 'takeConfiguration':
              takeConfiguration(data.streamId, data.sdp, data.type,data.idMapping);
              break;
            case 'stop':
              if (debug) console.log(' in stop', data);
              closePeerConnection(data.streamId);
              break;
            case 'error':
              if (debug) console.log(' in error', data);
              if (callbackError) {
                callbackError(data.definition, data);
              }
              break;
            case 'notification':
              if (debug) console.log(' in notification', data);

              if (adaptorRef.current)
                callback.call(adaptorRef.current, data.definition, data);
              break;
            case 'roomInformation':
              if (debug) console.log(' in roomInformation', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
            case 'pong':
              if (debug) console.log(' in pong', data);
              break;
            case 'streamInformation':
              if (debug) console.log(' in streamInformation', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
            case 'trackList':
              if (debug) console.log(' in trackList', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
            case 'connectWithNewId':
              if (debug) console.log(' in connectWithNewId', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
            case 'peerMessageCommand':
              if (debug) console.log(' in peerMessageCommand', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
            default:
              if (debug) console.log(' in default', data);
              callback.call(adaptorRef.current, data.command, data);
              break;
          }
        };

        ws.onerror = (e: any) => {
          // an error occurred
          clearPingTimer();
          if (debug) console.log(e.message);
        };

        ws.onclose = (e: any) => {
          // connection closed
          clearPingTimer();
          if (debug) console.log(e.code, e.reason);
          if (callback && adaptorRef.current) callback.call(adaptorRef.current, 'websocket_closed', '' );
          ws = null;
        };
  }, [callback, callbackError, closePeerConnection, debug, mediaConstraints, startPublishing, takeCandidate, takeConfiguration, ws]);

  useEffect(() => {
    setWebSocketListeners();
    }, [
    callback,
    callbackError,
    closePeerConnection,
    config,
    debug,
    mediaConstraints,
    startPublishing,
    takeCandidate,
    takeConfiguration,
    ws,
  ]);

  const publish = useCallback(
    (
      streamId: string,
      token?: string,
      subscriberId?: string,
      subscriberCode?: string,
      streamName?: string,
      mainTrack?:string,
      metaData?:string
    ) => {
      if (ws && ws.readyState === ws.CLOSED) {
        if (debug) console.log('WebSocket is not connected');
        if (adaptorRef.current) callback.call(adaptorRef.current, 'websocket_not_initialized', '');
      }

      if (localStream.current === null) {
        if (debug) console.log('Local stream is not ready');
        return;
      }

      let data = {} as any;
      if (onlyDataChannel) {
        data = {
          command: 'publish',
          streamId: streamId,
          token: token,
          subscriberId: typeof subscriberId !== undefined ? subscriberId : '',
          subscriberCode: typeof subscriberCode !== undefined ? subscriberCode : '',
          video: false,
          audio: false,
        };
      } else {

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
          subscriberCode: typeof subscriberCode !== undefined ? subscriberCode : '',
          streamName,
          mainTrack,
          video,
          audio,
          metaData
        };
      }

      if (ws) ws.sendJson(data);
    },
    [ws]
  );

  //play
  const play = useCallback(
    (streamId: string, token?: string, room?: string , enableTracks?:MediaStreamTrack[],subscriberId?:string, subscriberCode?:string ,metaData?:string ) => {
      if (ws && ws.readyState === ws.CLOSED) {
        if (debug) console.log('WebSocket is not connected');
        if (adaptorRef.current) callback.call(adaptorRef.current, 'websocket_not_initialized', '');
      }

      playStreamIds.push(streamId);
      const data = {
        command: 'play',
        streamId,
        token,
        room,
        enableTracks,
        subscriberId: typeof subscriberId !== undefined ? subscriberId : '',
        subscriberCode: typeof subscriberCode !== undefined ? subscriberCode : '',
        viewerInfo: typeof metaData !== undefined && metaData != null ? metaData : ""
      };

      if (token) {
        data.token = token;
      }

      if (ws) ws.sendJson(data);
    },
    [playStreamIds, ws]
  );

  const stopLocalStream = useCallback(
    () => {
      if (localStream.current) {
        // @ts-ignore
        localStream.current.getTracks().forEach((track) => {
          track.stop();
        });
        localStream.current = null;
      }
    },
    [localStream]
  );

  const initialiseWebSocket = useCallback(() => {
    console.log('initialising websocket')
    if (ws && ws.readyState === ws.OPEN) {
      if (debug) console.log('WebSocket is already connected');
      return;
    }

    const updatedUrl: URL = new URL(websocketUrl);
    if (!['origin', 'edge'].includes(updatedUrl.searchParams.get('target') ?? '')) {
      updatedUrl.searchParams.set('target', isPlayMode ? 'edge' : 'origin');
      websocketUrl = updatedUrl.toString();
    }

    wsRef.current = new WebSocket(websocketUrl);
    ws = wsRef.current;
    setWebSocketListeners();
    console.log('WebSocket is connected');
  }, [ws]);

  const closeWebSocket = useCallback(() => {
    if (ws) {
      ws.close();
    }
  }, [ws]);

  const stop = useCallback(
    (streamId: any) => {
      closePeerConnection(streamId);

      const data = {
        command: 'stop',
        streamId: streamId,
      };
      if (ws) ws.sendJson(data);
    },
    [ws]
  );

  const join = useCallback(
    (streamId: string) => {
      const data = {
        command: 'join',
        streamId,
      };
      if (ws) ws.sendJson(data);
    },
    [ws]
  );

  const leave = useCallback(
    (streamId: string) => {
      const data = {
        command: 'leave',
        streamId,
      };
      if (ws) ws.sendJson(data);
    },
    [ws]
  );

  const muteLocalMic = useCallback(() => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }, [localStream]);

  const unmuteLocalMic = useCallback(() => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }, [localStream]);

  const setLocalMicVolume = useCallback((volume: number) => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getAudioTracks().forEach((track) => {
        track._setVolume(volume);
      });
    }
  }, [localStream]);

  const setRemoteAudioVolume = useCallback((volume: number, streamId: string, roomName: string|undefined) => {
    console.log("Setting remote mic")
    // @ts-ignore
    if (typeof roomName != 'undefined' && remotePeerConnection[roomName]) {
      remotePeerConnection[roomName]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track._setVolume(volume);
        }
      });
    } else if(remotePeerConnection[streamId]) {
      remotePeerConnection[streamId]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track._setVolume(volume);
        }
      });
    }
  }, [remotePeerConnection]);

  const muteRemoteAudio = useCallback((streamId: string, roomName: string|undefined) => {
    console.log("Muting remote mic")
    // @ts-ignore
    if (typeof roomName != 'undefined' && remotePeerConnection[roomName]) {
      remotePeerConnection[roomName]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track.enabled = false;
        }
      });
    } else if(remotePeerConnection[streamId]) {
      remotePeerConnection[streamId]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track.enabled = false;
        }
      });
    }
  }, [remotePeerConnection]);

  const unmuteRemoteAudio = useCallback((streamId: string, roomName: string|undefined) => {
    console.log("Muting remote mic")
    // @ts-ignore
    if (typeof roomName != 'undefined' && remotePeerConnection[roomName]) {
      remotePeerConnection[roomName]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track.enabled = true;
        }
      });
    } else if(remotePeerConnection[streamId]) {
      remotePeerConnection[streamId]._remoteStreams.forEach((stream) => {
        let audioTrackID = "ARDAMSa" + streamId;
        let track = stream.getTrackById(audioTrackID);
        if (track) {
          track.enabled = true;
        }
      });
    }
  }, [remotePeerConnection]);

  const getRoomInfo = useCallback(
    (room: string, streamId?: string) => {
      var data = {
        command: 'getRoomInfo',
        streamId,
        room,
      };
      if (ws) ws.sendJson(data);
    },
    [ws]
  );
  const setPingTimer = useCallback(() => {
    pingTimer = setInterval(()=>{
      if(ws != null)
      ws.sendJson({
        command: 'ping',
      });
    },3000);
  },[]);

  const clearPingTimer = useCallback(() => {
    if (pingTimer != -1) {
      if (debug) {
          console.log("Clearing ping message timer");
      }
      clearInterval(pingTimer);
      pingTimer = -1;
    }
  },[]);

  //Data Channel
  const peerMessage = useCallback(
    (streamId: string, definition: any, data: any) => {
      const jsCmd = {
        command: 'peerMessageCommand',
        streamId: streamId,
        definition: definition,
        data: data,
      };
      if (ws) ws.sendJson(jsCmd);
    },
    [ws]
  );

  const getDevices = useCallback( async () => {
    var deviceArray = new Array();

    try {
      const devices = await mediaDevices.enumerateDevices();
      // @ts-ignore
      devices.map( device => {
        deviceArray.push(device);
      } );

      callback.call(adaptorRef.current, 'available_devices', deviceArray);
    } catch (err: any) {
      console.log("Cannot get devices -> error: " + err);
    }
    // @ts-ignore
    mediaDevices.ondevicechange = async () => {
      console.log("Device change event")
      getDevices();
    };

    return deviceArray;

  }, [callback]);

  const sendData = useCallback(
    (streamId: string, message: string) => {
      // @ts-ignore
      const dataChannel = remotePeerConnection[streamId].dataChannel;
      dataChannel.send(message);
      if (debug) console.log(' send message in server', message);
    },
    [ws]
  );

  const turnOffLocalCamera = useCallback(() => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }, []);

  const turnOnLocalCamera = useCallback(() => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }, []);

  const turnOffRemoteCamera = useCallback((streamId: string, roomName: string|undefined) => {
    console.log("Turning off remote camera")
    // @ts-ignore
    if (typeof roomName != 'undefined' && remotePeerConnection[roomName]) {
      remotePeerConnection[roomName]._remoteStreams.forEach((stream) => {
        let videoTrackID = "ARDAMSv" + streamId;
        let track = stream.getTrackById(videoTrackID);
        if (track) {
          track.enabled = false;
        }
      });
    } else if(remotePeerConnection[streamId]) {
      remotePeerConnection[streamId]._remoteStreams.forEach((stream) => {
        let videoTrackID = "ARDAMSv" + streamId;
        let track = stream.getTrackById(videoTrackID);
        if (track) {
          track.enabled = false;
        }
      });
    }
  }, [remotePeerConnection]);

  const turnOnRemoteCamera = useCallback((streamId: string, roomName: string|undefined) => {
    console.log("Turning on remote camera")
    // @ts-ignore
    if (typeof roomName != 'undefined' && remotePeerConnection[roomName]) {
      remotePeerConnection[roomName]._remoteStreams.forEach((stream) => {
        let videoTrackID = "ARDAMSv" + streamId;
        let track = stream.getTrackById(videoTrackID);
        if (track) {
          track.enabled = true;
        }
      });
    } else if(remotePeerConnection[streamId]) {
      remotePeerConnection[streamId]._remoteStreams.forEach((stream) => {
        let videoTrackID = "ARDAMSv" + streamId;
        let track = stream.getTrackById(videoTrackID);
        if (track) {
          track.enabled = true;
        }
      });
    }
  }, [remotePeerConnection]);

  const switchCamera = useCallback(() => {
    if (localStream.current) {
      // @ts-ignore
      localStream.current.getVideoTracks().forEach((track) => {
        track._switchCamera();
      });
    }
  }, [localStream]);

  //adaptor ref
  useEffect(() => {
    adaptorRef.current = {
      publish,
      play,
      stop,
      stopLocalStream,
      initialiseWebSocket,
      closeWebSocket,
      join,
      leave,
      getRoomInfo,
      initPeerConnection,
      localStream,
      peerMessage,
      sendData,
      muteLocalMic,
      unmuteLocalMic,
      setLocalMicVolume,
      setRemoteAudioVolume,
      muteRemoteAudio,
      unmuteRemoteAudio,
      turnOffLocalCamera,
      turnOnLocalCamera,
      turnOffRemoteCamera,
      turnOnRemoteCamera,
      switchCamera,
      getDevices,
    };
  }, [
    publish,
    play,
    stop,
    stopLocalStream,
    initialiseWebSocket,
    closeWebSocket,
    localStream,
    join,
    leave,
    getRoomInfo,
    initPeerConnection,
    peerMessage,
    sendData,
    muteLocalMic,
    unmuteLocalMic,
    setLocalMicVolume,
    setRemoteAudioVolume,
    muteRemoteAudio,
    unmuteRemoteAudio,
    turnOffLocalCamera,
    turnOnLocalCamera,
    turnOffRemoteCamera,
    turnOnRemoteCamera,
    switchCamera,
    getDevices,
  ]);

  return {
    publish,
    play,
    stop,
    stopLocalStream,
    initialiseWebSocket,
    closeWebSocket,
    localStream,
    join,
    leave,
    getRoomInfo,
    initPeerConnection,
    peerMessage,
    sendData,
    setLocalMicVolume,
    setRemoteAudioVolume,
    muteLocalMic,
    unmuteLocalMic,
    muteRemoteAudio,
    unmuteRemoteAudio,
    turnOffLocalCamera,
    turnOnLocalCamera,
    turnOffRemoteCamera,
    turnOnRemoteCamera,
    switchCamera,
    getDevices,
  } as Adaptor;
} // useAntmedia fn end

export function rtc_view(
  stream: any,
  customStyles: any = { width: '70%', height: '50%', alignSelf: 'center' },
  objectFit: any = 'cover'
) {
  if(stream instanceof MediaStreamTrack ){
    let mediaStream = new MediaStream(undefined);
    mediaStream.addTrack(stream);
    stream = mediaStream.toURL();
  }
  const props = {
    streamURL: stream,
    style: customStyles,
    objectFit: objectFit,
  };

  // @ts-ignore
  return <RTCView {...props} />;
}
