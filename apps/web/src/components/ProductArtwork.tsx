import type { ReactElement } from 'react';
import type { Locale } from '@/i18n/locale';

type ArtworkKind = 'coffee' | 'tea' | 'milkTea' | 'blended' | 'pastry';

const KIND_BY_CATEGORY: Record<string, ArtworkKind> = {
  Coffee: 'coffee',
  Tea: 'tea',
  'Milk tea': 'milkTea',
  Blended: 'blended',
  Pastry: 'pastry',
};

const LABEL: Record<ArtworkKind, { vi: string; en: string }> = {
  coffee: { vi: 'Cà phê', en: 'Coffee' },
  tea: { vi: 'Trà', en: 'Tea' },
  milkTea: { vi: 'Trà sữa', en: 'Milk tea' },
  blended: { vi: 'Đá xay', en: 'Blended' },
  pastry: { vi: 'Bánh', en: 'Pastry' },
};

function artworkKind(categoryName: string | null | undefined): ArtworkKind {
  if (!categoryName) return 'coffee';
  return KIND_BY_CATEGORY[categoryName] ?? 'coffee';
}

function CoffeeArt() {
  return (
    <>
      <ellipse cx="200" cy="398" rx="116" ry="15" fill="var(--color-paper-3)" />
      <path
        d="M118 262h164l-14 86c-2 15-14 26-29 26h-78c-15 0-27-11-29-26z"
        fill="var(--color-paper)"
      />
      <path d="M282 282c31 3 43 23 39 44-5 24-27 34-48 30" fill="none" />
      <ellipse cx="200" cy="262" rx="82" ry="11" fill="var(--color-ink)" opacity="0.88" />
      <ellipse cx="200" cy="260" rx="54" ry="6" fill="none" opacity="0.35" />
      <path d="M166 196c-12-18 12-28 0-46" opacity="0.55" />
      <path d="M200 186c-12-18 12-28 0-46" opacity="0.55" />
      <path d="M234 196c-12-18 12-28 0-46" opacity="0.55" />
      <circle cx="146" cy="384" r="3" fill="var(--color-accent)" opacity="0.7" />
      <circle cx="256" cy="384" r="3" fill="var(--color-accent)" opacity="0.7" />
    </>
  );
}

function TeaArt() {
  return (
    <>
      <ellipse cx="200" cy="424" rx="92" ry="12" fill="var(--color-paper-3)" />
      <path
        d="M140 216h120l-12 184c-1 12-11 21-23 21h-50c-12 0-22-9-23-21z"
        fill="var(--color-paper)"
      />
      <path
        d="M147 292h106l-8 108c-1 11-9 18-19 18h-42c-10 0-18-7-19-18z"
        fill="var(--color-accent-soft)"
        opacity="0.75"
      />
      <path d="M147 292h106" opacity="0.55" />
      <path d="M204 218v96" opacity="0.55" />
      <rect x="194" y="308" width="20" height="22" rx="2" fill="var(--color-paper-3)" />
      <path d="M204 218l-38-24" opacity="0.35" />
      <circle cx="174" cy="220" r="25" fill="var(--color-paper-2)" />
      <circle cx="174" cy="220" r="18" fill="none" opacity="0.45" />
      <path d="M174 202v36M156 220h36" opacity="0.35" />
      <path d="M158 178c-8-12 8-19 0-31" opacity="0.45" />
      <path d="M242 178c-8-12 8-19 0-31" opacity="0.45" />
    </>
  );
}

function MilkTeaArt() {
  return (
    <>
      <ellipse cx="200" cy="428" rx="90" ry="12" fill="var(--color-paper-3)" />
      <path
        d="M136 232h128l-14 172c-1 12-11 21-23 21h-54c-12 0-22-9-23-21z"
        fill="var(--color-paper)"
      />
      <path
        d="M142 300h116l-9 104c-1 10-9 17-18 17h-62c-9 0-17-7-18-17z"
        fill="var(--color-accent-soft)"
        opacity="0.7"
      />
      <path d="M142 300h116" opacity="0.5" />
      <rect x="124" y="214" width="152" height="20" rx="3" fill="var(--color-paper-2)" />
      <path d="M232 216l26-86" strokeWidth="10" stroke="var(--color-accent)" opacity="0.85" />
      <path d="M232 216l26-86" strokeWidth="3" stroke="var(--color-paper-2)" opacity="0.8" />
      <circle cx="182" cy="394" r="7" fill="var(--color-ink)" opacity="0.75" />
      <circle cx="204" cy="404" r="7" fill="var(--color-ink)" opacity="0.75" />
      <circle cx="226" cy="392" r="7" fill="var(--color-ink)" opacity="0.75" />
      <circle cx="194" cy="376" r="6" fill="var(--color-ink)" opacity="0.6" />
      <circle cx="216" cy="372" r="6" fill="var(--color-ink)" opacity="0.6" />
      <circle cx="148" cy="248" r="3" fill="var(--color-accent)" opacity="0.7" />
    </>
  );
}

