"use client";

/**
 * Icons exported from the Figma file, kept as their original path data.
 *
 * The spinner arrives as eight identical spokes, so rotating it would look
 * static — instead each spoke fades on a staggered loop, which is how this
 * style of spinner is meant to read.
 */

const SPINNER_PATH =
  "M17 4V8C17 8.26522 16.8946 8.51957 16.7071 8.70711C16.5196 8.89464 16.2652 9 16 9C15.7348 9 15.4804 8.89464 15.2929 8.70711C15.1054 8.51957 15 8.26522 15 8V4C15 3.73478 15.1054 3.48043 15.2929 3.29289C15.4804 3.10536 15.7348 3 16 3C16.2652 3 16.5196 3.10536 16.7071 3.29289C16.8946 3.48043 17 3.73478 17 4ZM21.6562 11.3438C21.7877 11.3437 21.9178 11.3177 22.0392 11.2673C22.1606 11.2169 22.2709 11.1431 22.3638 11.05L25.1925 8.2225C25.3801 8.03486 25.4856 7.78036 25.4856 7.515C25.4856 7.24964 25.3801 6.99514 25.1925 6.8075C25.0049 6.61986 24.7504 6.51444 24.485 6.51444C24.2196 6.51444 23.9651 6.61986 23.7775 6.8075L20.95 9.63625C20.8101 9.77603 20.7147 9.95417 20.676 10.1481C20.6373 10.3421 20.657 10.5432 20.7326 10.726C20.8082 10.9087 20.9363 11.065 21.1007 11.1749C21.2651 11.2849 21.4585 11.3437 21.6562 11.3438ZM28 15H24C23.7348 15 23.4804 15.1054 23.2929 15.2929C23.1054 15.4804 23 15.7348 23 16C23 16.2652 23.1054 16.5196 23.2929 16.7071C23.4804 16.8946 23.7348 17 24 17H28C28.2652 17 28.5196 16.8946 28.7071 16.7071C28.8946 16.5196 29 16.2652 29 16C29 15.7348 28.8946 15.4804 28.7071 15.2929C28.5196 15.1054 28.2652 15 28 15ZM22.3638 20.95C22.1747 20.7704 21.9229 20.6717 21.6622 20.6751C21.4014 20.6784 21.1523 20.7835 20.9679 20.9679C20.7835 21.1523 20.6784 21.4014 20.6751 21.6622C20.6717 21.9229 20.7704 22.1747 20.95 22.3638L23.7775 25.1925C23.9651 25.3801 24.2196 25.4856 24.485 25.4856C24.7504 25.4856 25.0049 25.3801 25.1925 25.1925C25.3801 25.0049 25.4856 24.7504 25.4856 24.485C25.4856 24.2196 25.3801 23.9651 25.1925 23.7775L22.3638 20.95ZM16 23C15.7348 23 15.4804 23.1054 15.2929 23.2929C15.1054 23.4804 15 23.7348 15 24V28C15 28.2652 15.1054 28.5196 15.2929 28.7071C15.4804 28.8946 15.7348 29 16 29C16.2652 29 16.5196 28.8946 16.7071 28.7071C16.8946 28.5196 17 28.2652 17 28V24C17 23.7348 16.8946 23.4804 16.7071 23.2929C16.5196 23.1054 16.2652 23 16 23ZM9.63625 20.95L6.8075 23.7775C6.61986 23.9651 6.51444 24.2196 6.51444 24.485C6.51444 24.7504 6.61986 25.0049 6.8075 25.1925C6.99514 25.3801 7.24964 25.4856 7.515 25.4856C7.78036 25.4856 8.03486 25.3801 8.2225 25.1925L11.05 22.3638C11.2296 22.1747 11.3283 21.9229 11.3249 21.6622C11.3216 21.4014 11.2165 21.1523 11.0321 20.9679C10.8477 20.7835 10.5986 20.6784 10.3378 20.6751C10.0771 20.6717 9.82531 20.7704 9.63625 20.95ZM9 16C9 15.7348 8.89464 15.4804 8.70711 15.2929C8.51957 15.1054 8.26522 15 8 15H4C3.73478 15 3.48043 15.1054 3.29289 15.2929C3.10536 15.4804 3 15.7348 3 16C3 16.2652 3.10536 16.5196 3.29289 16.7071C3.48043 16.8946 3.73478 17 4 17H8C8.26522 17 8.51957 16.8946 8.70711 16.7071C8.89464 16.5196 9 16.2652 9 16ZM8.2225 6.8075C8.03486 6.61986 7.78036 6.51444 7.515 6.51444C7.24964 6.51444 6.99514 6.61986 6.8075 6.8075C6.61986 6.99514 6.51444 7.24964 6.51444 7.515C6.51444 7.78036 6.61986 8.03486 6.8075 8.2225L9.63625 11.05C9.82531 11.2296 10.0771 11.3283 10.3378 11.3249C10.5986 11.3216 10.8477 11.2165 11.0321 11.0321C11.2165 10.8477 11.3216 10.5986 11.3249 10.3378C11.3283 10.0771 11.2296 9.82531 11.05 9.63625L8.2225 6.8075Z";

