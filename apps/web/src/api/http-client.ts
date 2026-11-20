import type {
  ApiFailure,
  AuthSession,
} from '../types/api';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  '/api/v1'
).replace(/\/$/, '');

const SESSION_KEY =
  'ticketing-sla-session';

let refreshPromise:
  Promise<AuthSession | null> |
  null = null;

type MediaAssetResult = {
  id: string;
  originalName: string;
};

type LocalMediaUploadGrant = {
  provider: 'LOCAL';
  uploadMethod: 'MULTIPART';
  uploadEndpoint: string;
  actorId: string | null;
  expiresAt: string;
};

type BlobMediaUploadGrant = {
  provider: 'VERCEL_BLOB';
  uploadMethod: 'PRESIGNED_PUT';
  uploadUrl: string;
  providerPublicId: string;
  finalizeEndpoint: string;
  actorId: string | null;
  expiresAt: string;
};

type MediaUploadGrant =
  | LocalMediaUploadGrant
  | BlobMediaUploadGrant;

const MEDIA_CONTENT_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',

    'video/mp4',
    'video/quicktime',
    'video/3gpp',
    'video/3gpp2',
    'video/webm',
    'video/x-msvideo',
    'video/x-matroska',
    'video/x-m4v',
    'video/ogg',
    'video/mpeg',
  ]);

const CONTENT_TYPE_BY_EXTENSION:
  Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',

  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
};

export function getStoredSession():
  AuthSession | null {
  try {
    const value =
      localStorage.getItem(
        SESSION_KEY,
      );

    return value
      ? JSON.parse(
        value,
      ) as AuthSession
      : null;
  } catch {
    return null;
  }
}

export function storeSession(
  session:
    AuthSession | null,
): void {
  if (session) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(
        session,
      ),
    );
  } else {
    localStorage.removeItem(
      SESSION_KEY,
    );
  }

  window.dispatchEvent(
    new CustomEvent(
      'ticketing-session-changed',
    ),
  );
}

async function refreshSession():
  Promise<AuthSession | null> {
  const current =
    getStoredSession();

  if (
    !current?.refreshToken
  ) {
    return null;
  }

  const response =
    await fetch(
      `${API_URL}/auth/refresh`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            refreshToken:
              current.refreshToken,
          }),
      },
    );

  if (!response.ok) {
    storeSession(
      null,
    );

    return null;
  }

  const body =
    await response.json() as {
      data:
      AuthSession;
    };

  storeSession(
    body.data,
  );

  return body.data;
}

export async function apiRequest(
  path: string,
  options: RequestInit & {
    auth?: boolean;
    raw: true;
  },
): Promise<Response>;

export async function apiRequest<T>(
  path: string,
  options?: RequestInit & {
    auth?: boolean;
    raw?: false;
  },
): Promise<T>;

export async function apiRequest<T>(
  path: string,

  options:
    RequestInit & {
      auth?: boolean;
      raw?: boolean;
    } = {},
): Promise<T | Response> {
  const execute =
    async (
      session?:
        AuthSession | null,
    ) => {
      const headers =
        new Headers(
          options.headers,
        );

      if (
        !(
          options.body
          instanceof
          FormData
        ) &&
        !headers.has(
          'Content-Type',
        )
      ) {
        headers.set(
          'Content-Type',
          'application/json',
        );
      }

      if (
        options.auth !==
        false &&
        session?.accessToken
      ) {
        headers.set(
          'Authorization',
          `Bearer ${session.accessToken}`,
        );
      }

      return fetch(
        `${API_URL}${path}`,
        {
          ...options,
          headers,
        },
      );
    };

  let session =
    getStoredSession();

  let response =
    await execute(
      session,
    );

  if (
    response.status === 401 &&
    options.auth !== false &&
    session?.refreshToken
  ) {
    refreshPromise ??=
      refreshSession()
        .finally(
          () => {
            refreshPromise =
              null;
          },
        );

    session =
      await refreshPromise;

    if (session) {
      response =
        await execute(
          session,
        );
    }
  }

  if (!response.ok) {
    let failure:
      ApiFailure | null =
      null;

    try {
      failure =
        await response
          .json() as ApiFailure;
    } catch {
      /*
       * Response bukan JSON.
       */
    }

    const error =
      new Error(
        failure?.error
          .message ??
        `Request gagal (${response.status})`,
      ) as Error & {
        code?: string;
        details?: unknown;
      };

    error.code =
      failure?.error.code;

    error.details =
      failure?.error.details;

    throw error;
  }

  if (
    options.raw
  ) {
    return response;
  }

  if (
    response.status ===
    204
  ) {
    return undefined as unknown as T;
  }

  const contentType =
    response.headers
      .get(
        'content-type',
      ) ?? '';

  if (
    contentType.includes(
      'spreadsheet',
    ) ||
    contentType.includes(
      'application/octet-stream',
    )
  ) {
    return await response
      .blob() as unknown as T;
  }

  const body =
    await response.json();

  return (
    body &&
    typeof body ===
    'object' &&
    'meta' in body
  )
    ? body as T
    : body.data as T;
}

