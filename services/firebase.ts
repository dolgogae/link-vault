import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import analytics from '@react-native-firebase/analytics';

// React Native Firebase는 네이티브 설정 파일(GoogleService-Info.plist, google-services.json)을
// 통해 자동으로 초기화되므로 별도의 initializeApp 호출이 필요하지 않습니다.

export { firebase, auth, firestore, storage, analytics };
