// ponytail: simple filter(Boolean).join(" "); upgrade to clsx + tailwind-merge if Tailwind class collision deduplication needed.
export function cn(...inputs: (string | undefined | null | false | boolean)[]): string {
  return inputs.filter(Boolean).join(" ");
}
