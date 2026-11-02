import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthResponseDto } from './health-response.dto';

@Injectable()
export class HealthService {
  constructor(private readonly database: DataSource) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.database.query('SELECT 1');
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
