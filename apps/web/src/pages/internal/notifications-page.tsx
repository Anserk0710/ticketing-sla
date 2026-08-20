import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/http-client';
import { EmptyState } from '../../components/data-display/empty-state';
import { PageHeader } from '../../components/data-display/page-header';
import {
  ErrorPanel,
  Loading,
} from '../../components/feedback/loading';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import type { NotificationItem } from '../../types/api';
import { formatDate } from '../../utils/format';

export function NotificationsPage() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const query =
    useQuery({
      queryKey: [
        'notifications',
        'all',
      ],

      queryFn: () =>
        apiRequest<
          NotificationItem[]
        >('/notifications'),

      refetchInterval:
        30_000,
    });

  /*
   * Mark one notification as read.
   *
   * Gunakan optimistic update supaya:
   * - card langsung berubah menjadi read;
   * - badge langsung berkurang;
   * - user tidak perlu menunggu network round-trip.
   */
  const readOne =
    useMutation({
      mutationFn:
        (
          notificationId:
            string,
        ) =>
          apiRequest<{
            count: number;
          }>(
            `/notifications/${notificationId}/read`,
            {
              method:
                'POST',

              body:
                '{}',
            },
          ),

      onMutate:
        async (
          notificationId,
        ) => {
          await queryClient.cancelQueries({
            queryKey: [
              'notifications',
              'all',
            ],
          });

          const previous =
            queryClient.getQueryData<
              NotificationItem[]
            >([
              'notifications',
              'all',
            ]);

          const previousUnreadCount =
            queryClient.getQueryData<{
              count: number;
            }>([
              'notifications',
              'unread-count',
            ]);

          queryClient.setQueryData<
            NotificationItem[]
          >(
            [
              'notifications',
              'all',
            ],

            (current) =>
              current?.map(
                (item) =>
                  item.id ===
                    notificationId &&
                    !item.readAt
                    ? {
                      ...item,

                      readAt:
                        new Date()
                          .toISOString(),
                    }
                    : item,
              ) ??
              current,
          );

          queryClient.setQueryData<{
            count: number;
          }>(
            [
              'notifications',
              'unread-count',
            ],

            (current) => ({
              count:
                Math.max(
                  0,
                  (
                    current
                      ?.count ??
                    0
                  ) - 1,
                ),
            }),
          );

          return {
            previous,
            previousUnreadCount,
          };
        },

      /*
       * Bila request gagal, kembalikan
       * cache ke kondisi sebelumnya.
       */
      onError:
        (
          _error,
          _notificationId,
          context,
        ) => {
          if (
            context?.previous
          ) {
            queryClient.setQueryData(
              [
                'notifications',
                'all',
              ],

              context.previous,
            );
          }

          if (
            context
              ?.previousUnreadCount
          ) {
            queryClient.setQueryData(
              [
                'notifications',
                'unread-count',
              ],

              context
                .previousUnreadCount,
            );
          }
        },

      onSettled:
        async () => {
          /*
           * Synchronize kembali dengan
           * source of truth backend.
           */
          await queryClient.invalidateQueries({
            queryKey: [
              'notifications',
            ],
          });
        },
    });

  const readAll =
    useMutation({
      mutationFn: () =>
        apiRequest<{
          count: number;
        }>(
          '/notifications/read-all',
          {
            method:
              'POST',

            body:
              '{}',
          },
        ),

      onSuccess:
        async () => {
          await queryClient.invalidateQueries({
            queryKey: [
              'notifications',
            ],
          });
        },
    });

  if (
    query.isLoading
  ) {
    return <Loading />;
  }

  if (
    query.error
  ) {
    return (
      <ErrorPanel
        error={query.error}
      />
    );
  }

  const notifications =
    query.data ?? [];

  const hasUnread =
    notifications.some(
      (item) =>
        !item.readAt,
    );

  const openNotification =
    (
      item:
        NotificationItem,
    ) => {
      /*
       * Klik notification unread:
       * request mark-read langsung dikirim.
       */
      if (
        !item.readAt
      ) {
        readOne.mutate(
          item.id,
        );
      }

      /*
       * Ticket/assignment notification
       * langsung membuka detail ticket.
       */
      if (
        item.targetUrl
      ) {
        navigate(
          item.targetUrl,
        );
      }
    };

  return (
    <>
      <PageHeader
        eyebrow="In-App Notification"
        title="Notifikasi"
        description="Event ticket, assignment, warning, dan breach SLA diperbarui melalui polling. Klik notifikasi untuk membuka target terkait."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              readAll.mutate()
            }
            loading={
              readAll.isPending
            }
            disabled={
              !hasUnread
            }
          >
            <CheckCheck className="h-4 w-4" />
            Tandai Semua Dibaca
          </Button>
        }
      />

      {!notifications.length ? (
        <EmptyState
          title="Belum ada notifikasi"
          description="Notifikasi operasional akan muncul ketika terdapat event baru."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map(
            (item) => {
              const isUnread =
                !item.readAt;

              /*
               * Notification tanpa targetUrl masih
               * clickable bila unread agar user tetap
               * dapat menandainya sebagai read.
               */
              const isClickable =
                Boolean(
                  item.targetUrl,
                ) ||
                isUnread;

              return (
                <Card
                  key={item.id}
                  role={
                    isClickable
                      ? 'button'
                      : undefined
                  }
                  tabIndex={
                    isClickable
                      ? 0
                      : undefined
                  }
                  aria-label={
                    isClickable
                      ? `${item.title}. ${isUnread
                        ? 'Belum dibaca.'
                        : 'Sudah dibaca.'
                      }`
                      : undefined
                  }
                  onClick={
                    isClickable
                      ? () =>
                        openNotification(
                          item,
                        )
                      : undefined
                  }
                  onKeyDown={
                    isClickable
                      ? (
                        event,
                      ) => {
                        if (
                          event.key ===
                          'Enter' ||
                          event.key ===
                          ' '
                        ) {
                          event.preventDefault();

                          openNotification(
                            item,
                          );
                        }
                      }
                      : undefined
                  }
                  className={
                    isUnread
                      ? 'cursor-pointer border-alice-blue-300 bg-alice-blue-50/60 shadow-md shadow-alice-blue-100/50 outline-none transition hover:border-alice-blue-400 hover:bg-alice-blue-50 focus:ring-2 focus:ring-alice-blue-500 focus:ring-offset-2'
                      : isClickable
                        ? 'cursor-pointer bg-white opacity-80 outline-none transition hover:border-lavender-grey-300 hover:opacity-100 focus:ring-2 focus:ring-lavender-grey-400 focus:ring-offset-2'
                        : 'bg-white opacity-70'
                  }
                >
                  <div className="flex gap-4">
                    <span
                      className={
                        isUnread
                          ? 'relative rounded-xl bg-alice-blue-100 p-3 text-alice-blue-700'
                          : 'rounded-xl bg-lavender-grey-100 p-3 text-charcoal-500'
                      }
                    >
                      <Bell className="h-5 w-5" />

                      {isUnread && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2
                            className={
                              isUnread
                                ? 'truncate font-extrabold text-charcoal-950'
                                : 'truncate font-semibold text-charcoal-700'
                            }
                          >
                            {
                              item.title
                            }
                          </h2>

                          {isUnread && (
                            <span className="rounded-full bg-alice-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Baru
                            </span>
                          )}
                        </div>

                        <Badge
                          value={
                            item.type
                          }
                        />
                      </div>

                      <p
                        className={`mt-1 text-sm ${isUnread
                            ? 'text-charcoal-800'
                            : 'text-charcoal-500'
                          }`}
                      >
                        {
                          item.body
                        }
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-lavender-grey-400">
                          {formatDate(
                            item.createdAt,
                          )}
                        </p>

                        {item.targetUrl && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-alice-blue-700">
                            Buka detail

                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            },
          )}
        </div>
      )}
    </>
  );
}