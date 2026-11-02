import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HealthResponseDto } from './health-response.dto';

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.database.ping();
    } catch {
      throw new ServiceUnavailableException('Không thể kết nối tới cơ sở dữ liệu.');
    }

    return {
      status: 'ok',
      database: 'connected',
      service: 'to-toan-api',
      timestamp: new Date().toISOString(),
    };
  }
}
