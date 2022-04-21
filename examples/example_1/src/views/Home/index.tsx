import React, {useCallback, useEffect, useRef, useState} from 'react';

import {useAntMedia} from '@antmedia/react-native-ant-media';

import InCallManager from 'react-native-incall-manager';

import {Container, Input, Label, Text, Button} from './styles';

import {Link} from 'react-router-native';
import {View} from 'react-native';

const Home: React.FC = () => {
  return (
    <View>
      <Container>
        <Label children="Ant Media React Native Example" />

        <Button>
          <Link to="/Publish">
            <Text>Publish</Text>
          </Link>
        </Button>
        <Button>
          <Link to="/Play">
            <Text>Play</Text>
          </Link>
        </Button>
        <Button>
          <Link to="/Peer">
            <Text>Peer 2 Peer</Text>
          </Link>
        </Button>
        <Button>
          <Link to="/Conference">
            <Text>Conference</Text>
          </Link>
        </Button>
      </Container>
    </View>
  );
};

export default Home;
