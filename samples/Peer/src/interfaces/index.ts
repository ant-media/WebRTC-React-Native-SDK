import {MutableRefObject} from 'react';
import {
  MediaStream,
  RTCOfferOptions,
  RTCIceCandidate,
  MediaStreamTrack,
  RTCPeerConnectionConfiguration,
  RTCPeerConnection,
  MediaStreamConstraints,
} from 'react-native-webrtc';

export interface Params {
  url: string;
  callback(this: Adaptor, message: string, data?: any): void;
  mediaConstraints: MediaStreamConstraints;
  sdp_constraints: RTCOfferOptions;
  onopen?: (data: any) => void;
  callbackError?: (errorMessage: string, data?: any) => void;
  peerconnection_config?: RTCPeerConnectionConfiguration;
  bandwidth?: number;
}

export type CustomWebSocket = WebSocket & {sendJson: (dt: any) => void};

export interface Socket {
  ws: null | CustomWebSocket;
}

export interface RemoteStreams {
  [key: string]: MediaStream[];
}

export interface RemotePeerConnection {
  [key: string]: RTCPeerConnection;
}

export interface RemoteDescriptionSet {
  [key: string]: boolean;
}

export interface RemotePeerConnectionStats {
  [key: string]: {timerId: number};
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

export interface Adaptor {
  publish: (streamId: string, token?: string) => void;
  joinRoom: (room: string, streamId?: string) => void;
  leaveFromRoom: (room: string) => void;
  join: (streamId: string) => void;
  leave: (streamId: string) => void;
  play: (streamId: string, token?: string, room?: string) => void;
  stop: (streamId: string) => void;
  localStream: MutableRefObject<MediaStream | null>;
  remoteStreams: RemoteStreams;
  getUserMedia: (mdC: MediaStreamConstraints) => Promise<void>;
  getStreamInfo: (streamId: string) => void;
  signallingState: (
    streamId: string,
  ) =>
    | 'stable'
    | 'have-local-offer'
    | 'have-remote-offer'
    | 'have-local-pranswer'
    | 'have-remote-pranswer'
    | 'closed'
    | null;
  initPeerConnection: (streamId: string) => Promise<void>;
  handleTurnVolume: () => void;
  handleTurnCamera: () => void;
  isTurnedOf: boolean;
  isMuted: boolean;
}