function resolveMediaContentType(
  file: File,
): string {
  const declared =
    file.type
      .trim()
      .toLowerCase();

  /*
   * Browser tertentu dapat menggunakan
   * image/jpg.
   */
  if (
    declared ===
    'image/jpg'
  ) {
    return 'image/jpeg';
  }

  if (
    MEDIA_CONTENT_TYPES.has(
      declared,
    )
  ) {
    return declared;
  }

  /*
   * Fallback jika browser tidak mengisi
   * File.type.
   *
   * Backend tetap melakukan magic-byte
   * validation ketika finalize.
   */
  const extension =
    file.name
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase();

  const inferred =
    extension
      ? CONTENT_TYPE_BY_EXTENSION[
      extension
      ]
      : undefined;

  if (
    inferred &&
    MEDIA_CONTENT_TYPES.has(
      inferred,
    )
  ) {
    return inferred;
  }

  throw new Error(
    'Format file tidak dapat dikenali. Gunakan foto atau video dengan format yang didukung.',
  );
}

async function requestMediaUploadGrant(
  file: File,
  isPublic: boolean,
): Promise<MediaUploadGrant> {
  const contentType =
    resolveMediaContentType(
      file,
    );

  return apiRequest<MediaUploadGrant>(
    isPublic
      ? '/public/media/signature'
      : '/media/signature',

    {
      method: 'POST',
      auth: !isPublic,

      body:
        JSON.stringify({
          originalName:
            file.name,

          contentType,

          sizeBytes:
            file.size,
        }),
    },
  );
}

async function uploadLocalMedia(
  file: File,
  isPublic: boolean,
): Promise<MediaAssetResult> {
  const form =
    new FormData();

  form.append(
    'file',
    file,
  );

  return apiRequest<MediaAssetResult>(
    isPublic
      ? '/public/media/upload'
      : '/media/upload',

    {
      method: 'POST',
      body: form,
      auth: !isPublic,
    },
  );
}

async function uploadDirectToBlob(
  grant:
    BlobMediaUploadGrant,

  file:
    File,
): Promise<void> {
  const contentType =
    resolveMediaContentType(
      file,
    );

  const response =
    await fetch(
      grant.uploadUrl,
      {
        method: 'PUT',

        headers: {
          'Content-Type':
            contentType,
        },

        body:
          file,
      },
    );

  if (
    response.ok
  ) {
    return;
  }

  throw new Error(
    `Upload media ke storage gagal (${response.status}).`,
  );
}

async function finalizeBlobMedia(
  grant:
    BlobMediaUploadGrant,

  file:
    File,

  isPublic:
    boolean,
): Promise<MediaAssetResult> {
  const path =
    isPublic
      ? '/public/media/finalize'
      : '/media/finalize';

  const payload =
    JSON.stringify({
      providerPublicId:
        grant.providerPublicId,

      originalName:
        file.name,
    });

  /*
   * finalize Blob bersifat idempotent pada Backend.
   *
   * Retry satu kali membantu kasus network
   * terputus setelah Blob sudah berhasil upload.
   */
  try {
    return await apiRequest<
      MediaAssetResult
    >(
      path,
      {
        method: 'POST',
        auth: !isPublic,
        body: payload,
      },
    );
  } catch (
  firstError
  ) {
    try {
      return await apiRequest<
        MediaAssetResult
      >(
        path,
        {
          method: 'POST',
          auth: !isPublic,
          body: payload,
        },
      );
    } catch {
      throw firstError;
    }
  }
}

export async function uploadMedia(
  file: File,
  isPublic = false,
): Promise<MediaAssetResult> {
  /*
   * Selalu tanyakan provider kepada Backend.
   *
   * Docker:
   *   signature -> LOCAL -> multipart upload
   *
   * Production:
   *   signature -> signed PUT URL
   *             -> browser PUT langsung ke Blob
   *             -> finalize Backend
   *
   * Dengan ini halaman check-in/completion
   * tidak perlu mengetahui environment.
   */
  const grant =
    await requestMediaUploadGrant(
      file,
      isPublic,
    );

  if (
    grant.provider ===
    'LOCAL' &&
    grant.uploadMethod ===
    'MULTIPART'
  ) {
    return uploadLocalMedia(
      file,
      isPublic,
    );
  }

  if (
    grant.provider ===
    'VERCEL_BLOB' &&
    grant.uploadMethod ===
    'PRESIGNED_PUT'
  ) {
    await uploadDirectToBlob(
      grant,
      file,
    );

    return finalizeBlobMedia(
      grant,
      file,
      isPublic,
    );
  }

  throw new Error(
    'Provider upload media tidak didukung.',
  );
}