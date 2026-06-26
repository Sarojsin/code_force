import { Platform, Linking } from 'react-native';

import { api, ApiSuccess } from './client';

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  relationship: string | null;
  is_primary: boolean;
  contact_user_id: string | null;
  contact_user_id_linked_at: string | null;
}

export interface EmergencyContactCreate {
  name: string;
  phone_number: string;
  relationship?: string | null;
  is_primary?: boolean;
  contact_user_id?: string | null;
}

export interface EmergencyContactUpdate {
  name?: string;
  phone_number?: string;
  relationship?: string | null;
  is_primary?: boolean;
  contact_user_id?: string | null;
}

export interface SosTriggerRequest {
  latitude: number;
  longitude: number;
  location_accuracy_m?: number | null;
  trigger_source?: 'button' | 'shake' | 'hardware_triple_press';
}

export interface SosAlert {
  id: string;
  user_id: string;
  triggered_at: string;
  latitude: number;
  longitude: number;
  location_accuracy_m: number | null;
  sms_status: string;
  cancelled_at: string | null;
  resolved_at: string | null;
  false_alarm: boolean;
  manual_intervention_needed: boolean;
  trigger_source: string | null;
}

export interface SosCancelResponse {
  message: string;
  false_alarm: boolean;
  contacts_notified_of_false_alarm: boolean;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const safetyService = {
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const resp = await api.get<ApiSuccess<EmergencyContact[]> | EmergencyContact[]>('/safety/emergency-contacts');
    return unwrap(resp.data);
  },

  async createEmergencyContact(data: EmergencyContactCreate): Promise<EmergencyContact> {
    const resp = await api.post<ApiSuccess<EmergencyContact> | EmergencyContact>('/safety/emergency-contacts', data);
    return unwrap(resp.data);
  },

  async updateEmergencyContact(id: string, data: EmergencyContactUpdate): Promise<EmergencyContact> {
    const resp = await api.put<ApiSuccess<EmergencyContact> | EmergencyContact>(`/safety/emergency-contacts/${id}`, data);
    return unwrap(resp.data);
  },

  async deleteEmergencyContact(id: string): Promise<void> {
    await api.delete(`/safety/emergency-contacts/${id}`);
  },

  async triggerSos(data: SosTriggerRequest, idempotencyKey?: string): Promise<SosAlert> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const resp = await api.post<ApiSuccess<SosAlert> | SosAlert>('/safety/sos/trigger', data, { headers });
    return unwrap(resp.data);
  },

  async getActiveSos(): Promise<SosAlert | null> {
    const resp = await api.get<ApiSuccess<SosAlert | null> | SosAlert | null>('/safety/sos/active');
    return unwrap(resp.data);
  },

  async getSosHistory(): Promise<SosAlert[]> {
    const resp = await api.get<ApiSuccess<SosAlert[]> | SosAlert[]>('/safety/sos/history');
    return unwrap(resp.data);
  },

  async cancelSos(alertId: string): Promise<SosCancelResponse> {
    const resp = await api.post<ApiSuccess<SosCancelResponse> | SosCancelResponse>(`/safety/sos/${alertId}/cancel`);
    return unwrap(resp.data);
  },

  async resolveSos(alertId: string): Promise<SosAlert> {
    const resp = await api.post<ApiSuccess<SosAlert> | SosAlert>(`/safety/sos/${alertId}/resolve`);
    return unwrap(resp.data);
  },

  async getSafetyStatus(): Promise<{ active_sos: SosAlert | null; emergency_contacts: EmergencyContact[]; sos_enabled: boolean }> {
    const resp = await api.get<ApiSuccess<{ active_sos: SosAlert | null; emergency_contacts: EmergencyContact[]; sos_enabled: boolean }>>('/safety/status');
    return unwrap(resp.data);
  },
};

/**
 * Open the native SMS app with a pre-filled SOS message.
 * Fallback when push notification fails or offline.
 */
export function sendSmsFallback(
  phoneNumbers: string[],
  userName: string,
  location?: { latitude: number; longitude: number; accuracy?: number | null },
): void {
  const body = buildSosSmsBody(userName, location);
  const encoded = encodeURIComponent(body);

  if (Platform.OS === 'android') {
    const smsUri = `sms:${phoneNumbers.join(';')}?body=${encoded}`;
    Linking.openURL(smsUri).catch(() => {
      // fallback: try opening without body
      Linking.openURL(`sms:${phoneNumbers.join(';')}`);
    });
  } else {
    const smsUri = `sms:${phoneNumbers.join(',')}&body=${encoded}`;
    Linking.openURL(smsUri).catch(() => {
      Linking.openURL(`sms:${phoneNumbers.join(',')}`);
    });
  }
}

function buildSosSmsBody(userName: string, location?: { latitude: number; longitude: number; accuracy?: number | null }): string {
  let body = `[SOS ALERT] ${userName} needs help!`;
  if (location) {
    const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    body += `\nLocation: ${mapsUrl}`;
    if (location.accuracy != null && location.accuracy > 500) {
      body += ' (Location approximate — please call user.)';
    }
  }
  body += '\nSent via SheCare';
  return body;
}
