import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useMaterial } from './SkeuoKit';

/**
 * Đánh giá chất lượng sóng WiFi từ giá trị RSSI (dBm)
 */
export const getSignalQuality = (rssi) => {
  if (typeof rssi !== 'number' || isNaN(rssi)) {
    return { label: 'Không rõ', icon: '📶', color: '#9E9E9E' };
  }
  if (rssi >= -50) return { label: 'Rất mạnh (Excellent)', icon: '📶', color: '#4CAF50' };
  if (rssi >= -60) return { label: 'Tốt (Good)', icon: '📶', color: '#8BC34A' };
  if (rssi >= -70) return { label: 'Khá (Fair)', icon: '📶', color: '#FFC107' };
  if (rssi >= -80) return { label: 'Yếu (Weak)', icon: '📶', color: '#FF9800' };
  return { label: 'Rất yếu (Very Weak)', icon: '📶', color: '#f44336' };
};

/**
 * Đánh giá độ khả dụng của bộ nhớ RAM (Free Heap)
 */
export const getHeapStatus = (freeHeap) => {
  if (typeof freeHeap !== 'number' || isNaN(freeHeap)) {
    return { label: 'Không rõ', color: '#9E9E9E' };
  }
  if (freeHeap > 50000) return { label: 'Tốt (Healthy)', color: '#4CAF50' };
  if (freeHeap > 20000) return { label: 'Bình thường (Normal)', color: '#2196F3' };
  if (freeHeap > 10000) return { label: 'Thấp (Low)', color: '#FF9800' };
  return { label: 'Nguy cấp (Critical)', color: '#f44336' };
};

/**
 * Chuyển đổi giây thành chuỗi thời gian định dạng dễ đọc (1h 23m 45s)
 */
