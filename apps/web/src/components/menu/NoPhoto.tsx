import { CakeSlice, Coffee, CupSoda, GlassWater, Leaf, type LucideIcon } from 'lucide-react';

// The handoff's five looks, in the menu's order: a token tint over base-100 and the category glyph.
const LOOKS: { tint: string; Icon: LucideIcon }[] = [
  { tint: 'bg-secondary', Icon: Coffee },
  { tint: 'bg-success/14', Icon: Leaf },
  { tint: 'bg-primary/10', Icon: CupSoda },
  { tint: 'bg-accent/18', Icon: GlassWater },
  { tint: 'bg-warning/30', Icon: CakeSlice },
];

/** A product without a photo (`imageUrl === null`): decorative, so no `alt` text to read. */
export function NoPhoto({
  variant,
  iconSize = 56,
}: Readonly<{ variant: number; iconSize?: number }>) {
  const { tint, Icon } = LOOKS[variant] ?? LOOKS[0]!;
  return (
    <div aria-hidden className={`bg-base-100 size-full`}>
      <div className={`${tint} text-primary grid size-full place-items-center`}>
        <Icon size={iconSize} strokeWidth={1.5} />
      </div>
    </div>
  );
}
