import axios, { AxiosError } from 'axios';
import * as qs from 'qs';

const OK_LOGIN_ENDPOINT = 'https://app.orderkuota.com/api/v2/login';
const OK_GET_ENDPOINT = 'https://app.orderkuota.com/api/v2/get';

const OK_HEADERS = {
  'User-Agent': 'okhttp/4.12.0',
  'Host': 'app.orderkuota.com',
  'Content-Type': 'application/x-www-form-urlencoded',
};

const OK_CONSTANTS = {
  app_reg_id: 'e5aCENGrQOWvhQWYnv-uNc:APA91bFj3O_mv5Nf_2SM4Duz4Z8Ug3nBNaHlgodlY92CBuNIA9xmc0Dahev5xxqssPmnTdcie4mlhiG9ZAE1iCe1QbyhxcUyGXlenJxiUaXdfm1rklOEo9k',
  phone_uuid: 'e5aCENGrQOWvhQWYnv-uNc',
  phone_model: 'sdk_gphone64_x86_64',
  phone_android_version: '16',
  app_version_code: '250811',
  app_version_name: '25.08.11',
  ui_mode: 'light',
};

const TIMEOUT = 30000;
const MAX_RETRIES = 3;

async function requestWithRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export async function requestOtp(username: string, password: string): Promise<unknown> {
  return requestWithRetry(async () => {
    const payload = qs.stringify({
      username,
      password,
      ...OK_CONSTANTS,
    });

    const response = await axios.post(OK_LOGIN_ENDPOINT, payload, {
      headers: OK_HEADERS,
      timeout: TIMEOUT,
    });

    return response.data;
  });
}

export async function getToken(username: string, otp: string): Promise<unknown> {
  return requestWithRetry(async () => {
    const payload = qs.stringify({
      username,
      password: otp,
      ...OK_CONSTANTS,
    });

    const response = await axios.post(OK_LOGIN_ENDPOINT, payload, {
      headers: OK_HEADERS,
      timeout: TIMEOUT,
    });

    return response.data;
  });
}

export async function generateQrisAjaib(
  username: string,
  token: string,
  amount: number
): Promise<unknown> {
  return requestWithRetry(async () => {
    const timestamp = Date.now().toString();
    const payload = qs.stringify({
      ...OK_CONSTANTS,
      auth_username: username,
      auth_token: token,
      request_time: timestamp,
      'requests[qris_ajaib][amount]': amount.toString(),
    });

    const response = await axios.post(OK_GET_ENDPOINT, payload, {
      headers: OK_HEADERS,
      timeout: TIMEOUT,
    });

    return response.data;
  });
}

export async function getQrisHistory(
  username: string,
  token: string,
  historyType: string = 'qris_history'
): Promise<unknown> {
  return requestWithRetry(async () => {
    const timestamp = Date.now().toString();
    const tokenId = token.split(':')[0];

    const payload = qs.stringify({
      app_reg_id: OK_CONSTANTS.app_reg_id,
      phone_uuid: OK_CONSTANTS.phone_uuid,
      phone_model: OK_CONSTANTS.phone_model,
      [`requests[${historyType}][keterangan]`]: '',
      [`requests[${historyType}][jumlah]`]: '',
      request_time: timestamp,
      phone_android_version: OK_CONSTANTS.phone_android_version,
      app_version_code: OK_CONSTANTS.app_version_code,
      auth_username: username,
      [`requests[${historyType}][page]`]: '1',
      auth_token: token,
      app_version_name: OK_CONSTANTS.app_version_name,
      ui_mode: OK_CONSTANTS.ui_mode,
      [`requests[${historyType}][dari_tanggal]`]: '',
      'requests[0]': 'account',
      [`requests[${historyType}][ke_tanggal]`]: '',
    });

    const response = await axios.post(
      `https://app.orderkuota.com/api/v2/qris/mutasi/${tokenId}`,
      payload,
      {
        headers: OK_HEADERS,
        timeout: TIMEOUT,
      }
    );

    return response.data;
  });
}

export async function getBalance(username: string, token: string): Promise<unknown> {
  return requestWithRetry(async () => {
    const timestamp = Date.now().toString();
    const tokenId = token.split(':')[0];

    const payload = qs.stringify({
      request_time: timestamp,
      app_reg_id: OK_CONSTANTS.app_reg_id,
      phone_android_version: OK_CONSTANTS.phone_android_version,
      app_version_code: OK_CONSTANTS.app_version_code,
      phone_uuid: OK_CONSTANTS.phone_uuid,
      auth_username: username,
      'requests[1]': 'qris_menu',
      auth_token: token,
      app_version_name: OK_CONSTANTS.app_version_name,
      ui_mode: OK_CONSTANTS.ui_mode,
      'requests[0]': 'account',
      phone_model: OK_CONSTANTS.phone_model,
    });

    const response = await axios.post(
      `https://app.orderkuota.com/api/v2/qris/menu/${tokenId}`,
      payload,
      {
        headers: OK_HEADERS,
        timeout: TIMEOUT,
      }
    );

    return response.data;
  });
}
