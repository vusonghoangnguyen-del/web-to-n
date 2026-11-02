import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'connected' })
  database!: 'connected';

  @ApiProperty({ example: 'to-toan-api' })
  service!: string;

  @ApiProperty({ example: '2026-11-02T04:00:00.000Z' })
  timestamp!: string;
}
