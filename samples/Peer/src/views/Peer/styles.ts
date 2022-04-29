import {RTCView} from 'react-native-webrtc';
import styled from 'styled-components/native';

export const Container = styled.View<{'is-playing': boolean}>`
  padding: ${(props) => (props['is-playing'] ? 0 : 20)}px;
  flex: 1;
  position: relative;
  height: 100%;
  background-color: #ffffff;
`;

export const InputView = styled.View`
  margin-bottom: 30px;
`;

export const Input = styled.TextInput`
  width: 100%;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #71579c;
  margin-top: 10px;
`;

export const Label = styled.Text``;

export const Text = styled.Text`
  color: #fff;
  font-size: 18px;
  text-align: center;
  text-transform: uppercase;
`;

export const Button = styled.TouchableOpacity`
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  background-color: #3275cb;
  margin-top: 16px;
  z-index: 3;
`;

export const RemoteView = styled(RTCView)`
  position: absolute;
  flex: 1;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: #32cdcd;
`;

export const LocalView = styled(RTCView)`
  width: 193px;
  height: 136px;
  position: absolute;
  bottom: 60px;
  right: 12px;
  z-index: 2;
  background: #cbb967;
  /* align-self: flex-end; */
  /* margin-top: auto; */
`;
