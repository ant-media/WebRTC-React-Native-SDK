import styled from 'styled-components/native';

export const Container = styled.View`
  flex: 1;
  position: relative;
  height: 100%;
  background-color: #ffffff;
  padding: 30px;
`;


export const Button = styled.TouchableOpacity`
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  background-color: #3275cb;
  margin-top: 16px;
  align-items: center;
  z-index: 3;
  position: relative;
`;

export const Text = styled.Text`
  position: relative;
  color: #ffffff;
  font-size: 20px;
`;

export const TextContainer = styled.ScrollView`
  width: 100%;
  height: auto;
  flex: 1;
  margin-bottom:5px;
  background-color: #232323;
`;

export const InputView = styled.View`
  margin-bottom: 30px;
`;

export const Label = styled.Text`
  margin-bottom:5px;
`;

export const Input = styled.TextInput`
  width: 100%;
  height: 50px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  margin:0px;
`;
