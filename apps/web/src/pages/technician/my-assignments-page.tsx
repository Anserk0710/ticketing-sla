import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  CheckCircle2,
  Clock3,
  FileImage,
  FileVideo,
  LocateFixed,
  Play,
  Upload,
  X,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  apiRequest,
  uploadMedia,
} from '../../api/http-client';

import {
  EmptyState,
} from '../../components/data-display/empty-state';

import {
  PageHeader,
} from '../../components/data-display/page-header';

import {
  SlaCountdown,
} from '../../components/data-display/sla-countdown';

import {
  ErrorPanel,
  Loading,
} from '../../components/feedback/loading';

import {
  Badge,
} from '../../components/ui/badge';

import {
  Button,
} from '../../components/ui/button';

import {
  Card,
} from '../../components/ui/card';

import {
  Field,
  Input,
  Textarea,
} from '../../components/ui/field';

import {
  formatDate,
  formatDuration,
} from '../../utils/format';

type Mode =
  | 'checkin'
  | 'complete'
  | null;

type ActionName =
  | 'accept'
  | 'checkin'
  | 'start'
  | 'complete';

type MutationPayload = {
  action: ActionName;
  path: string;
  body?: unknown;
};

const CHECKIN_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const COMPLETION_MEDIA_TYPES = [
  ...CHECKIN_IMAGE_TYPES,
  // Video — semua format default berbagai device
  'video/mp4',        // Android, Windows, iPhone (H.264/H.265)
  'video/quicktime',  // iPhone/iPad (.mov)
  'video/3gpp',       // Samsung & Android lama (.3gp)
  'video/3gpp2',      // Android (.3g2)
  'video/webm',       // Browser/Android Chrome (.webm)
  'video/x-msvideo',  // Windows (.avi)
  'video/x-matroska', // MKV (.mkv)
  'video/x-m4v',      // Apple M4V (.m4v)
  'video/ogg',        // OGG video (.ogv)
  'video/mpeg',       // MPEG (.mpeg/.mpg)
] as const;

function isCheckinImage(
  file: File,
): boolean {
  return (
    CHECKIN_IMAGE_TYPES as readonly string[]
  ).includes(file.type);
}

