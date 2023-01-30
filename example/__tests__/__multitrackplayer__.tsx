import * as React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';

import {render, cleanup, fireEvent} from 'react-native-testing-library';
import App from '../src/multitrackplayer';

afterEach(cleanup);

describe("convertToSLAs tests", () => {
  it(`renders correctly`, () => {
    //const tree = renderer.create(<App />).toJSON();
    //expect(tree.children.length).toBe(1);
  });
});
