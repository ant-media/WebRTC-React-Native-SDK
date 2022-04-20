import React from 'react';
import {NativeRouter, Route} from 'react-router-native';
import styled from 'styled-components/native';

import Home from './views/Home';
import Publish from './views/Publish';
import Play from './views/Play';
import Peer from './views/Peer';
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
          <Route exact path="/" component={Home} />
          <Route exact path="/Publish" component={Publish} />
          <Route exact path="/Play" component={Play} />
          <Route exact path="/Peer" component={Peer} />
          <Route exact path="/Conference" component={Conference} />
        </Container>
      </NativeRouter>
    </SafeArea>
  );
};

export default src;
