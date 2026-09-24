import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeEsp32Stream, fetchEsp32Temperatures, fetchEsp32Stats } from '../services/esp32Service';

const STORAGE_KEY_IP = '@esp32_ip';

export const INITIAL_OFFLINE_DATA = Object.freeze({
  sensors: [
    { id: 0, name: 'T1 Vào dàn', temp: null, temperatureC: null, online: false },
    { id: 1, name: 'T2 Ra dàn', temp: null, temperatureC: null, online: false },
    { id: 2, name: 'T3 Bầu TXV', temp: null, temperatureC: null, online: false },
  ],
  deltaAir: null,
  uptime: null,
});

export const INITIAL_DEMO_DATA = Object.freeze({
  sensors: [
    { id: 0, name: 'T1 Vào dàn', temp: -22.7, temperatureC: -22.7, online: true },
    { id: 1, name: 'T2 Ra dàn', temp: -30.1, temperatureC: -30.1, online: true },
    { id: 2, name: 'T3 Bầu TXV', temp: -19.9, temperatureC: -19.9, online: true },
  ],
  deltaAir: 7.4,
  uptime: 1240,
});

export function useTemperatures() {
  const [esp32Ip, setEsp32Ip] = useState('192.168.4.1');
  const [isDemoMode, setIsDemoMode] = useState(false); // Mặc định chế độ thực (OFFLINE), chỉ dùng số liệu mô phỏng khi người dùng chủ động bật Demo
  const [connectionStatus, setConnectionStatus] = useState('offline'); // 'connected' | 'reconnecting' | 'offline' | 'demo'
  const [lastUpdate, setLastUpdate] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [heartbeatInfo, setHeartbeatInfo] = useState(null);
  const [esp32Stats, setEsp32Stats] = useState(null);
  const controllerRef = useRef(null);
  
  const [data, setData] = useState(INITIAL_OFFLINE_DATA);
  const [history, setHistory] = useState([]);
  const [warningsLog, setWarningsLog] = useState([]);

  // Tải IP và warnings log đã lưu
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_IP).then((savedIp) => {
      if (savedIp) setEsp32Ip(savedIp);
    }).catch(() => {});

    AsyncStorage.getItem('@esp32_warnings_log').then((raw) => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setWarningsLog(list);
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  const addWarning = useCallback((warn) => {
    const item = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      ...warn
    };
    setWarningsLog((prev) => {
      const next = [item, ...prev].slice(0, 50);
      AsyncStorage.setItem('@esp32_warnings_log', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveEsp32Ip = async (newIp) => {
    setEsp32Ip(newIp);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_IP, newIp);
    } catch (e) {
      console.warn('Lỗi lưu IP:', e);
    }
  };

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      if (next) {
        // Bật Demo: Nạp bộ dữ liệu mô phỏng ban đầu
        setData(INITIAL_DEMO_DATA);
        setConnectionStatus('demo');
        setEsp32Stats({
          freeHeap: 198400,
          uptime: 1240,
          wifiRSSI: -45,
          clientConnected: true,
          wifiSSID: 'TuSmart-TXV-Tuner',
          wifiIP: '192.168.4.1',
          wifiGateway: '192.168.4.1',
          sensorCount: 3,
        });
      } else {
        // Tắt Demo: Dừng và xóa sạch toàn bộ dữ liệu mô phỏng, trả về trạng thái offline an toàn
        setData(INITIAL_OFFLINE_DATA);
        setHistory([]);
        setEsp32Stats(null);
        setConnectionStatus('offline');
      }
      return next;
    });
  }, []);

  // Giả lập dữ liệu trong Demo Mode (chỉ chạy khi isDemoMode === true)
  useEffect(() => {
    if (!isDemoMode) return;

    const interval = setInterval(() => {
      setData((prev) => {
        // Biến thiên ngẫu nhiên nhẹ ±0.15°C
        const s0 = prev?.sensors?.[0]?.temperatureC ?? prev?.sensors?.[0]?.temp ?? -22.7;
        const s1 = prev?.sensors?.[1]?.temperatureC ?? prev?.sensors?.[1]?.temp ?? -30.1;
        const s2 = prev?.sensors?.[2]?.temperatureC ?? prev?.sensors?.[2]?.temp ?? -19.9;
        const t1 = Number((s0 + (Math.random() - 0.5) * 0.2).toFixed(1));
        const t2 = Number((s1 + (Math.random() - 0.5) * 0.2).toFixed(1));
        const t3 = Number((s2 + (Math.random() - 0.5) * 0.3).toFixed(1));
        const deltaAir = Number((t1 - t2).toFixed(1));

        const updated = {
          sensors: [
            { id: 0, name: 'T1 Vào dàn', temp: t1, temperatureC: t1, online: true },
            { id: 1, name: 'T2 Ra dàn', temp: t2, temperatureC: t2, online: true },
            { id: 2, name: 'T3 Bầu TXV', temp: t3, temperatureC: t3, online: true }
          ],
          deltaAir,
          uptime: (prev?.uptime || 1240) + 2
        };

        setHistory((h) => [
          ...h.slice(-29),
          { time: Date.now(), t1, t2, t3 }
        ]);

        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  const reconnect = useCallback(() => {
    if (controllerRef.current && typeof controllerRef.current.reconnect === 'function') {
      controllerRef.current.reconnect();
    }
  }, []);

  // Luồng dữ liệu thời gian thực từ ESP32 (ưu tiên SSE streaming, tự động polling fallback nếu rớt stream)
  useEffect(() => {
    if (isDemoMode) return;

    let isMounted = true;
    let fallbackPollInterval = null;

    const handleStreamData = (payload) => {
      if (!isMounted || !payload) return;
      setData(payload);
      setConnectionStatus('connected');
      setLastUpdate(payload.receivedAt || Date.now());
      setReconnectAttempt(0);

      const s0 = payload?.sensors?.[0]?.temperatureC ?? payload?.sensors?.[0]?.temp;
      const s1 = payload?.sensors?.[1]?.temperatureC ?? payload?.sensors?.[1]?.temp;
      const s2 = payload?.sensors?.[2]?.temperatureC ?? payload?.sensors?.[2]?.temp;
      if (typeof s0 === 'number' || typeof s1 === 'number' || typeof s2 === 'number') {
        setHistory((h) => [
          ...h.slice(-29),
          { time: Date.now(), t1: s0, t2: s1, t3: s2 }
        ]);
      }
    };

    const handleStatusChange = (status, meta = {}) => {
      if (!isMounted) return;
      setConnectionStatus(status);
      if (typeof meta.attempt === 'number') {
        setReconnectAttempt(meta.attempt);
      } else if (status === 'connected') {
        setReconnectAttempt(0);
      }

      // Nếu offline, đánh dấu sensors offline để khóa an toàn liên động, xóa stats và kích hoạt polling dự phòng
      if (status === 'offline') {
        setData((prev) => {
          if (!prev?.sensors) return INITIAL_OFFLINE_DATA;
          return {
            ...prev,
            sensors: prev.sensors.map((s) => ({
              ...s,
              online: false,
            })),
          };
        });
        setEsp32Stats(null);

        if (!fallbackPollInterval) {
          fallbackPollInterval = setInterval(async () => {
            if (!isMounted) return;
            try {
              const json = await fetchEsp32Temperatures(esp32Ip, 2500);
              if (isMounted && json) {
                handleStreamData(json);
                setConnectionStatus('connected');
              }
            } catch (e) {
              if (isMounted) setConnectionStatus('offline');
            }
          }, 3000);
        }
      } else if (status === 'connected' && fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
        fallbackPollInterval = null;
      }
    };

    const controller = subscribeEsp32Stream({
      ip: esp32Ip,
      onData: handleStreamData,
      onHeartbeat: (hb) => {
        if (!isMounted) return;
        setHeartbeatInfo(hb);
        setLastUpdate(hb.receivedAt || Date.now());
        setEsp32Stats((prev) => ({
          ...prev,
          freeHeap: hb.freeHeap,
          uptime: hb.uptime,
          wifiRSSI: hb.wifiRSSI ?? prev?.wifiRSSI,
          clientConnected: true
        }));
        if (typeof hb.freeHeap === 'number' && hb.freeHeap < 10000) {
          addWarning({
            type: hb.freeHeap < 5000 ? 'heap_critical' : 'heap_low',
            message: `Free Heap thấp: ${(hb.freeHeap / 1024).toFixed(1)} KB`,
            value: hb.freeHeap
          });
        }
      },
      onWarning: (w) => {
        if (!isMounted) return;
        addWarning(w);
      },
      onStatusChange: handleStatusChange
    });

    controllerRef.current = controller;

    return () => {
      isMounted = false;
      controllerRef.current = null;
      if (typeof controller === 'function') {
        controller();
      } else if (controller && typeof controller.unsubscribe === 'function') {
        controller.unsubscribe();
      }
      if (fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
      }
    };
  }, [isDemoMode, esp32Ip]);

  const [statsLoading, setStatsLoading] = useState(false);

  // Định kỳ lấy thông số /api/stats của ESP32 mỗi 60s
  useEffect(() => {
    if (isDemoMode) {
      setEsp32Stats({
        freeHeap: 198400,
        uptime: data.uptime || 1240,
        wifiRSSI: -45,
        clientConnected: true,
        wifiSSID: 'TuSmart-TXV-Tuner',
        wifiIP: '192.168.4.1',
        wifiGateway: '192.168.4.1',
        sensorCount: 3
      });
      return;
    }

    if (connectionStatus !== 'connected') {
      return;
    }

    let isMounted = true;
    const loadStats = async () => {
      try {
        const stats = await fetchEsp32Stats(esp32Ip, 2000);
        if (isMounted && stats) {
          setEsp32Stats((prev) => ({
            ...prev,
            ...stats
          }));
        }
      } catch (err) {}
    };

    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isDemoMode, connectionStatus, esp32Ip, data.uptime]);

  const refreshStats = useCallback(async () => {
    if (isDemoMode) {
      setStatsLoading(true);
      setEsp32Stats((prev) => ({
        freeHeap: 198400,
        uptime: (prev?.uptime || 1240) + 10,
        wifiRSSI: -45,
        clientConnected: true,
        wifiSSID: 'TuSmart-TXV-Tuner',
        wifiIP: '192.168.4.1',
        wifiGateway: '192.168.4.1',
        sensorCount: 3,
        ...prev
      }));
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    try {
      const stats = await fetchEsp32Stats(esp32Ip, 3000);
      if (stats) {
        setEsp32Stats((prev) => ({
          ...prev,
          ...stats
        }));
      }
      return stats;
    } finally {
      setStatsLoading(false);
    }
  }, [isDemoMode, esp32Ip]);

  const offlineSensors = useMemo(() => {
    return (data?.sensors || []).filter((s) => !s.online);
  }, [data?.sensors]);

  return {
    data,
    history,
    connectionStatus,
    lastUpdate,
    reconnectAttempt,
    heartbeatInfo,
    esp32Stats,
    statsLoading,
    refreshStats,
    offlineSensors,
    warningsLog,
    reconnect,
    isDemoMode,
    toggleDemoMode,
    esp32Ip,
    saveEsp32Ip
  };
}
