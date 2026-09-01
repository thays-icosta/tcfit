import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function FoodSubstituteScreen() {
  const [allFoods, setAllFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [grams, setGrams] = useState('100');
  const [matched, setMatched] = useState(null);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('foods').select('id, name, category, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g').order('name');
      setAllFoods(data || []);
      setLoading(false);
    })();
  }, []);

  const handleSearch = () => {
    setSearched(true);
    const normQuery = normalize(query);
    if (!normQuery) {
      setMatched(null);
      setResults(null);
      return;
    }

    const found = allFoods.find((f) => normalize(f.name).includes(normQuery));
    if (!found || !found.kcal_per_100g) {
      setMatched(null);
      setResults([]);
      return;
    }

    const g = Number(grams) || 100;
    const targetKcal = (found.kcal_per_100g * g) / 100;

    const candidates = allFoods
      .filter((f) => f.id !== found.id && f.kcal_per_100g)
      .map((f) => ({
        ...f,
        diff: Math.abs(f.kcal_per_100g - found.kcal_per_100g),
        sameCategory: found.category && f.category === found.category,
      }))
      .sort((a, b) => {
        if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
        return a.diff - b.diff;
      })
      .slice(0, 8)
      .map((f) => ({
        ...f,
        equivalentGrams: Math.round((targetKcal / f.kcal_per_100g) * 100),
      }));

    setMatched({ ...found, grams: g, targetKcal: Math.round(targetKcal) });
    setResults(candidates);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        <Text style={styles.intro}>Digite um alimento e a quantidade — mostramos outras opções com a mesma caloria aproximada.</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="ex: Pão francês"
            placeholderTextColor="#525252"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="g"
            placeholderTextColor="#525252"
            keyboardType="number-pad"
            value={grams}
            onChangeText={setGrams}
            onSubmitEditing={handleSearch}
          />
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
          {loading ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.searchButtonText}>Buscar Equivalentes</Text>}
        </TouchableOpacity>

        {searched && matched && (
          <Text style={styles.matchedText}>
            {matched.grams}g de {matched.name} ≈ {matched.targetKcal} kcal
          </Text>
        )}

        {searched && !matched && results && results.length === 0 && (
          <Text style={styles.emptyText}>Não achei esse alimento no catálogo. Tenta buscar de outro jeito.</Text>
        )}

        {results && results.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {results.map((f) => (
              <View key={f.id} style={styles.resultCard}>
                <View style={styles.resultIconCircle}>
                  <Ionicons name="swap-horizontal-outline" size={16} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{f.name}</Text>
                  <Text style={styles.resultMeta}>
                    ≈ {f.equivalentGrams}g · {f.protein_g_per_100g ? `${Math.round((f.protein_g_per_100g * f.equivalentGrams) / 100)}g prot` : ''}
                    {f.carbs_g_per_100g ? ` · ${Math.round((f.carbs_g_per_100g * f.equivalentGrams) / 100)}g carbo` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: '#a3a3a3', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  searchButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  searchButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  matchedText: { color: '#f97316', fontSize: 12, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', marginTop: 16 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 8 },
  resultIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  resultName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  resultMeta: { color: '#737373', fontSize: 11, marginTop: 2 },
});