function isCompletionMedia(
  file: File,
): boolean {
  return (
    COMPLETION_MEDIA_TYPES as readonly string[]
  ).includes(file.type);
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

export function MyAssignmentsPage() {
  const qc =
    useQueryClient();

  const [
    activeId,
    setActiveId,
  ] = useState<
    string | null
  >(null);

  const [
    mode,
    setMode,
  ] = useState<Mode>(
    null,
  );

  const [
    summary,
    setSummary,
  ] = useState('');

  const [
    address,
    setAddress,
  ] = useState('');

  /*
   * Phase 6:
   * Check-in hanya boleh tepat 1 foto.
   */
  const [
    checkinFile,
    setCheckinFile,
  ] = useState<
    File | null
  >(null);

  /*
   * Phase 6:
   * Completion mendukung multi-upload.
   */
  const [
    completionFiles,
    setCompletionFiles,
  ] = useState<File[]>(
    [],
  );

  const [
    operationError,
    setOperationError,
  ] = useState('');

  /*
   * Upload dilakukan sebelum action.
   * State ini dipisahkan dari mutation
   * karena proses upload terjadi sebelum
   * request check-in/completion.
   */
  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  /*
   * ID member yang sedang menampilkan
   * panel info checkin (sudah ON_SITE).
   */
  const [
    checkinInfoId,
    setCheckinInfoId,
  ] = useState<
    string | null
  >(null);

  const query = useQuery({
    queryKey: [
      'my-assignments',
    ],

    queryFn: () =>
      apiRequest<any[]>(
        '/technician/assignments',
      ),
  });

  const resetActionForm =
    () => {
      setActiveId(null);
      setMode(null);
      setSummary('');
      setAddress('');
      setCheckinFile(
        null,
      );
      setCompletionFiles(
        [],
      );
    };

  const mutation =
    useMutation({
      mutationFn:
        async ({
          path,
          body,
        }: MutationPayload) =>
          apiRequest(path, {
            method: 'POST',

            body:
              body !==
                undefined
                ? JSON.stringify(
                  body,
                )
                : undefined,
          }),

      onSuccess:
        async () => {
          resetActionForm();

          setOperationError(
            '',
          );

          await qc.invalidateQueries({
            queryKey: [
              'my-assignments',
            ],
          });
        },

      onError:
        (error) => {
          setOperationError(
            error instanceof
              Error
              ? error.message
              : 'Aksi gagal.',
          );
        },
    });

  const isActionPending =
    (
      action: ActionName,
    ) =>
      mutation.isPending &&
      mutation.variables
        ?.action ===
      action;

  const openAction = (
    memberId: string,
    nextMode: Mode,
  ) => {
    setOperationError(
      '',
    );

    setActiveId(
      memberId,
    );

    setMode(
      nextMode,
    );

    setSummary('');
    setAddress('');

    setCheckinFile(
      null,
    );

    setCompletionFiles(
      [],
    );
  };

  const closeAction =
    () => {
      resetActionForm();

      setOperationError(
        '',
      );
    };

  const handleCheckinFile =
    (
      files:
        FileList | null,
    ) => {
      setOperationError(
        '',
      );

      if (
        !files ||
        files.length === 0
      ) {
        setCheckinFile(
          null,
        );

        return;
      }

      /*
       * Input check-in tidak menggunakan
       * multiple, tetapi validasi ini tetap
       * dipertahankan agar rule eksplisit.
       */
      if (
        files.length !== 1
      ) {
        setCheckinFile(
          null,
        );

        setOperationError(
          'Check-in hanya boleh menggunakan tepat 1 foto.',
        );

        return;
      }

      const selected =
        files[0];

      if (
        !isCheckinImage(
          selected,
        )
      ) {
        setCheckinFile(
          null,
        );

        setOperationError(
          'Check-in hanya menerima foto JPEG, PNG, atau WEBP. Video tidak diperbolehkan.',
        );

        return;
      }

      setCheckinFile(
        selected,
      );
    };

  const handleCompletionFiles =
    (
      files:
        FileList | null,
    ) => {
      setOperationError(
        '',
      );

      if (
        !files ||
        files.length === 0
      ) {
        return;
      }

      const selected =
        Array.from(
          files,
        );

      const invalid =
        selected.filter(
          (file) =>
            !isCompletionMedia(
              file,
            ),
        );

      if (
        invalid.length >
        0
      ) {
        setOperationError(
          `File tidak didukung: ${invalid
            .map(
              (file) =>
                file.name,
            )
            .join(
              ', ',
            )}. Completion hanya menerima JPEG, PNG, WEBP, atau MP4.`,
        );

        return;
      }

      /*
       * Append file baru ke list yang
       * sudah ada — tidak mereplace.
       */
      setCompletionFiles(
        (current) => [
          ...current,
          ...selected,
        ],
      );
    };

  async function checkin(
    memberId: string,
  ) {
    setOperationError(
      '',
    );

    /*
     * Phase 6:
     * Jangan meminta lokasi maupun upload
     * jika foto belum dipilih.
     */
    if (
      !checkinFile
    ) {
      setOperationError(
        'Foto kedatangan wajib dipilih sebelum check-in.',
      );

      return;
    }

    if (
      !isCheckinImage(
        checkinFile,
      )
    ) {
      setOperationError(
        'Check-in hanya menerima foto JPEG, PNG, atau WEBP.',
      );

      return;
    }

    if (
      !navigator.geolocation
    ) {
      setOperationError(
        'Browser tidak mendukung geolocation.',
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (
        position,
      ) => {
        try {
          setIsUploading(
            true,
          );

          /*
           * PHASE 6:
           *
           * Upload dahulu.
           *
           * Baru setelah upload berhasil
           * request check-in dikirim.
           */
          const media =
            await uploadMedia(
              checkinFile,
            );

          setIsUploading(
            false,
          );

          mutation.mutate({
            action:
              'checkin',

            path:
              `/technician/assignments/${memberId}/checkins`,

            body: {
              latitude:
                position
                  .coords
                  .latitude,

              longitude:
                position
                  .coords
                  .longitude,

              accuracyMeters:
                position
                  .coords
                  .accuracy,

              deviceCapturedAt:
                new Date(
                  position.timestamp,
                ).toISOString(),

              addressSnapshot:
                address.trim() ||
                undefined,

              /*
               * Selalu array tepat 1.
               */
              mediaIds: [
                media.id,
              ],
            },
          });
        } catch (
        error
        ) {
          setIsUploading(
            false,
          );

          setOperationError(
            error instanceof
              Error
              ? error.message
              : 'Upload foto check-in gagal.',
          );
        }
      },

      (
        error,
      ) => {
        setOperationError(
          `Lokasi tidak tersedia: ${error.message}`,
        );
      },

      {
        enableHighAccuracy:
          true,
        timeout: 15_000,
      },
    );
  }

  async function complete(
    memberId: string,
  ) {
    setOperationError(
      '',
    );

    const trimmedSummary =
      summary.trim();

    if (
      !trimmedSummary
    ) {
      setOperationError(
        'Ringkasan pekerjaan wajib diisi.',
      );

      return;
    }

    /*
     * Phase 6:
     * Completion wajib minimal 1 media.
     */
    if (
      completionFiles.length <
      1
    ) {
      setOperationError(
        'Bukti penyelesaian wajib memiliki minimal 1 foto atau video.',
      );

      return;
    }

    const invalid =
      completionFiles.filter(
        (file) =>
          !isCompletionMedia(
            file,
          ),
      );

    if (
      invalid.length >
      0
    ) {
      setOperationError(
        'Completion hanya menerima foto JPEG/PNG/WEBP atau video MP4.',
      );

      return;
    }

    try {
      setIsUploading(
        true,
      );

      /*
       * Phase 6:
       *
       * SEMUA FILE di-upload dahulu.
       *
       * Promise.all memastikan request
       * /complete baru dilakukan setelah
       * semua upload selesai.
       *
       * Bila salah satu upload gagal,
       * mutation complete tidak dipanggil.
       */
      const uploaded =
        await Promise.all(
          completionFiles.map(
            (file) =>
              uploadMedia(
                file,
              ),
          ),
        );

      const mediaIds =
        uploaded.map(
          (media) =>
            media.id,
        );

      setIsUploading(
        false,
      );

      mutation.mutate({
        action:
          'complete',

        path:
          `/technician/assignments/${memberId}/complete`,

        body: {
          summary:
            trimmedSummary,

          mediaIds,
        },
      });
    } catch (
    error
    ) {
      setIsUploading(
        false,
      );

      setOperationError(
        error instanceof
          Error
          ? error.message
          : 'Upload bukti penyelesaian gagal.',
      );
    }
  }

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
        error={
          query.error
        }
      />
    );
  }

  const items =
    query.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Ruang Kerja Teknisi"
        title="Tugas Saya"
        description="Terima tugas, lakukan check-in dengan bukti foto, mulai pekerjaan, dan kirim bukti penyelesaian."
      />

      {operationError && (
        <div className="mb-5">
          <ErrorPanel
            error={
              new Error(
                operationError,
              )
            }
          />
        </div>
      )}

      {!items.length ? (
        <EmptyState
          title="Belum ada tugas untuk Anda"
          description="Tugas baru yang diberikan kepada Anda akan muncul di sini. Selamat beristirahat!"
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {items.map(
            (
              member,
            ) => {
              const ticket =
                member
                  .assignment
                  .ticket;

              const open =
                activeId ===
                member.id;

              const ticketPending =
                ticket.status ===
                'PENDING';

              const ticketOperational =
                ticket.status ===
                  'ASSIGNED' ||
                ticket.status ===
                  'IN_PROGRESS' ||
                ticket.status ===
                  'ON_SITE';


              /*
               * Assignment/member juga wajib masih aktif.
               *
               * Ini membantu UI mengikuti hardening C-01.
               */
              const assignmentActive =
                member.assignment
                  .status ===
                  'ACTIVE' &&
                !member.assignment
                  .endedAt &&
                !member.endedAt;


              const canOperate =
                !ticketPending &&
                ticketOperational &&
                assignmentActive;


              /*
               * H-01 / Opsi A
               *
               * Setiap technician mempunyai lifecycle sendiri:
               *
               * ASSIGNED
               *   -> Accept
               * ACCEPTED
               *   -> Check-in
               * ON_SITE
               *   -> Start
               * IN_PROGRESS
               *   -> Complete
               */
              const canAccept =
                canOperate &&
                member.status ===
                  'ASSIGNED';


              const canCheckinNew =
                canOperate &&
                member.status ===
                  'ACCEPTED';


              const canStart =
                canOperate &&
                member.status ===
                  'ON_SITE';


              const canComplete =
                canOperate &&
                member.status ===
                  'IN_PROGRESS';


              /*
               * Data check-in tetap dapat dilihat setelah
               * pekerjaan sudah dimulai atau selesai.
               *
               * Sebelumnya tombol info check-in hilang begitu
               * status berubah dari ON_SITE.
               */
              const alreadyCheckedIn =
                Boolean(
                  member.firstCheckinAt,
                ) &&
                Boolean(
                  member.checkins?.[0],
                );

              return (
                <Card
                  key={
                    member.id
                  }
                  className="flex flex-col"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        to={
                          `/app/tickets/${ticket.id}`
                        }
                        className="font-mono text-sm font-bold text-alice-blue-700"
                      >
                        {
                          ticket.ticketCode
                        }
                      </Link>

                      <h2 className="mt-1 text-xl font-bold">
                        {
                          ticket
                            .site
                            .client
                            .name
                        }{' '}
                        —{' '}
                        {
                          ticket
                            .site
                            .name
                        }
                      </h2>

                      <p className="mt-1 text-sm text-lavender-grey-500">
                        {
                          ticket.description
                        }
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        value={
                          ticket
                            .priority
                            .code
                        }
                      />

                      <Badge
                        value={
                          ticket.status
                        }
                      />

                      <Badge
                        value={
                          member.status
                        }
                      />
                    </div>
                  </div>

                  {ticketPending && (
                    <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <div className="flex items-start gap-3">
                        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />

                        <div>
                          <p className="font-bold text-orange-950">
                            Ticket sedang
                            Pending /
                            Reschedule
                          </p>

                          <p className="mt-1 text-sm leading-6 text-orange-900">
                            Aksi
                            operasional
                            teknisi
                            sementara
                            tidak dapat
                            dilakukan.
                            Tunggu Head
                            atau
                            Administrator
                            melanjutkan
                            ticket.
                          </p>

                          {ticket.scheduledAt && (
                            <p className="mt-2 text-xs font-semibold text-orange-800">
                              Jadwal baru:{' '}
                              {formatDate(
                                ticket.scheduledAt,
                              )}
                            </p>
                          )}

                          {ticket.pendingReason && (
                            <p className="mt-1 text-xs text-orange-800">
                              Alasan:{' '}
                              {
                                ticket.pendingReason
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div>
                      <p className="text-xs text-lavender-grey-500">
                        Role
                      </p>

                      <p className="font-semibold">
                        {member.isLead
                          ? 'Lead'
                          : 'Member'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-lavender-grey-500">
                        Assigned
                      </p>

                      <p className="font-semibold">
                        {formatDate(
                          member.assignedAt,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-lavender-grey-500">
                        Accepted
                      </p>

                      <p className="font-semibold">
                        {member.acceptedAt
                          ? formatDate(
                              member.acceptedAt,
                            )
                          : 'Belum diterima'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-lavender-grey-500">
                        SLA Target
                      </p>

                      <p className="font-semibold">
                        {formatDuration(
                          member
                            .sla
                            ?.targetSeconds,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-lavender-grey-500">
                        SLA Countdown
                      </p>

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
                  </div>

                  {/*
                   * =====================================================
                   * PHASE 6 — TECHNICIAN WORKFLOW
                   *
                   * Opsi A:
                   *
                   * setiap technician wajib:
                   *
                   * ASSIGNED
                   *   -> Accept
                   * ACCEPTED
                   *   -> Check-in + 1 foto
                   * ON_SITE
                   *   -> Start Work
                   * IN_PROGRESS
                   *   -> Complete + media
                   *
                   * Tidak ada Reject / Tolak.
                   * =====================================================
                   */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {canAccept && (
                      <>
                        <div className="w-full rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                          <span className="font-semibold">
                            Tugas baru.
                          </span>{' '}
                          Terima assignment terlebih dahulu sebelum menuju proses Check-in.
                        </div>

                        <Button
                          loading={
                            isActionPending(
                              'accept',
                            )
                          }
                          disabled={
                            mutation.isPending
                          }
                          onClick={() =>
                            mutation.mutate({
                              action:
                                'accept',

                              path:
                                `/technician/assignments/${member.id}/accept`,
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />

                          Terima Tugas
                        </Button>
                      </>
                    )}

                    {canCheckinNew && (
                      <>
                        <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          <span className="font-semibold">
                            Tugas sudah diterima.
                          </span>{' '}
                          Setelah tiba di lokasi, lakukan Check-in dengan tepat 1 foto bukti kedatangan.
                        </div>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            openAction(
                              member.id,
                              'checkin',
                            )
                          }
                        >
                          <LocateFixed className="h-4 w-4" />

                          Check-in di Lokasi
                        </Button>
                      </>
                    )}

                    {alreadyCheckedIn && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setCheckinInfoId(
                            checkinInfoId ===
                              member.id
                              ? null
                              : member.id,
                          )
                        }
                      >
                        <LocateFixed className="h-4 w-4" />

                        {checkinInfoId ===
                        member.id
                          ? 'Sembunyikan Check-in'
                          : 'Lihat Data Check-in'}
                      </Button>
                    )}

                    {canStart && (
                      <Button
                        loading={
                          isActionPending(
                            'start',
                          )
                        }
                        disabled={
                          mutation.isPending
                        }
                        onClick={() =>
                          mutation.mutate({
                            action:
                              'start',

                            path:
                              `/technician/assignments/${member.id}/start`,

                            body: {
                              note:
                                'Pekerjaan dimulai dari web.',
                            },
                          })
                        }
                      >
                        <Play className="h-4 w-4" />

                        Mulai Pekerjaan
                      </Button>
                    )}

                    {canComplete && (
                      <Button
                        disabled={
                          mutation.isPending
                        }
                        onClick={() =>
                          openAction(
                            member.id,
                            'complete',
                          )
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />

                        Selesaikan
                      </Button>
                    )}
                  </div>

                  {/*
                   * =====================================================
                   * PANEL INFO CHECK-IN (sudah ON_SITE)
                   * =====================================================
                   */}
                  {checkinInfoId ===
                    member.id &&
                    alreadyCheckedIn && (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                          <div className="w-full">
                            <h3 className="font-bold text-emerald-900">
                              Data Check-in
                            </h3>

                            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                              {(member as any).checkins[0].serverReceivedAt && (
                                <div>
                                  <dt className="text-xs text-emerald-700">Waktu Check-in</dt>
                                  <dd className="font-semibold text-emerald-950">
                                    {formatDate((member as any).checkins[0].serverReceivedAt)}
                                  </dd>
                                </div>
                              )}

                              {(member as any).checkins[0].latitude != null && (
                                <div>
                                  <dt className="text-xs text-emerald-700">Koordinat</dt>
                                  <dd className="font-semibold text-emerald-950">
                                    {(member as any).checkins[0].latitude.toFixed(6)},&nbsp;
                                    {(member as any).checkins[0].longitude.toFixed(6)}
                                  </dd>
                                </div>
                              )}

                              {(member as any).checkins[0].accuracyMeters != null && (
                                <div>
                                  <dt className="text-xs text-emerald-700">Akurasi GPS</dt>
                                  <dd className="font-semibold text-emerald-950">
                                    {(member as any).checkins[0].accuracyMeters.toFixed(1)} m
                                  </dd>
                                </div>
                              )}

                              {(member as any).checkins[0].addressSnapshot && (
                                <div className="sm:col-span-2">
                                  <dt className="text-xs text-emerald-700">Alamat</dt>
                                  <dd className="font-semibold text-emerald-950">
                                    {(member as any).checkins[0].addressSnapshot}
                                  </dd>
                                </div>
                              )}
                            </dl>

                            {(member as any).checkins[0].latitude != null && (
                              <a
                                href={
                                  `https://www.openstreetmap.org/?mlat=${(member as any).checkins[0].latitude}` +
                                  `&mlon=${(member as any).checkins[0].longitude}` +
                                  `#map=17/${(member as any).checkins[0].latitude}/${(member as any).checkins[0].longitude}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                <LocateFixed className="h-3.5 w-3.5" />
                                Buka di OpenStreetMap
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/*
                   * =====================================================
                   * CHECK-IN FORM
                   *
                   * Hanya setelah technician Accept:
                   *
                   * ACCEPTED -> ON_SITE
                   * =====================================================
                   */}
                  {open &&
                    mode ===
                      'checkin' &&
                    canCheckinNew && (
                      <div className="mt-5 rounded-xl border bg-iron-grey-50 p-4">
                        <div>
                          <h3 className="font-bold text-slate-900">
                            Check-in Lokasi
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Anda sudah menerima tugas ini. Ambil tepat 1 foto sebagai bukti bahwa Anda telah tiba di lokasi pekerjaan.
                          </p>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <Field label="Alamat/keterangan lokasi">
                            <Input
                              value={
                                address
                              }
                              onChange={(
                                event,
                              ) =>
                                setAddress(
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Alamat hasil reverse geocoding atau patokan"
                            />
                          </Field>

                          <Field
                            label="Foto kedatangan"
                            hint="Wajib tepat 1 foto JPEG, PNG, atau WEBP. Browser akan meminta izin lokasi ketika Check-in."
                          >
                            <Input
                              type="file"

                              /*
                               * TIDAK menggunakan multiple.
                               */
                              accept="image/jpeg,image/png,image/webp"

                              capture="environment"

                              onChange={(
                                event,
                              ) =>
                                handleCheckinFile(
                                  event
                                    .target
                                    .files,
                                )
                              }

                              required
                            />
                          </Field>

                          {checkinFile && (
                            <div className="flex items-center gap-3 rounded-xl border border-iron-grey-200 bg-white p-3">
                              <FileImage className="h-5 w-5 shrink-0 text-alice-blue-600" />

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-charcoal-900">
                                  {
                                    checkinFile.name
                                  }
                                </p>

                                <p className="text-xs text-lavender-grey-500">
                                  {
                                    checkinFile.type
                                  }{' '}
                                  ·{' '}
                                  {formatFileSize(
                                    checkinFile.size,
                                  )}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setCheckinFile(
                                    null,
                                  )
                                }
                                className="rounded-lg p-1.5 text-lavender-grey-500 hover:bg-iron-grey-100 hover:text-charcoal-800"
                                aria-label="Hapus foto check-in"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            loading={
                              isUploading ||
                              isActionPending(
                                'checkin',
                              )
                            }
                            disabled={
                              !checkinFile
                            }
                            onClick={() =>
                              void checkin(
                                member.id,
                              )
                            }
                          >
                            <LocateFixed className="h-4 w-4" />

                            Ambil
                            Lokasi &
                            Check-in
                          </Button>

                          <Button
                            variant="ghost"
                            disabled={
                              isUploading ||
                              mutation.isPending
                            }
                            onClick={
                              closeAction
                            }
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}

                  {/*
                   * =====================================================
                   * COMPLETION FORM
                   * =====================================================
                   */}
                  {open &&
                    mode ===
                    'complete' &&
                    !ticketPending && (
                      <div className="mt-5 rounded-xl border bg-iron-grey-50 p-4">
                        <div>
                          <h3 className="font-bold text-charcoal-900">
                            Penyelesaian
                            Pekerjaan
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-lavender-grey-500">
                            Upload
                            minimal 1
                            foto atau
                            video.
                            Beberapa
                            file dapat
                            dipilih
                            sekaligus.
                          </p>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <Field label="Ringkasan pekerjaan">
                            <Textarea
                              value={
                                summary
                              }
                              onChange={(
                                event,
                              ) =>
                                setSummary(
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Jelaskan pekerjaan yang telah dilakukan."
                              required
                            />
                          </Field>

                          <Field
                            label="Bukti penyelesaian"
                            hint="Wajib minimal 1 file. Gambar: JPEG, PNG, WEBP. Video: MP4, MOV (iPhone), 3GP (Android), WebM, AVI, MKV, dan lainnya. Pilih file tambahan untuk menambah ke daftar (tidak mengganti yang sudah ada)."
                          >
                            <Input
                              type="file"

                              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/3gpp,video/3gpp2,video/webm,video/x-msvideo,video/x-matroska,video/x-m4v,video/ogg,video/mpeg"

                              /*
                               * Phase 6:
                               * multi-upload.
                               */
                              multiple

                              onChange={(
                                event,
                              ) => {
                                handleCompletionFiles(
                                  event
                                    .target
                                    .files,
                                );
                                /*
                                 * Reset value agar onChange kembali
                                 * terpicu bila user memilih file
                                 * yang sama lagi di sesi berikutnya.
                                 */
                                event.target.value = '';
                              }}

                              required
                            />
                          </Field>

                          {completionFiles.length >
                            0 && (
                              <div className="rounded-xl border border-iron-grey-200 bg-white">
                                <div className="border-b border-iron-grey-100 px-4 py-3">
                                  <p className="text-sm font-bold text-charcoal-900">
                                    {
                                      completionFiles.length
                                    }{' '}
                                    file
                                    dipilih
                                  </p>
                                </div>

                                <div className="divide-y divide-iron-grey-100">
                                  {completionFiles.map(
                                    (
                                      selectedFile,
                                      index,
                                    ) => {
                                      const video =
                                        selectedFile.type.startsWith(
                                          'video/',
                                        );

                                      return (
                                        <div
                                          key={
                                            `${selectedFile.name}-${selectedFile.size}-${index}`
                                          }
                                          className="flex items-center gap-3 px-4 py-3"
                                        >
                                          {video ? (
                                            <FileVideo className="h-5 w-5 shrink-0 text-violet-600" />
                                          ) : (
                                            <FileImage className="h-5 w-5 shrink-0 text-alice-blue-600" />
                                          )}

                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold">
                                              {
                                                selectedFile.name
                                              }
                                            </p>

                                            <p className="text-xs text-lavender-grey-500">
                                              {
                                                selectedFile.type
                                              }{' '}
                                              ·{' '}
                                              {formatFileSize(
                                                selectedFile.size,
                                              )}
                                            </p>
                                          </div>

                                          <button
                                            type="button"
                                            aria-label="Hapus file"
                                            className="rounded-lg p-1.5 text-lavender-grey-500 hover:bg-iron-grey-100 hover:text-charcoal-800"
                                            onClick={() =>
                                              setCompletionFiles(
                                                (
                                                  current,
                                                ) =>
                                                  current.filter(
                                                    (
                                                      _,
                                                      currentIndex,
                                                    ) =>
                                                      currentIndex !==
                                                      index,
                                                  ),
                                              )
                                            }
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            loading={
                              isUploading ||
                              isActionPending(
                                'complete',
                              )
                            }
                            disabled={
                              !summary.trim() ||
                              completionFiles.length ===
                              0
                            }
                            onClick={() =>
                              void complete(
                                member.id,
                              )
                            }
                          >
                            <Upload className="h-4 w-4" />

                            Kirim
                            Penyelesaian
                          </Button>

                          <Button
                            variant="ghost"
                            disabled={
                              isUploading ||
                              mutation.isPending
                            }
                            onClick={
                              closeAction
                            }
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                </Card>
              );
            },
          )}
        </div>
      )}
    </>
  );
}