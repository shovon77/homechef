import { View, Text, Linking } from 'react-native';
export default function Alive() {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:10 }}>
      <Text style={{ fontSize:24 }}>✅ Router is alive</Text>
      <Text onPress={()=>Linking.openURL('/auth')} style={{ textDecorationLine:'underline' }}>/auth</Text>
      <Text onPress={()=>Linking.openURL('/')} style={{ textDecorationLine:'underline' }}>/ (home)</Text>
    </View>
  );
}
