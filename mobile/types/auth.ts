export interface SafeUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  upiId: string;
  profilePictureUrl: string | null;
  createdAt: string;
  pinSet: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type OtpPurpose = 'SIGNUP' | 'LOGIN';