function BlendedArt() {
  return (
    <>
      <ellipse cx="200" cy="424" rx="86" ry="12" fill="var(--color-paper-3)" />
      <path d="M192 330h16v72h-16z" fill="var(--color-paper-2)" />
      <path d="M126 214c0 78 26 122 74 134 48-12 74-56 74-134z" fill="var(--color-paper)" />
      <path
        d="M142 238c4 56 26 88 58 98 32-10 54-42 58-98z"
        fill="var(--color-accent-soft)"
        opacity="0.75"
      />
      <rect
        x="160"
        y="222"
        width="34"
        height="34"
        rx="4"
        transform="rotate(-14 177 239)"
        fill="var(--color-paper-2)"
      />
      <rect
        x="206"
        y="238"
        width="30"
        height="30"
        rx="4"
        transform="rotate(12 221 253)"
        fill="var(--color-paper-2)"
      />
      <rect
        x="184"
        y="264"
        width="28"
        height="28"
        rx="4"
        transform="rotate(-6 198 278)"
        fill="var(--color-paper-2)"
        opacity="0.85"
      />
      <path d="M246 212l30-92" strokeWidth="9" stroke="var(--color-accent)" opacity="0.85" />
      <circle cx="148" cy="210" r="26" fill="var(--color-paper-2)" />
      <path d="M148 192v36M130 210h36" opacity="0.4" />
      <path d="M126 214h148" opacity="0.45" />
    </>
  );
}

function PastryArt() {
  return (
    <>
      <ellipse cx="200" cy="418" rx="112" ry="14" fill="var(--color-paper-3)" />
      <path d="M190 366h20v34h-20z" fill="var(--color-paper-2)" />
      <ellipse cx="200" cy="366" rx="76" ry="12" fill="var(--color-paper-2)" />
      <path d="M134 270h132v72c0 12-10 22-22 22h-88c-12 0-22-10-22-22z" fill="var(--color-paper)" />
      <path
        d="M134 300c14 12 26 4 38 12s24 4 36 10 24-2 36 6 16 4 22 0v-58H134z"
        fill="var(--color-accent-soft)"
        opacity="0.75"
      />
      <ellipse cx="200" cy="270" rx="66" ry="14" fill="var(--color-paper-2)" />
      <path d="M134 270c10-14 38-20 66-20s56 6 66 20" fill="none" opacity="0.45" />
      <circle cx="200" cy="240" r="14" fill="var(--color-paper-2)" />
      <path d="M200 226c-2-12 6-18 14-22" opacity="0.65" />
      <circle cx="154" cy="318" r="3" fill="var(--color-accent)" opacity="0.75" />
      <circle cx="246" cy="332" r="3" fill="var(--color-accent)" opacity="0.75" />
    </>
  );
}

const ART: Record<ArtworkKind, () => ReactElement> = {
  coffee: CoffeeArt,
  tea: TeaArt,
  milkTea: MilkTeaArt,
  blended: BlendedArt,
  pastry: PastryArt,
};

export default function ProductArtwork({
  categoryName,
  locale,
}: {
  categoryName?: string | null;
  locale: Locale;
}) {
  const kind = artworkKind(categoryName);
  const Art = ART[kind];
  const label = LABEL[kind][locale];

  return (
    <div className="product-art">
      <figure className="photo photo--portrait">
        <svg
          viewBox="0 0 400 500"
          role="img"
          aria-label={locale === 'vi' ? `Hình minh hoạ ${label}` : `${label} illustration`}
          preserveAspectRatio="xMidYMid slice"
        >
          <rect width="400" height="500" fill="var(--color-paper-2)" />
          <rect
            x="18"
            y="18"
            width="364"
            height="464"
            fill="none"
            stroke="var(--color-rule)"
            strokeWidth="1"
          />
          <g
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Art />
          </g>
          <path d="M150 446h100" stroke="var(--color-rule)" strokeWidth="1" />
          <text
            x="200"
            y="468"
            textAnchor="middle"
            fill="var(--color-muted)"
            fontFamily="var(--font-body)"
            fontSize="11"
            letterSpacing="3.2"
          >
            {label.toUpperCase()}
          </text>
        </svg>
      </figure>
      <p className="product-art-caption">
        {locale === 'vi'
          ? 'Hình minh hoạ theo nhóm món, không phải ảnh món tại quán.'
          : 'A category illustration, not a photo of the item.'}
      </p>
    </div>
  );
}
