import React, { memo } from 'react';
import { RTCView } from 'react-native-webrtc';
import PropTypes from 'prop-types';

const StreamView = memo((props) => {
  const { stream, ...rest } = props;
  return <RTCView style={styles.stream} objectFit="cover" streamURL={stream} {...rest} />;
});

const styles = {
  stream: {
    flex: 1,
  },
};

StreamView.propTypes = {
  stream: PropTypes.string,
};

export default StreamView;
