export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PageResponse<T> {
  data: T[];

  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface Site {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;

  client: {
    id: string;
    name: string;
  };
}

export interface Catalog {
  categories: Array<{
    id: string;
    code: string;
    name: string;
  }>;

  priorities: Array<{
    id: string;
    code: string;
    label: string;
  }>;

  sites: Site[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;

  relatedType?:
  | string
  | null;

  relatedId?:
  | string
  | null;

  /*
   * Relative SPA URL dari backend.
   *
   * Ticket notification:
   * /app/tickets/:id
   */
  targetUrl?:
  | string
  | null;

  readAt?:
  | string
  | null;

  createdAt: string;
}

export interface UnreadNotificationCount {
  count: number;
}