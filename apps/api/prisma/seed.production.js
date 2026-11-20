'use strict';

const {
  PrismaClient,
  UserStatus,
} = require(
  '@prisma/client',
);

const bcrypt =
  require(
    'bcryptjs',
  );

const {
  seedAccessControl,
  seedCatalogAndSla,
} = require(
  './seed.system',
);

function requiredEnv(
  name,
) {
  const value =
    process.env[name]
      ?.trim();

  if (
    !value
  ) {
    throw new Error(
      `${name} wajib diisi untuk production seed.`,
    );
  }

  return value;
}

function normalizePhone(
  value,
) {
  const digits =
    value.replace(
      /\D/g,
      '',
    );

  if (
    digits.startsWith(
      '0',
    )
  ) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

if (
  process.env.APP_ENV !==
  'PRODUCTION'
) {
  throw new Error(
    'Production seed hanya boleh dijalankan saat APP_ENV=PRODUCTION.',
  );
}

const prisma =
  new PrismaClient({
    datasourceUrl:
      requiredEnv(
        'DIRECT_URL',
      ),
  });

async function upsertBootstrapAdmin() {
  const email =
    requiredEnv(
      'BOOTSTRAP_ADMIN_EMAIL',
    ).toLowerCase();

  const displayName =
    requiredEnv(
      'BOOTSTRAP_ADMIN_NAME',
    );

  const rawPhone =
    process.env
      .BOOTSTRAP_ADMIN_PHONE
      ?.trim();

  const phoneNormalized =
    rawPhone
      ? normalizePhone(
        rawPhone,
      )
      : undefined;

  let admin =
    await prisma.user
      .findUnique({
        where: {
          email,
        },
      });

  if (
    admin
  ) {
    admin =
      await prisma.user
        .update({
          where: {
            id:
              admin.id,
          },

          data: {
            displayName,
            status:
              UserStatus.APPROVED,

            ...(
              phoneNormalized
                ? {
                  phoneNormalized,
                }
                : {}
            ),
          },
        });
  } else {
    const password =
      requiredEnv(
        'BOOTSTRAP_ADMIN_PASSWORD',
      );

    if (
      password.length <
      12
    ) {
      throw new Error(
        'BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter.',
      );
    }

    admin =
      await prisma.user
        .create({
          data: {
            email,
            displayName,
            phoneNormalized,
            passwordHash:
              await bcrypt.hash(
                password,
                12,
              ),
            status:
              UserStatus.APPROVED,
            mustChangePassword:
              true,
          },
        });
  }

  const administratorRole =
    await prisma.role
      .findUniqueOrThrow({
        where: {
          name:
            'ADMINISTRATOR',
        },
      });

  await prisma.userRole
    .upsert({
      where: {
        userId_roleId: {
          userId:
            admin.id,
          roleId:
            administratorRole.id,
        },
      },

      update: {},

      create: {
        userId:
          admin.id,
        roleId:
          administratorRole.id,
      },
    });

  return admin;
}

async function main() {
  await seedAccessControl(
    prisma,
  );

  const admin =
    await upsertBootstrapAdmin();

  await seedCatalogAndSla(
    prisma,
    admin.id,
  );

  console.log(
    'Production seed selesai: akses, katalog, SLA, dan administrator siap.',
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma
        .$disconnect();
    },
  );
