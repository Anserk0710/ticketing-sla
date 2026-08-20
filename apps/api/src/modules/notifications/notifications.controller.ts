import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications:
      NotificationsService,
  ) { }

  @Get()
  @Permissions(
    'notification.read.self',
  )
  async list(
    @CurrentUser()
    user: AuthUser,

    @Query('unreadOnly')
    unreadOnly?: string,
  ) {
    return this.notifications.listForUser(
      user.id,
      unreadOnly === 'true',
    );
  }

  /*
   * Phase 9:
   *
   * Badge tidak perlu mengambil maksimum
   * 100 notification lalu menghitung array.
   *
   * Database langsung menjalankan COUNT.
   */
  @Get('unread-count')
  @Permissions(
    'notification.read.self',
  )
  async unreadCount(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.notifications.unreadCount(
      user.id,
    );
  }

  @Post(':id/read')
  @Permissions(
    'notification.read.self',
  )
  async read(
    @CurrentUser()
    user: AuthUser,

    @Param('id')
    id: string,
  ) {
    return this.notifications.markRead(
      user.id,
      id,
    );
  }

  @Post('read-all')
  @Permissions(
    'notification.read.self',
  )
  async readAll(
    @CurrentUser()
    user: AuthUser,

    @Body()
    _body: Record<string, never>,
  ) {
    return this.notifications.markAllRead(
      user.id,
    );
  }
}