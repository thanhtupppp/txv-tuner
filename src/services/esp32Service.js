import { requestEsp32 } from './esp32Request';
import { normalizeEsp32Error } from './esp32Errors';

export async function getEsp32Data(baseUrl, options = {}) {
  try {
    const response = await requestEsp32(baseUrl, options);
    return response.data;
  } catch (error) {
    throw normalizeEsp32Error(error);
  }
}

export async function sendEsp32Command(baseUrl, command, options = {}) {
  try {
    const response = await requestEsp32(baseUrl, {
      ...options,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: typeof command === 'string' ? command : JSON.stringify(command),
    });

    return response.data;
  } catch (error) {
    throw normalizeEsp32Error(error);
  }
}

export async function checkEsp32Connection(baseUrl, options = {}) {
  try {
    await requestEsp32(baseUrl, {
      ...options,
      timeoutMs: options.timeoutMs || 3000,
    });
    return true;
  } catch (error) {
    return false;
  }
}

export default {
  getEsp32Data,
  sendEsp32Command,
  checkEsp32Connection,
};
