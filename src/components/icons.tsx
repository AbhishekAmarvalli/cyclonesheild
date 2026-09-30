import type { AssetKind } from "../types";
import type { ReactNode, SVGProps } from "react";

/**
 * Small hand-rolled SVG icon set (no emoji anywhere in the UI).
 * `*Svg` string builders exist for Leaflet `divIcon` HTML, the React
 * components cover everything else.
 */

const STROKE = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

const PATHS: Record<AssetKind, string> = {
  hospital: "M12 5.5v13M5.5 12h13",
  shelter: "M3.5 11.5 12 4.5l8.5 7M6 10.5V19.5h12V10.5M10 19.5v-5h4v5",
  power: "M13.5 3 6 13.5h5.5L10.5 21 18 10.5h-5.5L13.5 3Z",
  road: "M8.5 4 6.5 20M15.5 4l2 16M12 4.5v3M12 10.5v3M12 16.5v3",
  port: "M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 7.5V21M6 11.5a6 6 0 0 0 12 0M9.5 10h5",
  airport:
    "M21.5 15.5 13 12V5.5a1.5 1.5 0 0 0-3 0V12l-8.5 3.5v2l8.5-2.5v4L9 20.5V22l4-1 4 1v-1.5L14.5 19v-4l7 2.5v-2Z",
};

const wrap = (inner: string, size = 17) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${STROKE}>${inner}</svg>`;

export const kindSvg = (kind: AssetKind): string => wrap(PATHS[kind]);

export const CYCLONE_PATHS = `
  <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>
  <path d="M12 4.4a7.6 7.6 0 0 1 7.6 7.6"/>
  <path d="M12 19.6A7.6 7.6 0 0 1 4.4 12"/>
  <path d="M19 6.6a8.6 8.6 0 0 1 1.4 7.2"/>
  <path d="M5 17.4A8.6 8.6 0 0 1 3.6 10.2"/>
`;

export const cycloneSvg = (): string => wrap(CYCLONE_PATHS, 19);

const Icon = ({
  children,
  size = 16,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number; children?: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

export const WarnIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M12 3.8 2.6 20.2h18.8L12 3.8Z" />
    <path d="M12 9.8v4.6" />
    <path d="M12 17.4v.1" />
  </Icon>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M4.5 12.6 9.5 17.6 19.5 6.9" />
  </Icon>
);

export const CycloneIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    <path d="M12 4.4a7.6 7.6 0 0 1 7.6 7.6" />
    <path d="M12 19.6A7.6 7.6 0 0 1 4.4 12" />
  </Icon>
);

export const KindIcon = ({
  kind,
  ...rest
}: SVGProps<SVGSVGElement> & { kind: AssetKind }) => (
  <Icon {...rest}>
    <path d={PATHS[kind]} />
  </Icon>
);

/** Tilted satellite: body, two solar panels, antenna stub. */
export const SatelliteIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <g transform="rotate(-40 12 12)">
      <rect x="9.4" y="10.5" width="5.2" height="3" rx="1" />
      <path d="M2.8 10.9h4.6v2.2H2.8zM16.6 10.9h4.6v2.2h-4.6z" />
      <path d="M7.4 12h2M14.6 12h2M12 10.5V8.4" />
      <circle cx="12" cy="6.7" r="1.5" />
    </g>
  </Icon>
);
