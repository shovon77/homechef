import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';
import { groupSlotsByDay } from '../../lib/chef-availability-schedule';
import {
  createDeliveryZoneForRegion,
  getDeliveryRegionName,
  type DeliveryZone,
} from '../../lib/delivery-zones';
import DeliveryRegionMapPicker from './DeliveryRegionMapPicker';
import DeliveryZoneEditorModal from './DeliveryZoneEditorModal';
import type { GeoPoint } from '../../lib/delivery-zones';

type DeliveryZonesSectionProps = {
  zones: DeliveryZone[];
  onChange: (zones: DeliveryZone[]) => void;
  kitchen?: GeoPoint | null;
  required?: boolean;
};

export default function DeliveryZonesSection({
  zones,
  onChange,
  kitchen = null,
  required = true,
}: DeliveryZonesSectionProps) {
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);

  const selectedRegionIds = useMemo(() => zones.map((zone) => zone.regionId), [zones]);

  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => a.name.localeCompare(b.name)),
    [zones],
  );

  const handleToggleRegion = (regionId: string) => {
    const existing = zones.find((zone) => zone.regionId === regionId);
    if (existing) {
      onChange(zones.filter((zone) => zone.regionId !== regionId));
      return;
    }

    const draft = createDeliveryZoneForRegion(regionId);
    if (!draft) return;
    setEditingZone(draft);
    setEditorVisible(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setEditorVisible(true);
  };

  const handleSave = (zone: DeliveryZone) => {
    const existingIndex = zones.findIndex((z) => z.regionId === zone.regionId);
    if (existingIndex >= 0) {
      const next = [...zones];
      next[existingIndex] = zone;
      onChange(next);
      return;
    }
    onChange([...zones, zone]);
  };

  const handleRemove = (regionId: string) => {
    onChange(zones.filter((zone) => zone.regionId !== regionId));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>
        Delivery cities & schedule
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Text style={styles.hint}>
        Select the cities or regions you deliver to below (within 100 km of your kitchen). Each one can have its own delivery days and times.
      </Text>

      <DeliveryRegionMapPicker
        selectedRegionIds={selectedRegionIds}
        onToggleRegion={handleToggleRegion}
        kitchen={kitchen}
      />

      {sortedZones.length === 0 ? (
        <Text style={styles.emptyText}>Select at least one city or region and add a schedule.</Text>
      ) : (
        <View style={styles.cardList}>
          {sortedZones.map((zone) => {
            const byDay = groupSlotsByDay(zone.slots);
            const regionLabel = getDeliveryRegionName(zone.regionId, zone.name);
            const needsSchedule = zone.slots.length === 0;

            return (
              <View key={zone.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{regionLabel}</Text>
                    <Text style={styles.cardMeta}>
                      {needsSchedule ? 'Schedule required' : 'Delivery schedule set'}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(zone)}>
                      <Text style={styles.editText}>{needsSchedule ? 'Add schedule' : 'Edit'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(zone.regionId)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {needsSchedule ? (
                  <Text style={styles.warningText}>Add delivery days and times for this region.</Text>
                ) : (
                  <View style={styles.scheduleList}>
                    {Object.entries(byDay).map(([day, windows]) => (
                      <Text key={day} style={styles.scheduleLine}>
                        {day}: {windows.join(', ')}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <DeliveryZoneEditorModal
        visible={editorVisible}
        initialZone={editingZone}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    color: '#101828',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold as '700',
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 4,
  },
  required: {
    color: theme.colors.primary,
  },
  hint: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  emptyText: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
  },
  cardList: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  cardMeta: {
    color: '#667085',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.body,
  },
  removeText: {
    color: '#B91C1C',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  warningText: {
    color: '#B45309',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  scheduleList: {
    gap: 4,
  },
  scheduleLine: {
    color: '#101828',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
});
