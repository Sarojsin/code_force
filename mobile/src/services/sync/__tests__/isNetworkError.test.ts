import { AxiosError, AxiosHeaders } from 'axios';
import { isNetworkError } from '../isNetworkError';

describe('isNetworkError', () => {
  it('returns true for network error with no response', () => {
    const error = new AxiosError('Network Error', 'ECONNABORTED');
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns true for 5xx server errors', () => {
    const error = new AxiosError('Server Error', '500', undefined, undefined, {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as any);
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns false for 4xx client errors', () => {
    const error = new AxiosError('Not Found', '404', undefined, undefined, {
      status: 404,
      data: {},
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as any);
    expect(isNetworkError(error)).toBe(false);
  });

  it('returns false for 422 validation errors', () => {
    const error = new AxiosError('Validation Failed', '422', undefined, undefined, {
      status: 422,
      data: {},
      statusText: 'Unprocessable Entity',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as any);
    expect(isNetworkError(error)).toBe(false);
  });

  it('returns true for TypeError with network message', () => {
    const error = new TypeError('Network request failed');
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns false for generic Error', () => {
    const error = new Error('Something went wrong');
    expect(isNetworkError(error)).toBe(false);
  });
});
