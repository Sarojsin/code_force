import { AxiosError } from 'axios';

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) return true;
    if (error.response.status >= 500) return true;
    return false;
  }
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }
  return false;
}
