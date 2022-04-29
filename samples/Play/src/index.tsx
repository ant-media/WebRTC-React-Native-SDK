import React from 'react';
import {NativeRouter, Route} from 'react-router-native';
import styled from 'styled-components/native';

import Play from './views/Play';


const SafeArea = styled.SafeAreaView`
  flex: 1;
`;

const Container = styled.SafeAreaView`
  flex: 1;
`;

const src: React.FC = () => {
  return (
    <SafeArea>
      <NativeRouter>
        <Container>
          <Route exact path="/" component={Play} />
          </Container>
      </NativeRouter>
    </SafeArea>
  );
};

export default src;
