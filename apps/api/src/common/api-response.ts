export interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export const ok = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data
});

export const fail = (message: string, code?: string): ApiResponse<never> => ({
  success: false,
  error: { message, code }
});
