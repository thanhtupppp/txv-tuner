import React from 'react';
import { renderHook, act as hookAct } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';
import { useTemperatures } from '../src/hooks/useTemperatures';
import { TxvTunerScreen } from '../src/screens/TxvTunerScreen';
import { TxvHistoryChart } from '../src/components/TxvHistoryChart';
import { TxvRealtimeChart } from '../src/components/TxvRealtimeChart';
import { TxvTelemetryBar } from '../src/components/TxvTelemetryBar';
import { MaterialProvider } from '../src/components/SkeuoKit';
import * as esp32Service from '../src/services/esp32Service';

jest.mock('../src/services/esp32Service');

describe('Regression & Safety: Prevent Fake Telemetry When Disconnected', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderWithMaterial = async (ui) => {
    return await render(
      <MaterialProvider themeMode="light">
        {ui}
      </MaterialProvider>
    );
  };

  it('1. Hook khởi tạo không có sensor giả (isDemoMode=false, temp=null, online=false, history=[])', async () => {
    const mockController = jest.fn();
    esp32Service.subscribeEsp32Stream.mockReturnValue(mockController);

    const { result } = await renderHook(() => useTemperatures());

    expect(result.current.isDemoMode).toBe(false);
    expect(result.current.connectionStatus).toBe('offline');
    expect(result.current.data.sensors).toHaveLength(3);
    result.current.data.sensors.forEach((sensor) => {
      expect(sensor.temp).toBeNull();
      expect(sensor.temperatureC).toBeNull();
      expect(sensor.online).toBe(false);
    });
    expect(result.current.data.deltaAir).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.esp32Stats).toBeNull();
  });

  it('2. ESP32 chưa kết nối: UI hiển thị "--" và badge mất kết nối / chưa kết nối', async () => {
    const { getAllByTestId, getAllByText, getByText } = await renderWithMaterial(
      <TxvTelemetryBar
        liveT1={null}
        liveT2={null}
        liveT3={null}
        isOnline={false}
        isDemoMode={false}
      />
    );

    // Hiển thị gạch ngang "—" cho 3 cảm biến chưa có dữ liệu
    const valueTexts = getAllByTestId('value-text');
    expect(valueTexts).toHaveLength(3);
    valueTexts.forEach((textEl) => {
      expect(textEl.props.children).toContain('—');
    });

    // Hiển thị OFFLINE cho cả 3 kênh
    const offlineTags = getAllByText('OFFLINE');
    expect(offlineTags).toHaveLength(3);

    // Hiển thị thông báo trạng thái chưa kết nối
    expect(getAllByText(/ESP32 chưa kết nối/).length).toBeGreaterThanOrEqual(1);
  });

  it('3. Chart hiển thị empty state khi chưa có dữ liệu (không hiển thị dữ liệu giả)', async () => {
    const historyChart = await renderWithMaterial(
      <TxvHistoryChart historyData={[]} targetSh={6.0} />
    );
    expect(historyChart.getByTestId('history-chart-empty')).toBeTruthy();
    expect(historyChart.getByText(/CHƯA CÓ DỮ LIỆU LỊCH SỬ/)).toBeTruthy();

    const realtimeChart = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );
    expect(realtimeChart.getByTestId('realtime-chart-empty')).toBeTruthy();
    expect(realtimeChart.getByText(/CHƯA CÓ DỮ LIỆU REAL-TIME/)).toBeTruthy();
  });

  it('4. Khóa đề xuất điều chỉnh khi ESP32 chưa kết nối (interlock ESP32_OFFLINE)', async () => {
    const { getAllByText, getByText } = await renderWithMaterial(
      <TxvTunerScreen
        liveT1={null}
        liveT2={null}
        liveT3={null}
        isOnline={false}
        isDemoMode={false}
      />
    );

    const blockedMsgs = getAllByText(/MẤT KẾT NỐI ESP32 • KHÔNG THỂ ĐỀ XUẤT/);
    expect(blockedMsgs.length).toBeGreaterThanOrEqual(1);
    expect(getByText(/KHÓA/)).toBeTruthy();
  });

  it('5. Demo OFF: không chạy timer giả lập và không phát sinh số liệu ngẫu nhiên', async () => {
    const mockController = jest.fn();
    esp32Service.subscribeEsp32Stream.mockReturnValue(mockController);

    const { result } = await renderHook(() => useTemperatures());
    expect(result.current.isDemoMode).toBe(false);

    // Tua nhanh 10 giây
    await hookAct(async () => {
      jest.advanceTimersByTime(10000);
    });

    // Vẫn phải là null và history rỗng
    expect(result.current.data.sensors[0].temp).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });

  it('6. Demo ON: có badge "DỮ LIỆU MÔ PHỎNG — KHÔNG PHẢI DỮ LIỆU ESP32" và dữ liệu mô phỏng', async () => {
    const { getByText, getByTestId } = await renderWithMaterial(
      <TxvTelemetryBar
        liveT1={-22.7}
        liveT2={-30.1}
        liveT3={-19.9}
        isOnline={false}
        isDemoMode={true}
      />
    );

    expect(getByTestId('demo-tag')).toBeTruthy();
    expect(getByText('MÔ PHỎNG')).toBeTruthy();
    expect(getByTestId('demo-warning-banner')).toBeTruthy();
    expect(getByText(/DỮ LIỆU MÔ PHỎNG — KHÔNG PHẢI DỮ LIỆU ESP32/)).toBeTruthy();
  });

  it('7. Tắt demo: xóa sạch dữ liệu giả, dừng timer và trở về trạng thái an toàn', async () => {
    const mockController = jest.fn();
    esp32Service.subscribeEsp32Stream.mockReturnValue(mockController);

    const { result } = await renderHook(() => useTemperatures());

    // 1. Bật demo
    await hookAct(async () => {
      result.current.toggleDemoMode();
    });
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.connectionStatus).toBe('demo');
    expect(result.current.data.sensors[0].temp).toBe(-22.7);

    // 2. Chạy timer trong demo mode
    await hookAct(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.history.length).toBeGreaterThan(0);

    // 3. Tắt demo
    await hookAct(async () => {
      result.current.toggleDemoMode();
    });

    expect(result.current.isDemoMode).toBe(false);
    expect(result.current.connectionStatus).toBe('offline');
    expect(result.current.data.sensors[0].temp).toBeNull();
    expect(result.current.data.sensors[0].online).toBe(false);
    expect(result.current.history).toHaveLength(0);
    expect(result.current.esp32Stats).toBeNull();

    // 4. Tua thêm giờ để kiểm tra timer đã dừng
    await hookAct(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(result.current.data.sensors[0].temp).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });

  it('8. Chỉ khi nhận SSE thật từ ESP32 thì mới hiển thị temperatureC và cập nhật history', async () => {
    let capturedOnData;
    let capturedOnStatusChange;
    const mockController = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(({ onData, onStatusChange }) => {
      capturedOnData = onData;
      capturedOnStatusChange = onStatusChange;
      return mockController;
    });

    const { result } = await renderHook(() => useTemperatures());

    // Trước khi kết nối: temp = null
    expect(result.current.data.sensors[0].temperatureC).toBeNull();

    // Giả lập ESP32 stream kết nối thành công và phát telemetry thật
    await hookAct(async () => {
      capturedOnStatusChange('connected', { attempt: 0 });
      capturedOnData({
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temperatureC: -21.4, temp: -21.4, online: true },
          { id: 1, name: 'T2 Ra dàn', temperatureC: -29.8, temp: -29.8, online: true },
          { id: 2, name: 'T3 Bầu TXV', temperatureC: -15.2, temp: -15.2, online: true }
        ],
        deltaAir: 8.4,
        uptime: 500,
        receivedAt: 1700000000000
      });
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.data.sensors[0].temperatureC).toBe(-21.4);
    expect(result.current.data.sensors[1].temperatureC).toBe(-29.8);
    expect(result.current.data.sensors[2].temperatureC).toBe(-15.2);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].t1).toBe(-21.4);
  });

  it('9. Mất kết nối SSE không giữ lại cảm biến như dữ liệu online mới (đánh dấu online: false)', async () => {
    let capturedOnData;
    let capturedOnStatusChange;
    const mockController = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(({ onData, onStatusChange }) => {
      capturedOnData = onData;
      capturedOnStatusChange = onStatusChange;
      return mockController;
    });

    const { result } = await renderHook(() => useTemperatures());

    await hookAct(async () => {
      capturedOnStatusChange('connected', { attempt: 0 });
      capturedOnData({
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temperatureC: -21.4, temp: -21.4, online: true },
          { id: 1, name: 'T2 Ra dàn', temperatureC: -29.8, temp: -29.8, online: true },
          { id: 2, name: 'T3 Bầu TXV', temperatureC: -15.2, temp: -15.2, online: true }
        ],
        deltaAir: 8.4,
        uptime: 500,
      });
    });

    expect(result.current.data.sensors[0].online).toBe(true);

    // Giả lập rớt kết nối SSE
    await hookAct(async () => {
      capturedOnStatusChange('offline', { attempt: 1 });
    });

    expect(result.current.connectionStatus).toBe('offline');
    // Toàn bộ sensors phải được cập nhật online: false
    expect(result.current.data.sensors[0].online).toBe(false);
    expect(result.current.data.sensors[1].online).toBe(false);
    expect(result.current.data.sensors[2].online).toBe(false);
    expect(result.current.offlineSensors).toHaveLength(3);
  });
});
