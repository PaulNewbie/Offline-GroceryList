import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getOfflineItems } from '../utils/database';

export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const isFocused = useIsFocused(); // Re-fetches data whenever you navigate to this screen

  useEffect(() => {
    if (isFocused) {
      (async () => {
        const dbItems = await getOfflineItems();
        setItems(dbItems);
      })();
    }
  }, [isFocused]);

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Text style={styles.productName}>{item.product}</Text>
      <Text style={styles.productPrice}>{item.price}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your list is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  listContainer: { padding: 15 },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  productPrice: { color: '#00FF00', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 },
});