/** The eight spokes, in clockwise order starting at twelve o'clock. */
const SPOKES = SPINNER_PATH.split(/Z(?=M)/).map((d) =>
  d.endsWith("Z") ? d : `${d}Z`,
);

const CYCLE = 0.88;

export function Spinner({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="spinner"
      style={{ display: "block" }}
    >
      {SPOKES.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="var(--highlight)"
          style={{ animationDelay: `${-(i * CYCLE) / SPOKES.length}s` }}
        />
      ))}
      <style>{`
        .spinner path {
          animation: spoke ${CYCLE}s linear infinite;
        }
        @keyframes spoke {
          0% { opacity: 1; }
          100% { opacity: 0.18; }
        }
        @media (prefers-reduced-motion: reduce) {
          .spinner path { animation: none; opacity: 1; }
          .spinner { animation: spinner-breathe 1.6s ease-in-out infinite; }
        }
        @keyframes spinner-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </svg>
  );
}

/** Square frame shared by the check and the cross, straight from Figma. */
const SQUARE_FRAME =
  "M28 6V26C28 26.5304 27.7893 27.0391 27.4142 27.4142C27.0391 27.7893 26.5304 28 26 28H6C5.46957 28 4.96086 27.7893 4.58579 27.4142C4.21071 27.0391 4 26.5304 4 26V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H26C26.5304 4 27.0391 4.21071 27.4142 4.58579C27.7893 4.96086 28 5.46957 28 6ZM26 26V6H6V26H26Z";

const CHECK_GLYPH =
  "M21.7075 12.2925C21.8005 12.3854 21.8742 12.4957 21.9246 12.6171C21.9749 12.7385 22.0008 12.8686 22.0008 13C22.0008 13.1314 21.9749 13.2615 21.9246 13.3829C21.8742 13.5043 21.8005 13.6146 21.7075 13.7075L14.7075 20.7075C14.6146 20.8005 14.5043 20.8742 14.3829 20.9246C14.2615 20.9749 14.1314 21.0008 14 21.0008C13.8686 21.0008 13.7385 20.9749 13.6171 20.9246C13.4957 20.8742 13.3854 20.8005 13.2925 20.7075L10.2925 17.7075C10.1049 17.5199 9.99944 17.2654 9.99944 17C9.99944 16.7346 10.1049 16.4801 10.2925 16.2925C10.4801 16.1049 10.7346 15.9994 11 15.9994C11.2654 15.9994 11.5199 16.1049 11.7075 16.2925L14 18.5863L20.2925 12.2925C20.3854 12.1995 20.4957 12.1258 20.6171 12.0754C20.7385 12.0251 20.8686 11.9992 21 11.9992C21.1314 11.9992 21.2615 12.0251 21.3829 12.0754C21.5043 12.1258 21.6146 12.1995 21.7075 12.2925Z";

export function CheckSquare({
  size = 32,
  draw = false,
}: {
  size?: number;
  draw?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d={SQUARE_FRAME} fill="var(--highlight)" />
      <path
        d={CHECK_GLYPH}
        fill="var(--highlight)"
        style={
          draw
            ? {
                clipPath: "inset(0 0 0 0)",
                animation: "check-in 260ms cubic-bezier(.2,.9,.3,1) both",
                transformOrigin: "16px 16px",
              }
            : undefined
        }
      />
      <style>{`
        @keyframes check-in {
          from { opacity: 0; transform: scale(.4) rotate(-12deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="check-in"] { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}

/**
 * No cross exists in the Figma file. This reuses the exact square frame from
 * the check icon so the error state is drawn in the same hand.
 */
export function CrossSquare({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d={SQUARE_FRAME} fill="var(--error)" />
      <path
        d="M12 12L20 20M20 12L12 20"
        stroke="var(--error)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Shown when the request failed rather than the code. Same square frame as the
 * other two, in a third colour, so "we could not check" is legible at a glance
 * as a different kind of answer from "that was wrong".
 */
export function WarningSquare({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d={SQUARE_FRAME} fill="var(--warning)" />
      <path
        d="M16 10.5V17.5"
        stroke="var(--warning)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21.5" r="1.25" fill="var(--warning)" />
    </svg>
  );
}
