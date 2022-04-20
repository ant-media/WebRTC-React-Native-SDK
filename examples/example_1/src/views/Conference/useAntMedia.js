import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';

function useAntMedia(params) {
  const {
    url,
    onopen,
    callbackError,
    callback,
    mediaConstraints,
    sdp_constraints,
    peerconnection_config,
    bandwidth: bwh,
  } = params;
  const [roomName, setRoomName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isTurnedOf, setIsTurnedOf] = useState(false);
  const [isPlayMode, setIsPlayMode] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connected, setConnected] = useState(false);
  const localStream = useRef(null);
  const socket = useRef({
    ws: null,
  }).current;
  const playStreamIds = useRef([]).current;
  const remotePeerConnection = useRef({}).current;
  const remotePeerConnectionStats = useRef({}).current;
  const remoteDescriptionSet = useRef({}).current;
  const iceCandidateList = useRef({}).current;
  const bandwidth = useRef({ value: bwh || 900 }).current;

  const adaptorRef = useRef(null);

  const closePeerConnection = useCallback(
    (streamId) => {
      if (
        remotePeerConnection[streamId] != null &&
        remotePeerConnection[streamId].signalingState !== 'closed'
      ) {
        remotePeerConnection[streamId].close();

        // @ts-ignore;
        remotePeerConnection[streamId] = null;

        delete remotePeerConnection[streamId];
        const playStreamIndex = playStreamIds.indexOf(streamId);
        setRemoteStreams((sm) => {
          const obj = { ...sm };
          delete obj[streamId];
          return obj;
        });
        if (playStreamIndex !== -1) {
          playStreamIds.splice(playStreamIndex, 1);
        }
      }

      if (remotePeerConnectionStats[streamId] != null) {
        clearInterval(remotePeerConnectionStats[streamId].timerId);
        delete remotePeerConnectionStats[streamId];
      }
    },
    [playStreamIds, remotePeerConnection, remotePeerConnectionStats],
  );

  const getVideoSender = useCallback(
    (streamId) => {
      console.log('getVideoSender');
      let videoSender = null;
      const senders = [];

      const rmS = remotePeerConnection[streamId].getRemoteStreams();

      setRemoteStreams((rm) => {
        const obj = { ...rm };
        obj[streamId] = rmS;
        return obj;
      });

      rmS.forEach((i) => {
        i.getTracks().forEach((track) => {
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
    },
    [remotePeerConnection],
  );

  const changeBandwidth = useCallback(
    async (bw, streamId) => {
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

      return true;
    },
    [getVideoSender],
  );

  const iceCandidateReceived = useCallback(
    (event, streamId) => {
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
    [socket.ws],
  );

  const onTrack = useCallback(
    (event, streamId) => {
      if (!remoteStreams[streamId]) {
        setRemoteStreams((dt) => {
          dt[streamId] = event.streams[0];
          return dt;
        });
        const dataObj = {
          track: event.streams[0],
          streamId,
        };
        if (adaptorRef.current)
          callback.call(adaptorRef.current, 'newStreamAvailable', dataObj);
      }
    },
    [remoteStreams, callback],
  );

  const initPeerConnection = useCallback(
    async (streamId) => {
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
          remotePeerConnection[streamId].onicecandidate = (event) => {
            iceCandidateReceived(event, closedStreamId);
          };
          console.log('came to on track listener atleast', streamId);
          // @ts-ignore
          remotePeerConnection[streamId].ontrack = (event) => {
            console.log('onTrack', event);
            onTrack(event, closedStreamId);
          };
          if (!isPlayMode) {
            remotePeerConnection[streamId].oniceconnectionstatechange = (
              event,
            ) => {
              if (event.target.iceConnectionState === 'connected') {
                (async () => {
                  try {
                    await changeBandwidth(bandwidth.value, streamId);
                  } catch (e) {
                    console.error(e);
                  }
                })();
              }
            };
          }
        } catch (err) {
          console.log('initPeerConnectionError', err.message);
        }
      }
    },
    [
      isPlayMode,
      localStream,
      bandwidth.value,
      changeBandwidth,
      iceCandidateList,
      onTrack,
      iceCandidateReceived,
      peerconnection_config,
      playStreamIds,
      remoteDescriptionSet,
      remotePeerConnection,
    ],
  );

  const gotDescription = useCallback(
    async (configuration, streamId) => {
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
        console.log('gotDescriptionError', err);
      }
    },
    [socket.ws, remotePeerConnection],
  );

  const startPublishing = useCallback(
    async (streamId) => {
      try {
        await initPeerConnection(streamId);
        const configuration = await remotePeerConnection[streamId].createOffer(
          sdp_constraints,
        );
        await gotDescription(configuration, streamId);
      } catch (err) {
        console.log('startPublishing error', err.message, err.stack);
      }
    },
    [initPeerConnection, gotDescription, remotePeerConnection, sdp_constraints],
  );

  const getUserMedia = useCallback(async (mdC) => {
    const stream = await mediaDevices.getUserMedia(mdC);
    if (typeof stream !== 'boolean') localStream.current = stream;
  }, []);

  const publish = useCallback(
    (streamId, token) => {
      if (!localStream.current) return;
      const data = {
        command: 'publish',
        streamId,
        token,
        video: localStream.current.getVideoTracks().length > 0,
        audio: localStream.current.getAudioTracks().length > 0,
      };

      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const getRoomInfo = useCallback(
    (room, streamId) => {
      var data = {
        command: 'getRoomInfo',
        streamId,
        room,
      };
      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const joinRoom = useCallback(
    (room, streamId) => {
      const data = {
        command: 'joinRoom',
        room,
        streamId,
      };
      setRoomName(room);

      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const leaveFromRoom = useCallback(
    (room) => {
      const data = {
        command: 'leaveFromRoom',
        room,
      };
      setRoomName(room);
      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const join = useCallback(
    (streamId) => {
      const data = {
        command: 'join',
        streamId,
      };
      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const leave = useCallback(
    (streamId) => {
      const data = {
        command: 'leave',
        streamId,
      };
      if (socket.ws) socket.ws.sendJson(data);
    },
    [socket.ws],
  );

  const play = useCallback(
    (streamId, token, room) => {
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
    [playStreamIds, socket.ws],
  );

  const stop = useCallback(
    (streamId) => {
      const data = {
        command: 'stop',
        streamId,
      };

      if (socket.ws) socket.ws.sendJson(data);
      setIsPlayMode(false);
    },
    [socket.ws],
  );

  const handleTurnVolume = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    } else {
      if (callbackError) callbackError('NoActiveConnection');
    }
  }, [callbackError]);

  const handleTurnCamera = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      track.enabled = !track.enabled;
      setIsTurnedOf(!track.enabled);
    } else {
      if (callbackError) callbackError('NoActiveConnection');
    }
  }, [callbackError]);

  const switchCamera = useCallback(async () => {
    if (localStream.current) {
      localStream.current.getVideoTracks()[0]._switchCamera();
    } else {
      if (callbackError) callbackError('NoActiveConnection');
    }
  }, [callbackError, remoteStreams, localStream]);

  const getStreamInfo = useCallback(
    (streamId) => {
      const jsCmd = {
        command: 'getStreamInfo',
        streamId,
      };
      if (socket.ws) socket.ws.sendJson(jsCmd);
    },
    [socket.ws],
  );

  const addIceCandidate = useCallback(
    async (streamId, candidate) => {
      try {
        console.debug(`addIceCandidate ${streamId}`);
        await remotePeerConnection[streamId].addIceCandidate(candidate);
      } catch (err) { }
    },
    [remotePeerConnection],
  );

  const takeConfiguration = useCallback(
    async (idOfStream, configuration, typeOfConfiguration) => {
      console.log('take configuration function called');
      const streamId = idOfStream;
      const type = typeOfConfiguration;
      const conf = configuration;

      await initPeerConnection(streamId);
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

        if (type === 'offer') {
          const configur = await remotePeerConnection[streamId].createAnswer(
            sdp_constraints,
          );
          await gotDescription(configur, streamId);
        }
      } catch (error) { }
    },
    [
      addIceCandidate,
      gotDescription,
      remotePeerConnection,
      iceCandidateList,
      initPeerConnection,
      sdp_constraints,
      remoteDescriptionSet,
    ],
  );

  const takeCandidate = useCallback(
    async (idOfTheStream, tmpLabel, tmpCandidate, sdpMid) => {
      const streamId = idOfTheStream;
      const label = tmpLabel;
      const candidateSdp = tmpCandidate;

      const candidate = new RTCIceCandidate({
        sdpMLineIndex: label,
        candidate: candidateSdp,
        sdpMid,
      });

      await initPeerConnection(streamId);

      if (remoteDescriptionSet[streamId] === true) {
        await addIceCandidate(streamId, candidate);
      } else {
        console.debug(
          'Ice candidate is added to list because remote description is not set yet',
        );
        const index = iceCandidateList[streamId].findIndex(
          (i) => JSON.stringify(i) === JSON.stringify(candidate),
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
      iceCandidateList,
      initPeerConnection,
      remoteDescriptionSet,
    ],
  );

  const signallingState = useCallback(
    (streamId) => {
      if (remotePeerConnection[streamId] != null) {
        return remotePeerConnection[streamId].signalingState;
      }
      return null;
    },
    [remotePeerConnection],
  );

  const init = useCallback(async () => {
    if (
      !isPlayMode &&
      typeof mediaConstraints !== 'undefined' &&
      localStream.current == null
    ) {
      await getUserMedia(mediaConstraints);
    }
  }, [isPlayMode, getUserMedia, mediaConstraints]);

  useEffect(() => {
    const ws = new WebSocket(url);
    let pingTimerId = -1;

    ws.onopen = (data) => {
      ws.sendJson = (dt) => {
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
        .catch((err) => {
          if (callbackError) callbackError('initError', err);
        });
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      switch (data.command) {
        case 'start':
          startPublishing(data.streamId);
          break;
        case 'takeCandidate':
          console.log('take candidate');
          takeCandidate(data.streamId, data.label, data.candidate, data.id);
          break;
        case 'takeConfiguration':
          takeConfiguration(data.streamId, data.sdp, data.type);
          break;
        case 'stop':
          console.log('stop came?');
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
          callback.call(adaptorRef.current, data.command, data);

          break;
      }
    };
    ws.onerror = (error) => {
      setConnected(false);
      clearInterval(pingTimerId);
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
      getRoomInfo,
      switchCamera,
      // closePeerConnection
    };
  }, [connected, localStream, remoteStreams, isTurnedOf, isMuted]);

  return !connected
    ? null
    : {
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
      getRoomInfo,
      switchCamera,
      // closePeerConnection
    };
}

export default useAntMedia;
