// URL polyfill must load before @supabase/supabase-js is used anywhere.
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
