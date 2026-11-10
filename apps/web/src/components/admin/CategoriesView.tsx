'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminCategoryResponseDto } from '@brewlite/api-client';
import { deleteCategory, reorderCategories, restoreCategory } from '@/actions/admin/categories';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { renumber, SORT_STEP } from '@/lib/admin/category-order';
import { Alert } from '../Alert';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { AdminTable, Td, Th } from './AdminTable';
import { CategoryDialog } from './CategoryDialog';
import { useAdminError } from './useAdminError';

type Category = AdminCategoryResponseDto;

function StatusPill({ active, deleted }: Readonly<{ active: boolean; deleted: boolean }>) {
  const { t } = useTranslation('admin');
  const label = deleted ? t('status.deleted') : active ? t('status.active') : t('status.hidden');
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
        active && !deleted ? 'bg-secondary text-primary' : 'bg-base-200'
      }`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${active && !deleted ? 'bg-success' : 'bg-base-content/40'}`}
      />
      {label}
    </span>
  );
}

function Row({
  category,
  position,
  count,
  deleted,
  locale,
  onEdit,
  onDelete,
  onRestore,
}: Readonly<{
  category: Category;
  position: number;
  count: number | undefined;
  deleted: boolean;
  locale: Locale;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}>) {
  const { t } = useTranslation('admin');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: deleted });
  const other: Locale = locale === 'vi' ? 'en' : 'vi';
  const name = localized(category.name, locale);
  const link = 'min-h-11 px-2 text-sm font-semibold underline';
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'bg-base-200 relative z-10 shadow-lg' : ''}
    >
      <Td className="w-12 pr-0">
        {!deleted && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t('category.grip', { name })}
            className="text-base-content/60 grid size-11 cursor-grab touch-none place-items-center rounded-full"
          >
            <GripVertical aria-hidden size={18} />
          </button>
        )}
      </Td>
      <Td>
        <p className="font-semibold">{name}</p>
        <p className="text-base-content/60 text-sm">{localized(category.name, other)}</p>
      </Td>
      <Td className="tabular-nums">{deleted ? '' : position}</Td>
      <Td>
        <StatusPill active={category.isActive} deleted={deleted} />
      </Td>
      <Td className="text-right tabular-nums">{deleted ? '' : (count ?? 0)}</Td>
      <Td className="text-right whitespace-nowrap">
        {deleted ? (
          <button type="button" className={link} onClick={onRestore}>
            {t('action.restore')}
          </button>
        ) : (
          <>
            <button type="button" className={link} onClick={onEdit}>
              {t('action.edit')}
            </button>
            <button type="button" className={`${link} text-error`} onClick={onDelete}>
              {t('action.delete')}
            </button>
          </>
        )}
      </Td>
    </tr>
  );
}

/**
 * `/admin/categories` (`97:21` …): the menu's order, edited by dragging a row (pointer or keyboard:
 * Space picks up, ↑ ↓ moves, Space drops — every move announced), a dialog for create / edit, delete
 * with a "still has products" refusal, and the *Deleted* view with *Restore*.
 */
