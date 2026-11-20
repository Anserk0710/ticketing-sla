import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Image,
  MapPin,
  MessageSquare,
  RotateCcw,
  UserPlus,
  Users,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest, getStoredSession } from '../../api/http-client';
import { PageHeader } from '../../components/data-display/page-header';
import { SlaCountdown } from '../../components/data-display/sla-countdown';
import { ErrorPanel, Loading } from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import {
  Field,
  Input,
  Select,
  Textarea,
} from '../../components/ui/field';
import { useAuth } from '../../features/auth/auth-context';
import { formatDate, formatDuration } from '../../utils/format';

const RESCHEDULABLE_STATUSES = [
  'NEW',
  'RESPONDED',
  'ASSIGNED',
  'ON_SITE',
  'IN_PROGRESS',
  'REOPENED',
] as const;

const API_URL = (
  (import.meta as any).env?.VITE_API_URL || '/api/v1'
).replace(/\/$/, '');

const MEMBER_MEDIA_ACTION_CLASS =
  'inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-sans text-[12px] font-semibold leading-4 text-alice-blue-600 transition-colors hover:text-alice-blue-700 focus-visible:text-alice-blue-700';

/*
 * Hook: fetch media dengan Bearer token lalu buat Blob URL.
 * Revoke dilakukan saat unmount untuk menghindari memory leak.
 */
function useMediaBlobUrl(mediaId: string | null): {
  url: string | null;
  loading: boolean;
  error: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mediaId) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(false);
    setUrl(null);

    const session = getStoredSession();
    const token = session?.accessToken ?? '';

    fetch(`${API_URL}/media/${mediaId}/access`, {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('media fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return { url, loading, error };
}

type MediaItem = {
  id: string;
  mimeType: string;
  originalName?: string;
};

/*
 * Sub-komponen untuk menampilkan 1 media item (gambar / video)
 * dengan blob URL yang di-fetch dengan auth header.
 */
function MediaViewer({
  item,
  className,
}: {
  item: MediaItem;
  className?: string;
}) {
  const isVideo = item.mimeType.startsWith('video/');
  const { url, loading, error } = useMediaBlobUrl(
    item.id,
  );

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-black/40 ${className ?? ''}`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-black/40 text-white/60 ${className ?? ''}`}
      >
        <X className="h-8 w-8" />
        <span className="text-xs">Gagal memuat media</span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        controls
        autoPlay
        className={className}
      />
    );
  }

  return (
    <img
      src={url}
      alt={item.originalName ?? 'Media'}
      className={className}
    />
  );
}

/*
 * ============================================================
 * MEDIA MODAL COMPONENT
 * Modal lightbox untuk preview foto dan video
 * ============================================================
 */
