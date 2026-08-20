import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => {
      if (value === undefined || value === null) return value;
      if (typeof value === 'object' && value && ('data' in value || 'error' in value)) return value;
      return { data: value };
    }));
  }
}
