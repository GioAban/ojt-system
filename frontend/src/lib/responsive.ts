/**
 * Para sa mga simpleng listahang table: sa ilalim ng md, bawat row ay nagiging card.
 * Ilagay sa <Table className={stackedTable}> at lagyan ng data-label ang mga cell
 * na kailangan ng label (hal. <TableCell data-label="Status">). Walang label ang cell kapag wala ito.
 * Ang wrapper ng table ay gawing transparent sa mobile gamit ang stackedTableWrap.
 */
export const stackedTable = [
  "max-md:block",
  "max-md:[&_thead]:hidden",
  "max-md:[&_tbody]:flex max-md:[&_tbody]:flex-col max-md:[&_tbody]:gap-3",
  "max-md:[&_tbody_tr]:relative max-md:[&_tbody_tr]:flex max-md:[&_tbody_tr]:flex-col max-md:[&_tbody_tr]:gap-1 max-md:[&_tbody_tr]:rounded-xl max-md:[&_tbody_tr]:border max-md:[&_tbody_tr]:p-3",
  // bg-card lang kapag walang sariling kulay ang row (hal. pending o selected)
  "max-md:[&_tbody_tr:not([class*='_bg-'])]:bg-card",
  "max-md:[&_tbody_td]:block max-md:[&_tbody_td]:w-full max-md:[&_tbody_td]:px-0 max-md:[&_tbody_td]:py-1 max-md:[&_tbody_td]:whitespace-normal max-md:[&_tbody_td]:text-left max-md:[&_tbody_td]:break-words",
  "max-md:[&_tbody_td[data-label]]:before:mb-0.5 max-md:[&_tbody_td[data-label]]:before:block max-md:[&_tbody_td[data-label]]:before:text-xs max-md:[&_tbody_td[data-label]]:before:font-medium max-md:[&_tbody_td[data-label]]:before:text-muted-foreground max-md:[&_tbody_td[data-label]]:before:content-[attr(data-label)]",
].join(" ");

/** Wrapper ng stackedTable: may border at background sa desktop lang, dahil card na ang bawat row sa mobile */
export const stackedTableWrap =
  "max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0";

/** Lalagyan ng action buttons sa loob ng stacked na cell: nasa kanan sa desktop, nasa kaliwa at nagwa-wrap sa mobile */
export const stackedActions = "flex flex-wrap justify-start gap-1.5 md:flex-nowrap md:justify-end";
