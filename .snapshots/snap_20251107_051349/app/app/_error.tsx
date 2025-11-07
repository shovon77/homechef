import { Text, View, ScrollView } from 'react-native';
export default function GlobalError({ error }: { error: any }) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow:1, alignItems:'center', justifyContent:'center', padding:16 }}>
      <View style={{ maxWidth: 720 }}>
        <Text style={{ fontSize:22, fontWeight:'bold', marginBottom:8 }}>😵 App crashed</Text>
        <Text selectable style={{ fontFamily: 'monospace', lineHeight:20 }}>
          {String(error && (error.stack || error.message || error))}
        </Text>
      </View>
    </ScrollView>
  );
}
