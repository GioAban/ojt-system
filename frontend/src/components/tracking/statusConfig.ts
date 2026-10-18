import { CircleCheck, CircleDashed, CircleX, Clock } from "lucide-react";
import type { TrackingStatus } from "@/types/tracking";
import type { ReviewRating } from "@/types/review";

/** Hitsura at pangalan ng bawat status ng isinumite */
export const STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    short: string;
    Icon: typeof CircleCheck;
    iconClass: string;
    chipClass: string;
  }
> = {
  ASSIGNED: {
    label: "Assigned",
    short: "Assigned",
    Icon: CircleDashed,
    iconClass: "text-muted-foreground/60",
    chipClass: "border-dashed text-muted-foreground hover:bg-muted",
  },
  FOR_CHECKING: {
    label: "For checking",
    short: "Checking",
    Icon: Clock,
    iconClass: "text-amber-500",
    chipClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  CHECKED: {
    label: "Checked",
    short: "Checked",
    Icon: CircleCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  INVALID: {
    label: "Invalid",
    short: "Invalid",
    Icon: CircleX,
    iconClass: "text-destructive",
    chipClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export const STATUS_ORDER: TrackingStatus[] = [
  "ASSIGNED",
  "FOR_CHECKING",
  "CHECKED",
  "INVALID",
];

export const RATING_LABEL: Record<ReviewRating, string> = {
  EXCELLENT: "Excellent",
  VERY_GOOD: "Very Good",
  GOOD: "Good",
  POOR: "Poor",
};

export const RATING_ORDER: ReviewRating[] = [
  "EXCELLENT",
  "VERY_GOOD",
  "GOOD",
  "POOR",
];
