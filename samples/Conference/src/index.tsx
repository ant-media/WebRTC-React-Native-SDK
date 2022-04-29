import React from 'react';
import {NativeRouter, Route} from 'react-router-native';
import styled from 'styled-components/native';

import Conference from './views/Conference';


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
          <Route exact path="/" component={Conference} />
          </Container>
      </NativeRouter>
    </SafeArea>
  );
};

export default src;