export const formatUptime = (uptimeSeconds) => {
  const s = Math.max(0, Math.floor(Number(uptimeSeconds) || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Thanh tiến trình Uptime hiển thị độ ổn định hoạt động liên tục
 */
export const UptimeBar = ({ uptimeSeconds = 0 }) => {
  const maxUptime = 24 * 60 * 60; // Chu kỳ tham chiếu 24 giờ
  const sec = Number(uptimeSeconds) || 0;
  const progress = Math.min(sec / maxUptime, 1);
  const isHigh = progress > 0.8;

  return (
    <View style={styles.uptimeContainer}>
      <View style={styles.uptimeHeader}>
        <Text style={styles.statLabel}>Thời gian hoạt động (Uptime)</Text>
        <Text style={styles.statValue}>{formatUptime(sec)}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.max(2, Math.round(progress * 100))}%`,
              backgroundColor: isHigh ? '#f44336' : '#4CAF50'
            }
          ]}
        />
      </View>
      <Text style={[styles.uptimeSubtext, { color: isHigh ? '#f44336' : '#4CAF50' }]}>
        {isHigh ? '⚠️ Uptime > 19h: Khuyến nghị khởi động lại ESP32 định kỳ' : '✅ Hệ thống vận hành ổn định'}
      </Text>
    </View>
  );
};

/**
 * Hàng hiển thị từng thông số đơn
 */
export const StatRow = ({ label, value, valueColor, icon }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.valueRow}>
      {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  </View>
);

/**
 * Danh sách chi tiết trạng thái từng cảm biến nhiệt độ
 */
export const SensorStatus = ({ sensors = [] }) => {
  return (
    <View style={styles.sensorSection}>
      <Text style={styles.sectionHeader}>🔌 Trạng thái cảm biến</Text>
      {sensors.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có thông tin cảm biến</Text>
      ) : (
        sensors.map((sensor, index) => {
          const isOnline = Boolean(sensor.online);
          const tempText = isOnline && typeof sensor.temp === 'number'
            ? `${sensor.temp.toFixed(1)}°C`
            : 'Mất kết nối (Offline)';
          return (
            <View
              key={sensor.id ?? index}
              style={[
                styles.sensorRow,
                { backgroundColor: isOnline ? '#e8f5e9' : '#ffebee' }
              ]}
            >
              <Text style={styles.sensorName}>{sensor.name || `Cảm biến ${index + 1}`}</Text>
              <Text style={{ color: isOnline ? '#2e7d32' : '#c62828', fontWeight: '700', fontSize: 13 }}>
                {isOnline ? `● ${tempText}` : `○ ${tempText}`}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
};

export const StatsModal = ({
  visible,
  onClose,
  stats,
  sensors = [],
  loading = false,
  onRefresh
}) => {
  const { theme } = useMaterial();

  const signal = stats && typeof stats.wifiRSSI === 'number' ? getSignalQuality(stats.wifiRSSI) : null;
  const heapStatus = stats && typeof stats.freeHeap === 'number' ? getHeapStatus(stats.freeHeap) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme?.surface || '#ffffff', borderColor: theme?.borderStrong || '#d0d7de' }
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme?.ink || '#111827' }]}>
              📊 Trạng thái ESP32 (System Stats)
            </Text>
            {onRefresh && (
              <TouchableOpacity
                testID="stats-modal-refresh"
                onPress={onRefresh}
                disabled={loading}
                style={styles.refreshButton}
                accessibilityLabel="Làm mới thống kê ESP32"
              >
                {loading ? (
                  <ActivityIndicator testID="stats-modal-spinner" size="small" color="#2196F3" />
                ) : (
                  <Text style={styles.refreshButtonText}>🔄 Làm mới</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {!stats ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có dữ liệu thống kê từ ESP32</Text>
                <Text style={styles.emptySubtext}>Kết nối với ESP32 hoặc nhấn Làm mới để tải dữ liệu.</Text>
              </View>
            ) : (
              <>
                {/* 1. Phần cứng & Bộ nhớ */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeader}>⚙️ Tài nguyên hệ thống</Text>
                  <StatRow
                    label="Free Heap (RAM)"
                    value={
                      heapStatus
                        ? `${(stats.freeHeap / 1024).toFixed(1)} KB (${heapStatus.label})`
                        : `${stats.freeHeap} bytes`
                    }
                    valueColor={heapStatus?.color}
                  />
                  {signal && (
                    <StatRow
                      label="WiFi RSSI"
                      value={`${stats.wifiRSSI} dBm (${signal.label})`}
                      valueColor={signal.color}
                      icon={signal.icon}
                    />
                  )}
                  <StatRow
                    label="Cảm biến phát hiện"
                    value={`${stats.sensorCount ?? (sensors.length || 0)} thiết bị`}
                  />
                </View>

                {/* 2. Uptime Progress Bar */}
                <UptimeBar uptimeSeconds={stats.uptime} />

                {/* 3. Chi tiết Cảm biến */}
                <SensorStatus sensors={sensors} />

                {/* 4. Thông tin mạng WiFi */}
                <View style={[styles.sectionCard, styles.wifiCard]}>
                  <Text style={[styles.sectionHeader, { color: '#0d47a1' }]}>📶 Thông tin WiFi</Text>
                  <StatRow label="SSID" value={stats.wifiSSID || 'TXV-Tuner-AP'} />
                  <StatRow label="Địa chỉ IP" value={stats.wifiIP || '192.168.4.1'} />
                  <StatRow label="Gateway" value={stats.wifiGateway || '192.168.4.1'} />
                </View>
              </>
            )}
          </ScrollView>

          {/* Nút Đóng / OK */}
          <TouchableOpacity
            testID="stats-modal-close"
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme?.accent || '#2196F3' }]}
            accessibilityLabel="Đóng cửa sổ thống kê"
          >
            <Text style={styles.closeButtonText}>OK (Đóng)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default StatsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    flexDirection: 'row',
    alignItems: 'center'
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1976d2'
  },
  modalBody: {
    marginBottom: 16
  },
  sectionCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  wifiCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#bbdefb'
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#334155'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b'
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  statIcon: {
    fontSize: 12
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  uptimeContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  uptimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  uptimeSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4
  },
  sensorSection: {
    marginBottom: 14
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6
  },
  sensorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b'
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center'
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  }
});
