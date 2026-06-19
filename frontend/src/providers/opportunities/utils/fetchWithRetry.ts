export interface FetchRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, retryOpts: FetchRetryOptions = {}): Promise<Response> {
  const maxRetries = retryOpts.maxRetries || 3;
  const baseDelayMs = retryOpts.baseDelayMs || 1000;
  const timeoutMs = retryOpts.timeoutMs || 10000;

  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(id);

      if (response.ok || response.status === 404 || response.status === 403 || response.status === 410) {
        // Return response even if 403/404, we handle that in the caller
        return response;
      }
      
      throw new Error(`HTTP Error: ${response.status}`);
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`Max retries reached for ${url}: ${error.message}`);
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`Fetch failed (${error.message}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unreachable code block in fetchWithRetry');
}
