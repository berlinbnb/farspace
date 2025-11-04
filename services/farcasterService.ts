import type { User } from '../types';

function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    if (protocol === 'https:' || protocol === 'http:') {
      return `${protocol}//${host}`;
    }
  }

  return 'http://localhost:3001';
}

// This should be the address of your backend server.
const API_BASE_URL = resolveApiBaseUrl();
const allowMockSignin = import.meta.env.VITE_ALLOW_MOCK_SIGNIN === 'true';

/**
 * Initiates a real Sign-in with Farcaster (SIWF) flow.
 * It prioritizes getting a real signature from a Farcaster Mini App context
 * and provides a clear, explained fallback for local development.
 */
export async function signInWithFarcaster(): Promise<Omit<User, 'role'>> {
  try {
    // Step 1: Request a sign-in message from the backend.
    const messageResponse = await fetch(`${API_BASE_URL}/api/siwf/request-message`, {
      method: 'POST',
    });
    if (!messageResponse.ok) {
      const errorData = await messageResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to retrieve sign-in message from server.');
    }
    const { message, nonce } = await messageResponse.json();

    let signature: string;
    let fid: number;

    // Step 2: Get a real signature from the Farcaster client if available.
    if (window.farcaster && typeof window.farcaster.signPersonalMessage === 'function' && typeof window.farcaster.getUser === 'function') {
      console.log("Attempting to sign with Farcaster client...");
      const user = await window.farcaster.getUser();
      fid = user.fid;
      const signed = await window.farcaster.signPersonalMessage({ message });
      signature = signed.signature;
      console.log("Successfully signed message with Farcaster client.");
    } else {
      if (!allowMockSignin) {
        throw new Error('Farcaster istemcisi bulunamadı. Mock giriş devre dışı, lütfen Farcaster Mini App içinde deneyin.');
      }
      // Fallback for development in a standard browser.
      // This will only work if the backend is running in development mode and mock signatures are enabled.
      alert(
        'Farcaster client not detected.\n\n' +
        'A mock signature will be used for development purposes. ' +
        'Make sure the backend is running with mock signatures enabled.'
      );
      fid = 714; // Default FID for development
      signature = 'mock_signature';
      console.warn("Using mock signature for development.");
    }

    // Step 3: Send the signature, message, and fid to the backend for verification.
    const verifyResponse = await fetch(`${API_BASE_URL}/api/siwf/verify-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        signature,
        fid,
        nonce,
      }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Verification failed: ${verifyResponse.statusText}`);
    }

    const { token, user } = await verifyResponse.json();

    // Step 4: Store the received JWT and return the user data.
    localStorage.setItem('farspace_jwt', token);
    console.log("Login successful! JWT stored.");

    return user;

  } catch (error) {
    console.error("Sign-in with Farcaster failed:", error);
    // Re-throw the error so the UI layer can catch it and display a message.
    throw error;
  }
}