export function CategoriesView({
  categories,
  counts,
  deleted,
}: Readonly<{ categories: Category[]; counts: Record<string, number>; deleted: boolean }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const router = useRouter();
  const message = useAdminError();
  const [, startTransition] = useTransition();

  // The server's order, unless a drag has just changed it and the refresh has not come back yet.
  const [source, setSource] = useState(categories);
  const [local, setLocal] = useState<string[] | null>(null);
  if (source !== categories) {
    setSource(categories);
    setLocal(null);
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ids = local ?? categories.map((c) => c.id);
  const rows = ids.map((id) => byId.get(id)).filter((c): c is Category => c !== undefined);

  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [removeError, setRemoveError] = useState<React.ReactNode>(null);
  const [removePending, setRemovePending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const name = (id: string) => (byId.get(id) ? localized(byId.get(id)!.name, locale) : '');
  const where = (id: string, over: string | undefined, order = ids) => ({
    name: name(id),
    position: (over ? order.indexOf(over) : order.indexOf(id)) + 1,
    total: order.length,
  });
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('category.dnd.pickedUp', where(String(active.id), undefined)),
    // dnd-kit fires this right after pick-up with the row over itself; saying nothing then keeps
    // "Picked up…" from being replaced in the live region before it is read.
    onDragOver: ({ active, over }) =>
      !over || over.id === active.id
        ? undefined
        : t('category.dnd.moved', where(String(active.id), String(over.id))),
    onDragEnd: ({ active, over }) =>
      t('category.dnd.dropped', where(String(active.id), over ? String(over.id) : undefined)),
    onDragCancel: ({ active }) => t('category.dnd.cancelled', { name: name(String(active.id)) }),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const changes = renumber(categories, next);
    setLocal(next);
    setNotice(null);
    startTransition(async () => {
      const result = await reorderCategories(changes);
      if (result.ok) return router.refresh();
      setLocal(null); // back to the server's order
      setNotice(t('category.reorderFailed'));
      router.refresh();
    });
  };

  const confirmDelete = async () => {
    if (!removing) return;
    setRemovePending(true);
    const result = await deleteCategory(removing.id);
    setRemovePending(false);
    if (result.ok) {
      setRemoving(null);
      return router.refresh();
    }
    const n = counts[removing.id] ?? 0;
    const label = localized(removing.name, locale);
    setRemoveError(
      result.code === 'CATEGORY_IN_USE' ? (
        <>
          {t('category.inUseText', { name: label, count: n })}
          <Link className="underline" href={`/admin/products?categoryId=${removing.id}`}>
            {t('category.inUseLink', { name: label })}
          </Link>
        </>
      ) : (
        message(result.code, result.details)
      ),
    );
  };

  const restore = (category: Category) =>
    startTransition(async () => {
      const result = await restoreCategory(category.id);
      if (result.ok) {
        setNotice(null);
        return router.refresh();
      }
      setNotice(
        result.code === 'CATEGORY_NAME_TAKEN'
          ? t('category.restoreTaken', { name: localized(category.name, locale) })
          : message(result.code, result.details),
      );
    });

  const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('category.title')}</h1>
          <p className="text-base-content/80">{t('category.intro')}</p>
        </div>
        {!deleted && (
          <button
            type="button"
            className="btn btn-primary min-h-11"
            onClick={() => setEditing('new')}
          >
            {t('category.new')}
          </button>
        )}
      </div>

      <div>
        <Link
          href={deleted ? '/admin/categories' : '/admin/categories?deleted=true'}
          replace
          aria-pressed={deleted}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
            deleted ? 'bg-neutral text-neutral-content border-neutral' : 'border-base-300'
          }`}
        >
          {t('list.deleted')}
        </Link>
      </div>

      {notice && <Alert type="error">{notice}</Alert>}

      {rows.length === 0 ? (
        <p className="border-base-300 rounded-box border px-4 py-10 text-center">
          {deleted ? t('category.noneDeleted') : t('category.none')}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t('category.intro') },
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <AdminTable caption={t('category.title')}>
              <thead>
                <tr>
                  <Th className="w-12">
                    <span className="sr-only">{t('category.grip', { name: '' })}</span>
                  </Th>
                  <Th>{t('category.cols.name')}</Th>
                  <Th>{t('category.cols.order')}</Th>
                  <Th>{t('category.cols.status')}</Th>
                  <Th className="text-right">{t('category.cols.products')}</Th>
                  <Th>
                    <span className="sr-only">{t('action.edit')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((category, index) => (
                  <Row
                    key={category.id}
                    category={category}
                    position={index + 1}
                    count={counts[category.id]}
                    deleted={deleted}
                    locale={locale}
                    onEdit={() => setEditing(category)}
                    onDelete={() => {
                      setRemoveError(null);
                      setRemoving(category);
                    }}
                    onRestore={() => restore(category)}
                  />
                ))}
              </tbody>
            </AdminTable>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <CategoryDialog
          category={editing === 'new' ? undefined : editing}
          nextSortOrder={maxOrder + SORT_STEP}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {removing && (
        <AdminConfirmDialog
          title={t('confirm.deleteTitle', { name: localized(removing.name, locale) })}
          body={t('confirm.deleteBody')}
          confirmLabel={t('action.delete')}
          pending={removePending}
          error={removeError}
          onConfirm={() => void confirmDelete()}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
