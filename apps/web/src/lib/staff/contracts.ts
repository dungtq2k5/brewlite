export type {
  StaffProductResponseDto as InventoryProduct,
  StaffToppingResponseDto as InventoryTopping,
  OrderResponseDto as Order,
  OrderResponseDtoLinesItem as OrderLine,
  MeResponseDto as StaffUser,
  MeResponseDtoPermissionsItem as StaffPermission,
  StaffOrdersControllerListBoardStatus as BoardStatus,
  AdvanceStatusDto,
} from '@brewlite/api-client';
export {
  StaffProductsControllerListResponse,
  StaffProductsControllerSetAvailabilityBody,
  StaffProductsControllerSetAvailabilityParams,
  StaffProductsControllerSetAvailabilityResponse,
  StaffProductsControllerSetStockQtyBody,
  StaffProductsControllerSetStockQtyResponse,
  StaffToppingsControllerListResponse,
  StaffToppingsControllerSetAvailabilityResponse,
  StaffOrdersControllerListBoardResponse,
  StaffOrdersControllerAdvanceStatusBody,
  StaffOrdersControllerAdvanceStatusResponse,
  StaffOrdersControllerCancelPaidBody,
  StaffOrdersControllerCancelPaidResponse,
  UsersControllerGetResponse,
  UsersControllerUpdateBody,
  UsersControllerUpdateResponse,
} from '@brewlite/api-client/zod';
export type StaffError =
  | 'requestFailed'
  | 'unauthenticated'
  | 'forbidden'
  | 'conflict'
  | 'invalidState'
  | 'notFound'
  | 'invalidInput';
export type Result<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: StaffError;
    };
export type InventoryTab = 'products' | 'toppings';
export type StatusFilter = 'all' | 'selling' | 'hidden';
