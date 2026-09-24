import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { useMaterial } from './SkeuoKit';

/**
 * Đánh giá chất lượng sóng WiFi từ giá trị RSSI (dBm)
 * Lưu ý: RSSI = 0 thường là uninitialized / disconnected
 */
export const getSignalQuality = (rssi) => {
  if (typeof rssi !== 'number' || isNaN(rssi) || rssi === 0) {
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
 * Hộp cảnh báo động có hiệu ứng chuyển đổi mượt mà
 */
export const WarningBox = ({ visible, type = 'warn', title, message, testID }) => {
  const animOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animOpacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }, [visible]);

  if (!visible) return null;

  const isDanger = type === 'danger';
  const bg = isDanger ? '#ffebee' : '#fff3e0';
  const border = isDanger ? '#ffcdd2' : '#ffe082';
  const textTitle = isDanger ? '#b71c1c' : '#e65100';
  const textBody = isDanger ? '#c62828' : '#bf360c';

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.warningBox,
        { backgroundColor: bg, borderColor: border, opacity: animOpacity }
      ]}
    >
      <Text style={[styles.warningTitle, { color: textTitle }]}>{title}</Text>
      <Text style={[styles.warningMessage, { color: textBody }]}>{message}</Text>
    </Animated.View>
  );
};

/**
 * Thẻ giải thích chi tiết Tooltip khi bấm vào icon ℹ️
 */
export const InfoTooltip = ({ visible, text, testID }) => {
  if (!visible) return null;
  return (
    <View testID={testID} style={styles.tooltipContainer}>
      <Text style={styles.tooltipText}>{text}</Text>
    </View>
  );
};

/**
 * Thanh tiến trình Uptime hiển thị độ ổn định hoạt động liên tục
 */
