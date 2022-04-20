import { StyleSheet } from 'react-native';

export default {
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    zIndex: 2,
  },
  joinBtn: {
    backgroundColor: 'blue',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  leaveBtn: {
    backgroundColor: 'red',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  btnTxt: {
    color: 'white',
    fontSize: 20,
  },
  txtInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    height: 60,
    padding: 10,
    marginBottom: 30,
    width: '80%',
    fontSize: 20,
  },
  formView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 40,
    marginBottom: 100,
    textAlign: 'center',
  },
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    height: 40,
    width: 80,
    backgroundColor: 'red',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
};
