import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

type LocationPickerProps = {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  style?: any;
};

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};

export default function LocationPicker({ value, onChange, placeholder = "Search for a location...", style }: LocationPickerProps) {
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update query when value prop changes
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // If query is empty, clear predictions
    if (!query.trim()) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    // If query matches current value, don't search
    if (query === value) {
      setShowSuggestions(false);
      return;
    }

    // Debounce API calls
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      console.log('🔍 Searching for location:', query);
      try {
        // Use Supabase Edge Function to avoid CORS issues
        const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
          body: { input: query },
        });

        console.log('📦 Raw response:', { data, error });

        if (error) {
          console.error('Error fetching places:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          setPredictions([]);
          setShowSuggestions(false);
          setLoading(false);
          return;
        }

        console.log('Places API response:', JSON.stringify(data, null, 2));

        // Handle different response formats
        if (data?.predictions && Array.isArray(data.predictions) && data.predictions.length > 0) {
          setPredictions(data.predictions);
          setShowSuggestions(true);
        } else if (data?.status && data.status !== 'OK') {
          console.warn('Google Places API status:', data.status);
          setPredictions([]);
          setShowSuggestions(false);
        } else {
          setPredictions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        console.error('Error stack:', (error as Error)?.stack);
        setPredictions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, value]);

  const handleSelectPlace = (prediction: PlacePrediction) => {
    setQuery(prediction.description);
    setShowSuggestions(false);
    setPredictions([]);
    onChange(prediction.description);
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
    // If user clears the input, clear the value
    if (!text.trim()) {
      onChange('');
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for selection
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          onFocus={() => {
            if (predictions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={handleBlur}
        />
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#3E6A55" />
          </View>
        )}
      </View>
      
      {showSuggestions && predictions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectPlace(item)}
              >
                <Text style={styles.suggestionMainText}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {item.structured_formatting?.secondary_text && (
                  <Text style={styles.suggestionSecondaryText}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#101828',
    backgroundColor: '#FFFFFF',
    paddingRight: 40,
  },
  loaderContainer: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    maxHeight: 200,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      default: {
        elevation: 4,
      },
    }),
    zIndex: 1000,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionMainText: {
    fontSize: 16,
    color: '#101828',
    fontWeight: '500',
  },
  suggestionSecondaryText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});

