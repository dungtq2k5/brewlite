import 'server-only';
import { adminCategoriesControllerList, adminToppingsControllerList } from '@brewlite/api-client';
import '@/lib/api';
import { withRequestId } from '@/lib/with-request-id';

/** The live categories and toppings the product editor chooses from. */
export async function loadEditorLists() {
  const [categories, toppings] = await Promise.all([
    adminCategoriesControllerList({}),
    adminToppingsControllerList({}),
  ]).catch((error: unknown) => {
    throw withRequestId(error);
  });
  return {
    categories: categories.status === 200 ? (categories.data.data ?? []) : [],
    toppings: toppings.status === 200 ? (toppings.data.data ?? []) : [],
  };
}
