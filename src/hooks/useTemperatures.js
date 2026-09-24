import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeEsp32Stream, fetchEsp32Temperatures } from '../services/esp32Service';

const STORAGE_KEY_IP = '@esp32_ip';

export function useTemperatures() {
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.100');
  const [isDemoMode, setIsDemoMode] = useState(true); // Mặc định Demo để người dùng trải nghiệm ngay
  const [connectionStatus, setConnectionStatus] = useState('demo'); // 'connected' | 'reconnecting' | 'offline' | 'demo'
  const [lastUpdate, setLastUpdate] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [heartbeatInfo, setHeartbeatInfo] = useState(null);
  const controllerRef = useRef(null);
  
  const [data, setData] = useState({
    sensors: [
      { id: 0, name: 'T1 Vào dàn', temp: -22.7, online: true },
      { id: 1, name: 'T2 Ra dàn', temp: -30.1, online: true },
      { id: 2, name: 'T3 Bầu TXV', temp: -19.9, online: true }
    ],
    deltaAir: 7.4,
    uptime: 1240
  });

  const [history, setHistory] = useState([]);

  // Tải IP đã lưu
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_IP).then((savedIp) => {
      if (savedIp) setEsp32Ip(savedIp);
    }).catch(() => {});
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
      setConnectionStatus(next ? 'demo' : 'offline');
      return next;
    });
  }, []);

  // Giả lập dữ liệu trong Demo Mode
  useEffect(() => {
    if (!isDemoMode) return;

    const interval = setInterval(() => {
      setData((prev) => {
        // Biến thiên ngẫu nhiên nhẹ ±0.15°C
        const t1 = Number((prev.sensors[0].temp + (Math.random() - 0.5) * 0.2).toFixed(1));
        const t2 = Number((prev.sensors[1].temp + (Math.random() - 0.5) * 0.2).toFixed(1));
        const t3 = Number((prev.sensors[2].temp + (Math.random() - 0.5) * 0.3).toFixed(1));
        const deltaAir = Number((t1 - t2).toFixed(1));

        const updated = {
          sensors: [
            { id: 0, name: 'T1 Vào dàn', temp: t1, online: true },
            { id: 1, name: 'T2 Ra dàn', temp: t2, online: true },
            { id: 2, name: 'T3 Bầu TXV', temp: t3, online: true }
          ],
          deltaAir,
          uptime: (prev.uptime || 0) + 2
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

      const s0 = payload?.sensors?.[0]?.temp;
      const s1 = payload?.sensors?.[1]?.temp;
      const s2 = payload?.sensors?.[2]?.temp;
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

      // Nếu offline, kích hoạt polling dự phòng định kỳ
      if (status === 'offline' && !fallbackPollInterval) {
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

  return {
    data,
    history,
    connectionStatus,
    lastUpdate,
    reconnectAttempt,
    heartbeatInfo,
    reconnect,
    isDemoMode,
    toggleDemoMode,
    esp32Ip,
    saveEsp32Ip
  };
}
