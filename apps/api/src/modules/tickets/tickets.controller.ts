import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import {
  ClassificationDto,
  CloseTicketDto,
  CommentDto,
  CreateTicketDto,
  ReasonDto,
  RescheduleTicketDto,
  ResumeTicketDto,
  ResolveTicketDto,
  RespondTicketDto,
  TicketQueryDto,
  TrackTicketDto,
} from './tickets.dto';
import { TicketsService } from './tickets.service';
import { BackgroundTaskService } from 'src/common/services/background-task.service';

@ApiTags('Tickets')
@Controller()
export class TicketsController {
  constructor(
    private readonly service:
      TicketsService,

    private readonly prisma:
      PrismaService,

    private readonly email:
      EmailService,

    private readonly background:
      BackgroundTaskService,
  ) { }

  @Public()
  @Get('public/qr/:token')
  resolveQr(
    @Param('token')
    token: string,
  ) {
    return this.service.resolveQr(
      token,
    );
  }

  @Public()
  @Post('public/tickets')
  async create(
    @Body()
    dto: CreateTicketDto,

    @Headers('idempotency-key')
    key?: string,
  ) {
    /*
     * Simpan kondisi idempotency SEBELUM
     * menjalankan createPublic().
     *
     * createPublic() sendiri sudah memiliki
     * behavior idempotent existing.
     *
     * Informasi ini hanya dipakai untuk
     * mencegah duplicate email ketika client
     * melakukan retry request yang sama.
     */
    const existingIdempotency =
      key
        ? await this.prisma.idempotencyKey.findUnique({
          where: {
            key,
          },

          select: {
            responseId: true,
          },
        })
        : null;

    const result =
      await this.service.createPublic(
        dto,
        key,
      );

    /*
     * Email merupakan secondary side effect.
     *
     * Tidak di-await supaya response public
     * complaint tidak ikut menunggu latency SMTP.
     *
     * EmailService sendiri menangkap seluruh
     * SMTP/database error sehingga tidak ada
     * unhandled promise rejection.
     */

    if (
      !existingIdempotency
        ?.responseId
    ) {
      this.background.run(
        `new-ticket-email:${result.id}`,

        this.email
          .sendNewTicketNotification(
            result.id,
          ),
      );
    }

    return result;
  }

  @Public()
  @Post('public/tickets/track')
  track(
    @Body()
    dto: TrackTicketDto,
  ) {
    return this.service.track(
      dto,
    );
  }

  @ApiBearerAuth()
  @Get('tickets')
  @Permissions(
    'ticket.read.all',
    'ticket.read.assigned',
  )
  list(
    @Query()
    query: TicketQueryDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.list(
      query,
      user,
    );
  }

  @ApiBearerAuth()
  @Get('tickets/:id')
  @Permissions(
    'ticket.read.all',
    'ticket.read.assigned',
  )
  detail(
    @Param('id')
    id: string,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.detail(
      id,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/respond')
  @Permissions(
    'ticket.respond',
  )
  respond(
    @Param('id')
    id: string,

    @Body()
    dto: RespondTicketDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.respond(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Patch(
    'tickets/:id/classification',
  )
  @Permissions(
    'ticket.classify',
  )
  classify(
    @Param('id')
    id: string,

    @Body()
    dto: ClassificationDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.classify(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/cancel')
  @Permissions(
    'ticket.close',
  )
  cancel(
    @Param('id')
    id: string,

    @Body()
    dto: ReasonDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.cancel(
      id,
      dto.reason,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/resolve')
  @Permissions(
    'ticket.resolve',
  )
  resolve(
    @Param('id')
    id: string,

    @Body()
    dto: ResolveTicketDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.resolve(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/close')
  @Permissions(
    'ticket.close',
  )
  close(
    @Param('id')
    id: string,

    @Body()
    dto: CloseTicketDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.close(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Post(
    'tickets/:id/reschedule',
  )
  @Permissions(
    'ticket.close',
  )
  reschedule(
    @Param('id')
    id: string,

    @Body()
    dto: RescheduleTicketDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.reschedule(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/resume')
  @Permissions(
    'ticket.close',
  )
  resume(
    @Param('id')
    id: string,

    @Body()
    dto: ResumeTicketDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.resume(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/reopen')
  @Permissions(
    'ticket.reopen',
  )
  reopen(
    @Param('id')
    id: string,

    @Body()
    dto: ReasonDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.reopen(
      id,
      dto.reason,
      user,
    );
  }

  @ApiBearerAuth()
  @Post('tickets/:id/comments')
  @Permissions(
    'ticket.comment.internal',
  )
  comment(
    @Param('id')
    id: string,

    @Body()
    dto: CommentDto,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.comment(
      id,
      dto,
      user,
    );
  }

  @ApiBearerAuth()
  @Get('tickets/:id/timeline')
  @Permissions(
    'ticket.read.all',
    'ticket.read.assigned',
  )
  timeline(
    @Param('id')
    id: string,

    @CurrentUser()
    user: AuthUser,
  ) {
    return this.service.timeline(
      id,
      user,
    );
  }
}