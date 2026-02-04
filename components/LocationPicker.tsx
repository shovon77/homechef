import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

type LocationPickerProps = {
  value: string;
  onChange: (location: string) => void;
  onPlaceSelect?: (placeId: string, description: string) => void;
  placeholder?: string;
  style?: any;
  onFocus?: () => void;
  onBlur?: () => void;
};

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};

export default function LocationPicker({ value, onChange, onPlaceSelect, placeholder = "Search for a location...", style, onFocus, onBlur }: LocationPickerProps) {
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isFocusedRef = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    // Update query when value prop changes from parent
    // This ensures the input displays the correct value when parent updates it
    // Only update if not currently selecting to avoid conflicts
    if (!selectingRef.current) {
      setQuery(value || '');
    }
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
    // This prevents searching for the initial value or when selecting a suggestion
    // if (query === value) {
    //   setShowSuggestions(false);
    //   return;
    // }

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
          // Show suggestions if input is focused and user has typed something
          // Don't check selectingRef here as we want to show suggestions while typing
          if (isFocusedRef.current && query.trim() && !selectingRef.current) {
            setShowSuggestions(true);
          } else if (!isFocusedRef.current || selectingRef.current) {
            setShowSuggestions(false);
          }
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
    // Only depend on query to prevent search cancellation when parent updates value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSelectPlace = (prediction: PlacePrediction) => {
    selectingRef.current = true;
    const selectedValue = prediction.description;
    // Update internal query state immediately so it shows in the input
    setQuery(selectedValue);
    // Close suggestions immediately
    setShowSuggestions(false);
    setPredictions([]);
    // Call onChange to update parent, which will update value prop
    onChange(selectedValue);
    // Call onPlaceSelect if provided to pass place_id (async, don't wait)
    if (onPlaceSelect) {
      // Use setTimeout to ensure this doesn't block the UI update
      setTimeout(() => {
        onPlaceSelect(prediction.place_id, selectedValue);
        // Reset selecting flag after a short delay to allow value prop to sync
        setTimeout(() => {
          selectingRef.current = false;
        }, 100);
      }, 0);
    } else {
      setTimeout(() => {
        selectingRef.current = false;
      }, 100);
    }
  };

  const handleInputChange = (text: string) => {
    // Reset selectingRef when user starts typing (manual input)
    if (selectingRef.current) {
      selectingRef.current = false;
    }
    setQuery(text);
    // Always notify parent when input changes so "Save" button can appear
    onChange(text);
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for selection
    setTimeout(() => {
      if (!isFocusedRef.current && !selectingRef.current) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  return (
    <View style={[styles.container, showSuggestions && predictions.length > 0 && styles.containerWithSuggestions, style]} pointerEvents="box-none">
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          onFocus={() => {
            setIsFocused(true);
            isFocusedRef.current = true;
            // Show suggestions if there are predictions and user has typed something
            // Reset selectingRef in case it got stuck
            if (selectingRef.current) {
              selectingRef.current = false;
            }
            if (predictions.length > 0 && query.trim()) {
              setShowSuggestions(true);
            }
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            isFocusedRef.current = false;
            handleBlur();
            onBlur?.();
          }}
        />
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#3E6A55" />
          </View>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
    ...Platform.select({
      web: {
        zIndex: 10000,
      },
      default: {
        zIndex: 10000,
      },
    }),
  },
  containerWithSuggestions: {
    marginBottom: 210, // Add space for the dropdown (maxHeight: 200 + marginTop: 4 + some buffer)
  },
  inputContainer: {
    position: 'relative',
    zIndex: 1,
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
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none' as any,
      },
      default: {},
    }),
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
        zIndex: 99999,
      },
      default: {
        elevation: 50,
        zIndex: 99999,
      },
    }),
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
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

