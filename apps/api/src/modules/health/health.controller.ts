import {
  Controller,
  Get,
} from '@nestjs/common';

import {
  ApiExcludeController,
} from '@nestjs/swagger';

import {
  Public,
} from '../../common/decorators/public.decorator';

import {
  HealthService,
} from './health.service';

@Public()
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health:
      HealthService,
  ) { }

  @Get('live')
  live() {
    return this.health
      .live();
  }

  @Get('ready')
  ready() {
    return this.health
      .ready();
  }
}