function MediaModal({
  items,
  initialIndex = 0,
  title,
  onClose,
}: {
  items: MediaItem[];
  initialIndex?: number;
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] =
    useState(initialIndex);

  const item = items[index];
  const isVideo =
    item?.mimeType?.startsWith('video/');

  /* Tutup modal dengan Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0)
        setIndex((i) => i - 1);
      if (
        e.key === 'ArrowRight' &&
        index < items.length - 1
      )
        setIndex((i) => i + 1);
    };
    window.addEventListener('keydown', handler);
    return () =>
      window.removeEventListener('keydown', handler);
  }, [index, items.length, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col gap-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isVideo ? (
              <Video className="h-5 w-5 text-white" />
            ) : (
              <Image className="h-5 w-5 text-white" />
            )}
            <h3 className="text-base font-bold text-white">
              {title}
            </h3>
            {items.length > 1 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                {index + 1} / {items.length}
              </span>
            )}
          </div>

          <button
            id="media-modal-close-btn"
            onClick={onClose}
            className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media Content */}
        <div className="flex items-center gap-2">
          {/* Prev button */}
          {items.length > 1 && (
            <button
              id="media-modal-prev-btn"
              onClick={() =>
                setIndex((i) => Math.max(0, i - 1))
              }
              disabled={index === 0}
              className="shrink-0 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40 disabled:opacity-30"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Media */}
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/60">
            <MediaViewer
              key={item.id}
              item={item}
              className="max-h-[70vh] w-full object-contain"
            />
          </div>

          {/* Next button */}
          {items.length > 1 && (
            <button
              id="media-modal-next-btn"
              onClick={() =>
                setIndex((i) =>
                  Math.min(items.length - 1, i + 1),
                )
              }
              disabled={index === items.length - 1}
              className="shrink-0 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40 disabled:opacity-30"
              aria-label="Berikutnya"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Filename */}
        {item.originalName && (
          <p className="text-center text-xs text-white/60">
            {item.originalName}
          </p>
        )}

        {/* Thumbnail strip (jika lebih dari 1) */}
        {items.length > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto py-1">
            {items.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setIndex(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index
                    ? 'border-white'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                aria-label={`Media ${i + 1}`}
              >
                {m.mimeType.startsWith('video/') ? (
                  <div className="flex h-full w-full items-center justify-center bg-white/10">
                    <Video className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <MediaViewer
                    item={m}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ActionName =
  | 'respond'
  | 'assign'
  | 'resolve'
  | 'close'
  | 'reopen'
  | 'reschedule'
  | 'resume';

type ActionPayload = {
  action: ActionName;
  path: string;
  body?: unknown;
  method?: string;
};

function SlaPanel({
  title,
  item,
}: {
  title: string;
  item: any;
}) {
  const runtime = item?.runtime;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-lavender-grey-500">
            {title}
          </p>

          <p className="mt-1 text-2xl font-black text-charcoal-900">
            {runtime
              ? formatDuration(runtime.elapsedSeconds)
              : '—'}
          </p>
        </div>

        <Badge
          value={
            runtime?.outcome ??
            runtime?.status ??
            'NOT_STARTED'
          }
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-y border-iron-grey-100 py-3">
        <span className="text-xs font-bold text-lavender-grey-500">
          Count Down SLA:
        </span>

        <SlaCountdown
          dueAt={item?.dueAt}
          status={runtime?.status}
          outcome={runtime?.outcome}
          completedAt={item?.completedAt}
          size="md"
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-lavender-grey-500">
            Target
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDuration(item?.targetSeconds)}
          </dd>
        </div>

        <div>
          <dt className="text-lavender-grey-500">
            Deadline
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDate(item?.dueAt)}
          </dd>
        </div>

        <div>
          <dt className="text-lavender-grey-500">
            Warning
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDate(item?.warningAt)}
          </dd>
        </div>

        <div>
          <dt className="text-lavender-grey-500">
            Breach
          </dt>
          <dd className="mt-1 font-semibold text-rose-700">
            {formatDuration(runtime?.breachSeconds)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();

  /*
   * State untuk modal preview media
   */
  const [checkinModal, setCheckinModal] =
    useState<{ items: MediaItem[]; memberId: string } | null>(null);

  const [completionModal, setCompletionModal] =
    useState<{ items: MediaItem[]; memberId: string } | null>(null);
  const { hasPermission, session } = useAuth();

  const ticket = useQuery({
    queryKey: ['ticket', id],
    queryFn: () =>
      apiRequest<any>(`/tickets/${id}`),
    enabled: !!id,
  });

  const technicians = useQuery({
    queryKey: ['technicians'],
    queryFn: () =>
      apiRequest<any[]>('/technicians'),
    enabled: hasPermission('ticket.assign'),
  });

  const catalog = useQuery({
    queryKey: ['catalog-internal'],
    queryFn: () =>
      apiRequest<any>(
        '/public/catalog',
        {
          auth: false,
        },
      ),
  });

  const [respond, setRespond] = useState({
    message: '',
    priorityId: '',
    categoryId: '',
    nextAction: '',
  });

  const [assign, setAssign] = useState<{
    technicianIds: string[];
    leadTechnicianId: string;
    note: string;
  }>({
    technicianIds: [],
    leadTechnicianId: '',
    note: '',
  });

  const [resolution, setResolution] =
    useState('');

  const [reason, setReason] =
    useState('');

  /*
   * Phase 5:
   * State untuk form reschedule.
   */
  const [reschedule, setReschedule] =
    useState({
      reason: '',
      scheduledAt: '',
    });

  /*
   * Catatan saat resume bersifat optional
   * sesuai ResumeTicketDto backend.
   */
  const [resumeNote, setResumeNote] =
    useState('');

  const [actionError, setActionError] =
    useState('');

  const mutation = useMutation({
    mutationFn: async ({
      path,
      body,
      method = 'POST',
    }: ActionPayload) =>
      apiRequest(path, {
        method,
        body: body
          ? JSON.stringify(body)
          : undefined,
      }),

    onSuccess: async (
      _data,
      variables,
    ) => {
      setActionError('');

      if (
        variables.action ===
        'reschedule'
      ) {
        setReschedule({
          reason: '',
          scheduledAt: '',
        });
      }

      if (
        variables.action ===
        'resume'
      ) {
        setResumeNote('');
      }

      /*
       * Refresh ticket detail dan ticket list
       * supaya status PENDING/resume langsung
       * terlihat setelah mutation berhasil.
       */
      await qc.invalidateQueries({
        queryKey: ['ticket', id],
      });

      await qc.invalidateQueries({
        queryKey: ['tickets'],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Aksi gagal.',
      );
    },
  });

  const isActionPending = (
    action: ActionName,
  ) =>
    mutation.isPending &&
    mutation.variables?.action ===
    action;

  if (ticket.isLoading) {
    return <Loading />;
  }

  if (
    ticket.error ||
    !ticket.data
  ) {
    return (
      <ErrorPanel
        error={ticket.error}
      />
    );
  }

  const data = ticket.data;

  const currentAssignment = [
    ...data.assignments,
  ]
    .reverse()
    .find(
      (item: any) =>
        item.status === 'ACTIVE',
    );

  /*
   * Endpoint reschedule dan resume
   * menggunakan permission ticket.close.
   *
   * Dari seed project:
   * - ADMINISTRATOR: punya ticket.close
   * - HEAD: punya ticket.close
   * - TECHNICIAN: tidak punya
   *
   * Jadi action otomatis hanya muncul
   * untuk Head/Admin.
   */
  const canManageSchedule =
    hasPermission('ticket.close');

  const canReschedule =
    canManageSchedule &&
    RESCHEDULABLE_STATUSES.includes(
      data.status as
      (typeof RESCHEDULABLE_STATUSES)[number],
    );

  const canResume =
    canManageSchedule &&
    data.status === 'PENDING';

  const canRespond =
    data.status === 'NEW' &&
    hasPermission(
      'ticket.respond',
    );

  const canAssign =
    [
      'RESPONDED',
      'REOPENED',
    ].includes(data.status) &&
    hasPermission(
      'ticket.assign',
    );

  const canResolveRole =
    session?.user.roles.some(
      (role) =>
        role ===
        'ADMINISTRATOR' ||
        role ===
        'HEAD',
    ) ?? false;

  const canResolve =
    data.status ===
    'IN_PROGRESS' &&
    canResolveRole &&
    hasPermission(
      'ticket.resolve',
    );

  const canClose =
    data.status ===
    'RESOLVED' &&
    hasPermission(
      'ticket.close',
    );

  const canReopen =
    [
      'RESOLVED',
      'CLOSED',
    ].includes(data.status) &&
    hasPermission(
      'ticket.reopen',
    );

  const hasAvailableAction =
    canRespond ||
    canAssign ||
    canResolve ||
    canClose ||
    canReopen ||
    canReschedule ||
    canResume;

  /*
   * Backend Phase 2 menyimpan:
   *
   * metadata.previousStatus
   *
   * ketika ticket masuk PENDING.
   *
   * Kita gunakan informasi tersebut
   * untuk memberi preview status resume.
   */
  const latestPendingLog = [
    ...data.statusLogs,
  ]
    .reverse()
    .find(
      (log: any) =>
        log.toStatus ===
        'PENDING',
    );

  const previousStatus =
    latestPendingLog?.metadata
      ?.previousStatus as
    | string
    | undefined;

  /*
   * Harus sama dengan rule backend:
   *
   * NEW / RESPONDED
   *     -> RESPONDED
   *
   * status operasional lainnya
   *     -> ASSIGNED
   */
  const expectedResumeStatus =
    !previousStatus ||
      [
        'NEW',
        'RESPONDED',
      ].includes(previousStatus)
      ? 'RESPONDED'
      : 'ASSIGNED';

  const setTech = (
    techId: string,
    checked: boolean,
  ) =>
    setAssign((current) => {
      const technicianIds =
        checked
          ? [
            ...new Set([
              ...current.technicianIds,
              techId,
            ]),
          ]
          : current.technicianIds.filter(
            (item) =>
              item !== techId,
          );

      return {
        ...current,

        technicianIds,

        leadTechnicianId:
          technicianIds.includes(
            current.leadTechnicianId,
          )
            ? current.leadTechnicianId
            : (
              technicianIds[0] ??
              ''
            ),
      };
    });

  const submitReschedule = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmedReason =
      reschedule.reason.trim();

    const scheduledDate =
      new Date(
        reschedule.scheduledAt,
      );

    /*
     * UI validation sebagai bantuan user.
     *
     * Backend tetap menjadi sumber
     * validasi utama melalui DTO.
     */
    if (
      trimmedReason.length < 5
    ) {
      setActionError(
        'Alasan reschedule wajib minimal 5 karakter.',
      );

      return;
    }

    if (
      !reschedule.scheduledAt ||
      Number.isNaN(
        scheduledDate.getTime(),
      )
    ) {
      setActionError(
        'Jadwal baru wajib diisi dengan tanggal dan waktu yang valid.',
      );

      return;
    }

    mutation.mutate({
      action: 'reschedule',

      path:
        `/tickets/${id}/reschedule`,

      body: {
        reason:
          trimmedReason,

        /*
         * datetime-local dari browser
         * dikonversi menjadi ISO 8601
         * sebelum dikirim ke API.
         */
        scheduledAt:
          scheduledDate.toISOString(),
      },
    });
  };

  return (
    <>
      <Link
        to="/app/tickets"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-lavender-grey-500 hover:text-alice-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar
      </Link>

      <PageHeader
        eyebrow={data.ticketCode}
        title={
          `${data.site.client.name} — ${data.site.name}`
        }
        description={
          data.description
        }
        action={
          <div className="flex gap-2">
            <Badge
              value={
                data.priority.code
              }
            />

            <Badge
              value={
                data.status
              }
            />
          </div>
        }
      />

      {actionError && (
        <div className="mb-5">
          <ErrorPanel
            error={
              new Error(
                actionError,
              )
            }
          />
        </div>
      )}

      {/*
       * ==========================================================
       * PHASE 5
       * PENDING INFORMATION PANEL
       * ==========================================================
       */}
      {data.status ===
        'PENDING' && (
          <Card className="mb-5 border-orange-200 bg-orange-50/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-orange-700" />

                  <h2 className="text-lg font-bold text-orange-950">
                    Ticket Pending /
                    Reschedule
                  </h2>
                </div>

                <p className="mt-2 text-sm leading-6 text-orange-900">
                  Ticket sedang
                  dijadwalkan ulang.
                  SLA tetap berjalan
                  selama status PENDING.
                </p>
              </div>

              <Badge value="PENDING" />
            </div>

            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-orange-200 bg-white/70 p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-orange-700">
                  Jadwal Baru
                </dt>

                <dd className="mt-1 font-semibold text-charcoal-900">
                  {formatDate(
                    data.scheduledAt,
                  )}
                </dd>
              </div>

              <div className="rounded-xl border border-orange-200 bg-white/70 p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-orange-700">
                  Status Saat Resume
                </dt>

                <dd className="mt-1 font-semibold text-charcoal-900">
                  {
                    expectedResumeStatus
                  }
                </dd>
              </div>

              <div className="rounded-xl border border-orange-200 bg-white/70 p-4 md:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-orange-700">
                  Alasan Pending
                </dt>

                <dd className="mt-1 whitespace-pre-wrap font-semibold text-charcoal-900">
                  {data.pendingReason ||
                    latestPendingLog?.reason ||
                    '—'}
                </dd>
              </div>
            </dl>
          </Card>
        )}

      <div className="grid gap-5 md:grid-cols-3">
        <SlaPanel
          title="Batas Waktu Respons"
          item={
            data.slaRespond
          }
        />

        <Card>
          <p className="text-sm font-bold text-charcoal-600">
            Total Waktu
            Pengerjaan
          </p>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-black">
              {data.workSlaAggregate
                ?.active ?? 0}{' '}
              aktif
            </p>

            <Badge
              value={
                data
                  .workSlaAggregate
                  ?.status ??
                'NOT_STARTED'
              }
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-emerald-50 p-3">
              <strong className="block text-lg text-emerald-700">
                {data
                  .workSlaAggregate
                  ?.met ?? 0}
              </strong>
              Met
            </div>

            <div className="rounded-xl bg-rose-50 p-3">
              <strong className="block text-lg text-rose-700">
                {data
                  .workSlaAggregate
                  ?.breached ??
                  0}
              </strong>
              Breach
            </div>

            <div className="rounded-xl bg-alice-blue-50 p-3">
              <strong className="block text-lg text-alice-blue-700">
                {data
                  .workSlaAggregate
                  ?.active ?? 0}
              </strong>
              Aktif
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold text-charcoal-600">
            Waktu Utama
          </p>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-lavender-grey-500">
                Dibuat
              </dt>

              <dd className="font-semibold">
                {formatDate(
                  data.createdAt,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-lavender-grey-500">
                Respons awal
              </dt>

              <dd className="font-semibold">
                {formatDate(
                  data.firstRespondedAt,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-lavender-grey-500">
                Resolved
              </dt>

              <dd className="font-semibold">
                {formatDate(
                  data.resolvedAt,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-lavender-grey-500">
                Closed
              </dt>

              <dd className="font-semibold">
                {formatDate(
                  data.closedAt,
                )}
              </dd>
            </div>

            {data.status ===
              'PENDING' && (
                <div className="flex justify-between gap-4">
                  <dt className="text-lavender-grey-500">
                    Jadwal baru
                  </dt>

                  <dd className="font-semibold text-orange-800">
                    {formatDate(
                      data.scheduledAt,
                    )}
                  </dd>
                </div>
              )}
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MessageSquare className="h-5 w-5 text-alice-blue-600" />
              Informasi dan Respons
            </h2>

            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-lavender-grey-500">
                  Reporter
                </dt>

                <dd className="font-semibold">
                  {
                    data.reporterName
                  }
                </dd>
              </div>

              <div>
                <dt className="text-lavender-grey-500">
                  PIC
                </dt>

                <dd className="font-semibold">
                  {data.picName}
                </dd>
              </div>

              <div>
                <dt className="text-lavender-grey-500">
                  Kontak
                </dt>

                <dd className="font-semibold">
                  {
                    data.contactPhoneNormalized
                  }
                </dd>
              </div>

              <div>
                <dt className="text-lavender-grey-500">
                  Kategori
                </dt>

                <dd className="font-semibold">
                  {data.category
                    ?.name ??
                    'Belum diklasifikasi'}
                </dd>
              </div>

              <div className="md:col-span-2">
                <dt className="text-lavender-grey-500">
                  Detail lokasi
                </dt>

                <dd className="font-semibold">
                  {data.locationDetail ||
                    data.site.address}
                </dd>
              </div>
            </dl>

            <div className="mt-6 space-y-3">
              {data.responses
                .length ? (
                data.responses.map(
                  (item: any) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-iron-grey-200 bg-iron-grey-50 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <Badge
                          value={
                            item.type
                          }
                        />

                        <span className="text-xs text-lavender-grey-500">
                          {formatDate(
                            item.createdAt,
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6">
                        {
                          item.message
                        }
                      </p>

                      <p className="mt-2 text-xs font-semibold text-lavender-grey-500">
                        {
                          item
                            .createdBy
                            .displayName
                        }
                      </p>
                    </div>
                  ),
                )
              ) : (
                <p className="text-sm text-lavender-grey-500">
                  Belum ada
                  respons resmi.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Users className="h-5 w-5 text-alice-blue-600" />
              Teknisi yang Bertugas
            </h2>

            {!data.assignments
              .length ? (
              <p className="mt-4 text-sm text-lavender-grey-500">
                Belum ada teknisi
                yang ditugaskan
                untuk keluhan ini.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {data.assignments.map(
                  (
                    assignment: any,
                  ) => (
                    <div
                      key={
                        assignment.id
                      }
                      className="rounded-2xl border border-iron-grey-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            Cycle{' '}
                            {
                              assignment.serviceCycleNo
                            }{' '}
                            ·{' '}
                            {
                              assignment
                                .assignedBy
                                .displayName
                            }
                          </p>

                          <p className="text-xs text-lavender-grey-500">
                            {formatDate(
                              assignment.assignedAt,
                            )}{' '}
                            ·{' '}
                            {assignment.note ||
                              'Tanpa catatan'}
                          </p>
                        </div>

                        <Badge
                          value={
                            assignment.status
                          }
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {assignment.members.map(
                          (
                            member: any,
                          ) => (
                            <div
                              key={
                                member.id
                              }
                              className="rounded-xl bg-iron-grey-50 p-4"
                            >
                              <div className="flex justify-between gap-2">
                                <div>
                                  <p className="font-bold">
                                    {
                                      member
                                        .technician
                                        .displayName
                                    }
                                  </p>

                                  <p className="text-xs text-lavender-grey-500">
                                    {member.isLead
                                      ? 'Lead Technician'
                                      : 'Member'}{' '}
                                    ·{' '}
                                    {member.requiredForResolution
                                      ? 'Wajib selesai'
                                      : 'Opsional'}
                                  </p>
                                </div>

                                <Badge
                                  value={
                                    member.status
                                  }
                                />
                              </div>

                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="font-medium text-lavender-grey-500">
                                  SLA
                                  Count
                                  Down
                                </span>

                                <SlaCountdown
                                  dueAt={
                                    member
                                      .sla
                                      ?.dueAt
                                  }
                                  status={
                                    member
                                      .sla
                                      ?.runtime
                                      ?.status
                                  }
                                  outcome={
                                    member
                                      .sla
                                      ?.runtime
                                      ?.outcome
                                  }
                                  completedAt={
                                    member.completedAt
                                  }
                                  size="sm"
                                />
                              </div>

                              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <dt className="text-lavender-grey-500">
                                    Check-in
                                  </dt>

                                  <dd className="font-semibold">
                                    {formatDate(
                                      member.firstCheckinAt,
                                    )}
                                  </dd>
                                </div>

                                <div>
                                  <dt className="text-lavender-grey-500">
                                    Selesai
                                  </dt>

                                  <dd className="font-semibold">
                                    {formatDate(
                                      member.completedAt,
                                    )}
                                  </dd>
                                </div>
                              </dl>

                              <div className="mt-3 flex flex-col items-start gap-2 empty:hidden sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                                {member
                                  .checkins?.[0] && (
                                    <a
                                      className={MEMBER_MEDIA_ACTION_CLASS}
                                      target="_blank"
                                      rel="noreferrer"
                                      href={
                                        `https://www.openstreetmap.org/?mlat=${member.checkins[0].latitude}` +
                                        `&mlon=${member.checkins[0].longitude}` +
                                        `#map=17/${member.checkins[0].latitude}/${member.checkins[0].longitude}`
                                      }
                                    >
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      Lihat
                                      Lokasi
                                      Check-in
                                    </a>
                                  )}

                                {/*
                                * ================================================
                                * BUTTON: FOTO CHECK-IN
                                * Muncul jika checkin memiliki mediaLinks
                                * ================================================
                                */}
                                {(() => {
                                  const checkinMedia: MediaItem[] =
                                    member.checkins
                                      ?.flatMap((c: any) =>
                                        (c.mediaLinks ?? []).map(
                                          (ml: any) => ({
                                            id: ml.mediaAsset?.id,
                                            mimeType:
                                              ml.mediaAsset
                                                ?.mimeType ??
                                              'image/jpeg',
                                            originalName:
                                              ml.mediaAsset
                                                ?.originalName,
                                          }),
                                        ),
                                      )
                                      .filter(
                                        (m: MediaItem) => !!m.id,
                                      ) ?? [];

                                  if (!checkinMedia.length)
                                    return null;

                                  return (
                                    <button
                                      id={`btn-checkin-photo-${member.id}`}
                                      type="button"
                                      onClick={() =>
                                        setCheckinModal({
                                          items: checkinMedia,
                                          memberId: member.id,
                                        })
                                      }
                                      className={MEMBER_MEDIA_ACTION_CLASS}
                                    >
                                      <Image className="h-3 w-3 shrink-0" />
                                      Foto Check-in
                                    </button>
                                  );
                                })()}

                                {/*
                               * ================================================
                               * BUTTON: MEDIA SELESAI
                               * Muncul jika workCompletions memiliki mediaLinks
                               * ================================================
                               */}
                                {(() => {
                                  const completionMedia: MediaItem[] =
                                    member.workCompletions
                                      ?.flatMap((wc: any) =>
                                        (wc.mediaLinks ?? []).map(
                                          (ml: any) => ({
                                            id: ml.mediaAsset?.id,
                                            mimeType:
                                              ml.mediaAsset
                                                ?.mimeType ??
                                              'image/jpeg',
                                            originalName:
                                              ml.mediaAsset
                                                ?.originalName,
                                          }),
                                        ),
                                      )
                                      .filter(
                                        (m: MediaItem) => !!m.id,
                                      ) ?? [];

                                  if (!completionMedia.length)
                                    return null;

                                  const hasVideo =
                                    completionMedia.some((m) =>
                                      m.mimeType.startsWith(
                                        'video/',
                                      ),
                                    );

                                  return (
                                    <button
                                      id={`btn-completion-media-${member.id}`}
                                      type="button"
                                      onClick={() =>
                                        setCompletionModal({
                                          items: completionMedia,
                                          memberId: member.id,
                                        })
                                      }
                                      className={MEMBER_MEDIA_ACTION_CLASS}
                                    >
                                      {hasVideo ? (
                                        <Video className="h-3 w-3 shrink-0" />
                                      ) : (
                                        <Image className="h-3 w-3 shrink-0" />
                                      )}
                                      Media Selesai
                                    </button>
                                  );
                                })()}
                              </div>

                              {member.completionSummary && (
                                <p className="mt-3 rounded-lg bg-white p-2 text-xs">
                                  {
                                    member.completionSummary
                                  }
                                </p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Clock3 className="h-5 w-5 text-alice-blue-600" />
              Timeline
            </h2>

            <div className="mt-5 space-y-4">
              {data.statusLogs.map(
                (log: any) => (
                  <div
                    key={log.id}
                    className="flex gap-3"
                  >
                    <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-alice-blue-500" />

                    <div>
                      <p className="text-sm font-bold">
                        {log.fromStatus
                          ? `${log.fromStatus} → `
                          : ''}

                        {
                          log.toStatus
                        }
                      </p>

                      <p className="text-xs text-lavender-grey-500">
                        {formatDate(
                          log.createdAt,
                        )}{' '}
                        ·{' '}
                        {log.actor
                          ?.displayName ??
                          'Public/System'}
                      </p>

                      {log.reason && (
                        <p className="mt-1 text-xs text-charcoal-600">
                          {
                            log.reason
                          }
                        </p>
                      )}

                      {log.toStatus ===
                        'PENDING' &&
                        log.metadata
                          ?.scheduledAt && (
                          <p className="mt-1 text-xs font-semibold text-orange-700">
                            Jadwal
                            baru:{' '}
                            {formatDate(
                              log
                                .metadata
                                .scheduledAt,
                            )}
                          </p>
                        )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <h2 className="text-lg font-bold">
              Aksi Lanjutan
            </h2>

            <p className="mt-1 text-sm text-lavender-grey-500">
              Pilihan tindakan
              yang bisa Anda
              lakukan saat ini.
            </p>

            {/*
             * ====================================================
             * RESPOND
             * ====================================================
             */}
            {canRespond && (
              <form
                className="mt-5 space-y-4"
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();

                  mutation.mutate({
                    action:
                      'respond',

                    path:
                      `/tickets/${id}/respond`,

                    body:
                      respond,
                  });
                }}
              >
                <Field label="Respons awal">
                  <Textarea
                    value={
                      respond.message
                    }
                    onChange={(
                      event,
                    ) =>
                      setRespond({
                        ...respond,
                        message:
                          event
                            .target
                            .value,
                      })
                    }
                    required
                  />
                </Field>

                <Field label="Prioritas">
                  <Select
                    required
                    value={
                      respond.priorityId
                    }
                    onChange={(
                      event,
                    ) =>
                      setRespond({
                        ...respond,
                        priorityId:
                          event
                            .target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Pilih prioritas
                    </option>

                    {catalog.data
                      ?.priorities.map(
                        (
                          item: any,
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {
                              item.label
                            }
                          </option>
                        ),
                      )}
                  </Select>
                </Field>

                <Field label="Kategori">
                  <Select
                    value={
                      respond.categoryId
                    }
                    onChange={(
                      event,
                    ) =>
                      setRespond({
                        ...respond,

                        categoryId:
                          event
                            .target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Pilih kategori
                    </option>

                    {catalog.data
                      ?.categories.map(
                        (
                          item: any,
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {
                              item.name
                            }
                          </option>
                        ),
                      )}
                  </Select>
                </Field>

                <Field label="Tindakan berikutnya">
                  <Input
                    value={
                      respond.nextAction
                    }
                    onChange={(
                      event,
                    ) =>
                      setRespond({
                        ...respond,

                        nextAction:
                          event
                            .target
                            .value,
                      })
                    }
                  />
                </Field>

                <Button
                  className="w-full"
                  loading={isActionPending(
                    'respond',
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Kirim Respons Awal
                </Button>
              </form>
            )}

            {/*
             * ====================================================
             * ASSIGN TECHNICIAN
             * ====================================================
             */}
            {canAssign && (
              <form
                className="mt-5 space-y-4"
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();

                  mutation.mutate({
                    action:
                      'assign',

                    path:
                      `/tickets/${id}/assignments`,

                    body:
                      assign,
                  });
                }}
              >
                <Field label="Pilih teknisi">
                  <div className="space-y-2 rounded-xl border p-3">
                    {technicians.data?.map(
                      (tech) => (
                        <label
                          key={
                            tech.id
                          }
                          className="flex items-center gap-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={assign.technicianIds.includes(
                              tech.id,
                            )}
                            onChange={(
                              event,
                            ) =>
                              setTech(
                                tech.id,
                                event
                                  .target
                                  .checked,
                              )
                            }
                          />

                          {
                            tech.displayName
                          }
                        </label>
                      ),
                    )}
                  </div>
                </Field>

                <Field label="Lead technician">
                  <Select
                    value={
                      assign.leadTechnicianId
                    }
                    onChange={(
                      event,
                    ) =>
                      setAssign({
                        ...assign,

                        leadTechnicianId:
                          event
                            .target
                            .value,
                      })
                    }
                    required
                  >
                    <option value="">
                      Pilih lead
                    </option>

                    {technicians.data
                      ?.filter(
                        (
                          tech,
                        ) =>
                          assign.technicianIds.includes(
                            tech.id,
                          ),
                      )
                      .map(
                        (
                          tech,
                        ) => (
                          <option
                            key={
                              tech.id
                            }
                            value={
                              tech.id
                            }
                          >
                            {
                              tech.displayName
                            }
                          </option>
                        ),
                      )}
                  </Select>
                </Field>

                <Field label="Catatan assignment">
                  <Textarea
                    value={
                      assign.note
                    }
                    onChange={(
                      event,
                    ) =>
                      setAssign({
                        ...assign,

                        note:
                          event
                            .target
                            .value,
                      })
                    }
                  />
                </Field>

                <Button
                  className="w-full"
                  loading={isActionPending(
                    'assign',
                  )}
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Teknisi
                </Button>
              </form>
            )}

            {/*
             * ====================================================
             * RESOLVE
             * ====================================================
             */}
            {canResolve && (
              <form
                className="mt-5 space-y-4"
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();

                  mutation.mutate({
                    action:
                      'resolve',

                    path:
                      `/tickets/${id}/resolve`,

                    body: {
                      summary:
                        resolution,
                    },
                  });
                }}
              >
                <Field label="Ringkasan resolusi">
                  <Textarea
                    value={
                      resolution
                    }
                    onChange={(
                      event,
                    ) =>
                      setResolution(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                  />
                </Field>

                <Button
                  className="w-full"
                  loading={isActionPending(
                    'resolve',
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Ajukan Resolved
                </Button>
              </form>
            )}

            {/*
             * ====================================================
             * PHASE 5
             * RESCHEDULE / PENDING
             * ====================================================
             */}
            {canReschedule && (
              <div className="mt-5 border-t border-iron-grey-200 pt-5">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-orange-700" />

                    <h3 className="font-bold text-charcoal-900">
                      Pending /
                      Reschedule
                    </h3>
                  </div>

                  <p className="mt-1 text-xs leading-5 text-lavender-grey-500">
                    Gunakan jika
                    pekerjaan harus
                    dijadwalkan ulang.
                    SLA tidak dihentikan
                    saat ticket berstatus
                    PENDING.
                  </p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={
                    submitReschedule
                  }
                >
                  <Field
                    label="Alasan reschedule"
                    hint="Wajib diisi minimal 5 karakter."
                  >
                    <Textarea
                      value={
                        reschedule.reason
                      }
                      onChange={(
                        event,
                      ) =>
                        setReschedule({
                          ...reschedule,

                          reason:
                            event
                              .target
                              .value,
                        })
                      }
                      minLength={
                        5
                      }
                      required
                    />
                  </Field>

                  <Field
                    label="Jadwal baru"
                    hint="Tanggal dan waktu akan dikirim ke backend dalam format ISO 8601."
                  >
                    <Input
                      type="datetime-local"
                      value={
                        reschedule.scheduledAt
                      }
                      onChange={(
                        event,
                      ) =>
                        setReschedule({
                          ...reschedule,

                          scheduledAt:
                            event
                              .target
                              .value,
                        })
                      }
                      required
                    />
                  </Field>

                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full border-orange-300 text-orange-800 hover:bg-orange-50"
                    loading={isActionPending(
                      'reschedule',
                    )}
                  >
                    <Clock3 className="h-4 w-4" />
                    Set Pending /
                    Reschedule
                  </Button>
                </form>
              </div>
            )}

            {/*
             * ====================================================
             * PHASE 5
             * RESUME PENDING
             * ====================================================
             */}
            {canResume && (
              <div className="mt-5 border-t border-iron-grey-200 pt-5">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-bold text-orange-950">
                    Resume Ticket
                  </p>

                  <p className="mt-1 text-xs leading-5 text-orange-900">
                    Ticket akan
                    dilanjutkan ke
                    status{' '}
                    <strong>
                      {
                        expectedResumeStatus
                      }
                    </strong>{' '}
                    sesuai state sebelum
                    PENDING.
                  </p>
                </div>

                <form
                  className="mt-4 space-y-4"
                  onSubmit={(
                    event,
                  ) => {
                    event.preventDefault();

                    mutation.mutate({
                      action:
                        'resume',

                      path:
                        `/tickets/${id}/resume`,

                      body: {
                        note:
                          resumeNote.trim() ||
                          undefined,
                      },
                    });
                  }}
                >
                  <Field
                    label="Catatan resume"
                    hint="Opsional."
                  >
                    <Textarea
                      value={
                        resumeNote
                      }
                      onChange={(
                        event,
                      ) =>
                        setResumeNote(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Contoh: Jadwal teknisi sudah dikonfirmasi."
                    />
                  </Field>

                  <Button
                    className="w-full"
                    loading={isActionPending(
                      'resume',
                    )}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Resume Ticket
                  </Button>
                </form>
              </div>
            )}

            {/*
             * ====================================================
             * CLOSE
             * ====================================================
             */}
            {canClose && (
              <div className="mt-5">
                <Button
                  className="w-full"
                  loading={isActionPending(
                    'close',
                  )}
                  onClick={() =>
                    mutation.mutate({
                      action:
                        'close',

                      path:
                        `/tickets/${id}/close`,

                      body: {
                        verificationNote:
                          'Diverifikasi melalui web console.',
                      },
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verifikasi & Close
                </Button>
              </div>
            )}

            {/*
             * ====================================================
             * REOPEN
             * ====================================================
             */}
            {canReopen && (
              <form
                className="mt-5 space-y-3"
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();

                  mutation.mutate({
                    action:
                      'reopen',

                    path:
                      `/tickets/${id}/reopen`,

                    body: {
                      reason,
                    },
                  });
                }}
              >
                <Field label="Alasan reopen">
                  <Textarea
                    value={
                      reason
                    }
                    onChange={(
                      event,
                    ) =>
                      setReason(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                  />
                </Field>

                <Button
                  variant="secondary"
                  className="w-full"
                  loading={isActionPending(
                    'reopen',
                  )}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reopen Ticket
                </Button>
              </form>
            )}

            {!hasAvailableAction && (
              <p className="mt-5 rounded-xl bg-iron-grey-50 p-4 text-sm text-lavender-grey-500">
                Saat ini belum ada
                tindakan lanjutan yang
                bisa Anda lakukan.
              </p>
            )}
          </Card>

          {currentAssignment && (
            <Card>
              <h3 className="flex items-center gap-2 font-bold">
                <Wrench className="h-4 w-4" />
                Assignment Aktif
              </h3>

              <p className="mt-2 text-sm text-lavender-grey-500">
                {
                  currentAssignment
                    .members.length
                }{' '}
                teknisi pada cycle{' '}
                {
                  currentAssignment.serviceCycleNo
                }
                .
              </p>
            </Card>
          )}
        </aside>
      </div>

      {/*
       * ============================================================
       * MODAL: FOTO CHECK-IN
       * ============================================================
       */}
      {checkinModal && (
        <MediaModal
          items={checkinModal.items}
          title="Foto Check-in"
          onClose={() => setCheckinModal(null)}
        />
      )}

      {/*
       * ============================================================
       * MODAL: MEDIA SELESAI (FOTO / VIDEO)
       * ============================================================
       */}
      {completionModal && (
        <MediaModal
          items={completionModal.items}
          title="Media Selesai"
          onClose={() => setCompletionModal(null)}
        />
      )}
    </>
  );
}
