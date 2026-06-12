import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { theme } from '../../lib/theme';
import {
  CHEF_DAYS_OF_WEEK,
  CHEF_TIME_WINDOWS,
  type AvailabilitySlot,
} from '../../lib/chef-availability-schedule';
import {
  getDeliveryRegionName,
  type DeliveryZone,
} from '../../lib/delivery-zones';

type DeliveryZoneEditorModalProps = {
  visible: boolean;
  initialZone?: DeliveryZone | null;
  onClose: () => void;
  onSave: (zone: DeliveryZone) => void;
};

export default function DeliveryZoneEditorModal({
  visible,
  initialZone,
  onClose,
  onSave,
}: DeliveryZoneEditorModalProps) {
  const [selectedDay, setSelectedDay] = useState('');
  const [draftSlots, setDraftSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (initialZone) {
      setDraftSlots(initialZone.slots.map((slot) => ({ ...slot })));
    } else {
      setDraftSlots([]);
    }
    setSelectedDay('');
  }, [visible, initialZone]);

  const selectedTimeWindows = draftSlots
    .filter((slot) => slot.day === selectedDay)
    .map((slot) => slot.timeWindow);

  const selectDay = (day: string) => {
    setSelectedDay(day);
  };

  const toggleTimeWindow = (timeWindow: string) => {
    if (!selectedDay) return;

    setDraftSlots((prev) => {
      const exists = prev.some((slot) => slot.day === selectedDay && slot.timeWindow === timeWindow);
      if (exists) {
        return prev.filter((slot) => !(slot.day === selectedDay && slot.timeWindow === timeWindow));
      }
      return [...prev, { day: selectedDay, timeWindow }];
    });
  };

  const removeDay = (day: string) => {
    setDraftSlots((prev) => prev.filter((slot) => slot.day !== day));
    if (selectedDay === day) {
      setSelectedDay('');
    }
  };

  const handleSave = () => {
    if (!initialZone) return;
    if (draftSlots.length === 0) return;

    onSave({
      ...initialZone,
      name: getDeliveryRegionName(initialZone.regionId, initialZone.name),
      slots: draftSlots,
    });
    onClose();
  };

  const slotsByDay = draftSlots.reduce<Record<string, string[]>>((acc, slot) => {
    if (!acc[slot.day]) acc[slot.day] = [];
    acc[slot.day].push(slot.timeWindow);
    return acc;
  }, {});

  const regionName = initialZone
    ? getDeliveryRegionName(initialZone.regionId, initialZone.name)
    : 'Delivery region';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Delivery schedule</Text>
            <Text style={styles.subtitle}>
              Set when you deliver to <Text style={styles.regionName}>{regionName}</Text>.
            </Text>

            {Object.keys(slotsByDay).length > 0 ? (
              <View style={styles.addedDays}>
                <Text style={styles.addedDaysTitle}>Your schedule</Text>
                {Object.entries(slotsByDay).map(([day, windows]) => (
                  <View key={day} style={styles.addedDayRow}>
                    <Text style={styles.addedDayText}>
                      {day}: {windows.join(', ')}
                    </Text>
                    <TouchableOpacity onPress={() => removeDay(day)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: theme.spacing.sm }]}>Schedule for this region</Text>
            <Text style={styles.hint}>Pick a day, then choose the time windows you deliver.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.dayRow}>
                {CHEF_DAYS_OF_WEEK.map((day) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => selectDay(day)}
                    style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}
                  >
                    <Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>
                      {day.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {!selectedDay ? (
              <Text style={styles.selectDayPrompt}>Select a day above to choose delivery times.</Text>
            ) : (
              <View style={styles.timeList}>
                {CHEF_TIME_WINDOWS.map((tw) => {
                  const selected = selectedTimeWindows.includes(tw);
                  return (
                    <TouchableOpacity
                      key={tw}
                      onPress={() => toggleTimeWindow(tw)}
                      style={styles.timeRow}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <Text style={styles.timeText}>{tw}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, draftSlots.length === 0 && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={draftSlots.length === 0}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  scrollContent: {
    padding: 20,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 4,
  },
  subtitle: {
    color: '#667085',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 12,
    lineHeight: 20,
  },
  regionName: {
    color: '#101828',
    fontWeight: '700',
  },
  label: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 8,
  },
  hint: {
    color: '#667085',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 8,
  },
  selectDayPrompt: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dayChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}20`,
  },
  dayChipText: {
    color: '#101828',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  dayChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  timeList: {
    maxHeight: 180,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  timeText: {
    color: '#101828',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  addedDays: {
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  addedDaysTitle: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  addedDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    gap: 8,
  },
  addedDayText: {
    flex: 1,
    color: '#101828',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.body,
  },
  removeText: {
    color: '#B91C1C',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.body,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#101828',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.body,
  },
});
