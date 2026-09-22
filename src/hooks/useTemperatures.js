import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_IP = '@esp32_ip';

export function useTemperatures() {
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.100');
  const [isDemoMode, setIsDemoMode] = useState(true); // Mặc định Demo để người dùng trải nghiệm ngay
  const [connectionStatus, setConnectionStatus] = useState('demo'); // 'connected' | 'offline' | 'demo'
  
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

  // Polling từ ESP32 thực tế khi không bật Demo Mode
  useEffect(() => {
    if (isDemoMode) return;

    let isMounted = true;
    const poll = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const url = esp32Ip.startsWith('http') ? esp32Ip : `http://${esp32Ip}/api/temperatures`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setData(json);
            setConnectionStatus('connected');
          }
        } else {
          if (isMounted) setConnectionStatus('offline');
        }
      } catch (err) {
        if (isMounted) setConnectionStatus('offline');
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isDemoMode, esp32Ip]);

  return {
    data,
    history,
    connectionStatus,
    isDemoMode,
    toggleDemoMode,
    esp32Ip,
    saveEsp32Ip
  };
}
