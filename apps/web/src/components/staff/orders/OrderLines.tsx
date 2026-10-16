import type { OrderLine } from './order.types';

type OrderLinesProps = {
  lines: OrderLine[];
};

export function OrderLines({ lines }: OrderLinesProps) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {lines.map((line) => (
        <li
          key={line.id}
          className="min-w-0 border-b border-dashed border-[#eadcca] pb-2 last:border-0 last:pb-0"
        >
          <div className="flex items-start justify-between gap-[5px] text-[11px] leading-[15px] text-[#6b4633]">
            <strong className="min-w-0 break-words font-bold">{line.item}</strong>

            <span className="flex-none whitespace-nowrap text-[#876b58]">
              {line.size} · x{line.quantity}
            </span>
          </div>

          <p className="mb-0 mt-1 break-words text-[10px] leading-[14px] text-[#8b7867]">
            Topping:{' '}
            {line.toppings.length > 0
              ? line.toppings.map((topping) => topping.name).join(', ')
              : 'Không có'}
          </p>

          {line.note && (
            <p className="mb-0 mt-[6px] rounded-[5px] bg-[#f2ece4] px-2 py-2 text-[11px] leading-[15px] text-[#91806f]">
              Ghi chú: {line.note}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
