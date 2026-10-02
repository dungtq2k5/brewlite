import type { GetMyLoyaltyResponse } from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { LoyaltyResponseDto } from './dto/loyalty-response.dto.js';

export function toLoyaltyResponseDto(response: GetMyLoyaltyResponse): LoyaltyResponseDto {
  return {
    balance: response.balance,
    lifetimeEarned: response.lifetimeEarned,
    recent: response.recent.map((entry) => ({
      orderId: entry.orderId,
      orderNo: entry.orderNo,
      kind: entry.kind as LoyaltyResponseDto['recent'][number]['kind'],
      points: entry.points,
      at: entry.at,
    })),
  };
}
