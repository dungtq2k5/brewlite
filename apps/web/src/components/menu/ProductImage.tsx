import { NoPhoto } from './NoPhoto';

/**
 * The fixed-aspect frame of a product photo (the caller sets the aspect). A plain lazy `<img>`,
 * not `next/image`: Next's optimiser would fetch the photo from inside the web container, where
 * the Storage address the *browser* uses does not point at the emulator. The fixed frame means
 * a late photo never shifts the layout.
 */
export function ProductImage({
  imageUrl,
  name,
  variant,
  iconSize,
}: Readonly<{ imageUrl: string | null; name: string; variant: number; iconSize?: number }>) {
  return imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
    />
  ) : (
    <NoPhoto variant={variant} iconSize={iconSize} />
  );
}
