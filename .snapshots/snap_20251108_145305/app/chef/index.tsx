import { Text, View } from 'react-native';
export default function ChefHome() {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize:22 }}>Chef Dashboard</Text>
      <Text>Signed-in chefs will see controls here.</Text>
    </View>
  );
}