export const UptimeBar = ({ uptimeSeconds = 0, onToggleInfo, showInfo }) => {
  const maxUptime = 24 * 60 * 60; // Chu kỳ tham chiếu 24 giờ
  const sec = Number(uptimeSeconds) || 0;
  const progress = Math.min(sec / maxUptime, 1);
  const isHigh = progress > 0.8;

  return (
    <View style={styles.uptimeContainer}>
      <View style={styles.uptimeHeader}>
        <View style={styles.labelWithInfo}>
          <Text style={styles.statLabel}>Thời gian hoạt động (Uptime)</Text>
          {onToggleInfo && (
            <TouchableOpacity
              testID="tooltip-btn-uptime"
              onPress={onToggleInfo}
              style={styles.infoBadge}
              accessibilityLabel="Giải thích về Uptime"
            >
              <Text style={styles.infoBadgeText}>ℹ️</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.statValue}>{formatUptime(sec)}</Text>
      </View>
      <InfoTooltip
        visible={showInfo}
        testID="tooltip-uptime"
        text="Thời gian ESP32 hoạt động liên tục từ lần cấp nguồn hoặc khởi động lại gần nhất. Khi chạy quá lâu (>19h), nên restart định kỳ để giải phóng bộ nhớ."
      />
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
 * Hàng hiển thị từng thông số đơn kèm nút mở Tooltip
 */
export const StatRow = ({ label, value, valueColor, icon, onToggleInfo, infoVisible, infoText, infoTestId }) => (
  <View style={styles.statRowWrapper}>
    <View style={styles.statRow}>
      <View style={styles.labelWithInfo}>
        <Text style={styles.statLabel}>{label}</Text>
        {onToggleInfo && (
          <TouchableOpacity
            testID={infoTestId ? `tooltip-btn-${infoTestId}` : undefined}
            onPress={onToggleInfo}
            style={styles.infoBadge}
            accessibilityLabel={`Giải thích về ${label}`}
          >
            <Text style={styles.infoBadgeText}>ℹ️</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.valueRow}>
        {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
        <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
          {value}
        </Text>
      </View>
    </View>
    {infoText && (
      <InfoTooltip
        visible={infoVisible}
        testID={infoTestId ? `tooltip-${infoTestId}` : undefined}
        text={infoText}
      />
    )}
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
          const sensorTemp = sensor.temperatureC ?? sensor.temp;

          const tempText = isOnline
            && typeof sensorTemp === 'number'
            && Number.isFinite(sensorTemp)
            ? `${sensorTemp.toFixed(1)}°C`
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
  const [activeTooltip, setActiveTooltip] = useState(null);

  const toggleTooltip = (key) => {
    setActiveTooltip((prev) => (prev === key ? null : key));
  };

  const signal = stats && typeof stats.wifiRSSI === 'number' && stats.wifiRSSI !== 0
    ? getSignalQuality(stats.wifiRSSI)
    : null;
  const heapStatus = stats && typeof stats.freeHeap === 'number'
    ? getHeapStatus(stats.freeHeap)
    : null;

  // Điều kiện kích hoạt Warning Boxes
  const isRssiWeak = stats && typeof stats.wifiRSSI === 'number' && stats.wifiRSSI !== 0 && stats.wifiRSSI <= -71;
  const isHeapCritical = stats && typeof stats.freeHeap === 'number' && stats.freeHeap <= 10000;

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
                {/* Warning Box cho RAM Nguy cấp */}
                <WarningBox
                  visible={isHeapCritical}
                  type="danger"
                  testID="warning-box-heap"
                  title="🚨 Cảnh báo RAM nguy cấp"
                  message={`Bộ nhớ RAM cực thấp (${(stats.freeHeap / 1024).toFixed(1)} KB ≤ 10 KB). ESP32 có nguy cơ bị tràn bộ nhớ hoặc tự khởi động lại.`}
                />

                {/* Warning Box cho Tín hiệu WiFi Yếu */}
                <WarningBox
                  visible={isRssiWeak}
                  type="warn"
                  testID="warning-box-rssi"
                  title={`⚠️ Tín hiệu WiFi ${signal?.label.includes('Rất') ? 'rất yếu' : 'yếu'} (${stats.wifiRSSI} dBm)`}
                  message="Khoảng cách xa hoặc có vật cản gây suy giảm tín hiệu. Hãy di chuyển lại gần ESP32 để đảm bảo kết nối ổn định."
                />

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
                    onToggleInfo={() => toggleTooltip('heap')}
                    infoVisible={activeTooltip === 'heap'}
                    infoTestId="heap"
                    infoText="Bộ nhớ RAM động (Free Heap) của ESP32. Nếu RAM xuống dưới 10KB, ESP32 có nguy cơ sập luồng; dưới 5KB sẽ tự khởi động lại để bảo vệ phần cứng."
                  />
                  {signal && (
                    <StatRow
                      label="WiFi RSSI"
                      value={`${stats.wifiRSSI} dBm (${signal.label})`}
                      valueColor={signal.color}
                      icon={signal.icon}
                      onToggleInfo={() => toggleTooltip('rssi')}
                      infoVisible={activeTooltip === 'rssi'}
                      infoTestId="rssi"
                      infoText="Chỉ số cường độ tín hiệu sóng WiFi nhận được (dBm). Càng gần 0 sóng càng mạnh. Mức trên -60 dBm là tối ưu, dưới -70 dBm sóng bắt đầu yếu."
                    />
                  )}
                  <StatRow
                    label="Cảm biến phát hiện"
                    value={`${stats.sensorCount ?? (sensors.length || 0)} thiết bị`}
                  />
                </View>

                {/* 2. Uptime Progress Bar */}
                <UptimeBar
                  uptimeSeconds={stats.uptime}
                  onToggleInfo={() => toggleTooltip('uptime')}
                  showInfo={activeTooltip === 'uptime'}
                />

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
  warningBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.2,
    marginBottom: 12
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  warningMessage: {
    fontSize: 12,
    lineHeight: 16
  },
  tooltipContainer: {
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 6,
    marginVertical: 4
  },
  tooltipText: {
    color: '#f9fafb',
    fontSize: 11.5,
    lineHeight: 16
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  infoBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  infoBadgeText: {
    fontSize: 12
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
  statRowWrapper: {
    paddingVertical: 4
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
