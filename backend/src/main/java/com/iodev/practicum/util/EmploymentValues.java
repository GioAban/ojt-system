package com.iodev.practicum.util;

public final class EmploymentValues {

    private EmploymentValues() {}

    /** "somewhat_related" (database) -> "SOMEWHAT_RELATED" (API) */
    public static String jobKey(String stored) {
        if (stored == null) return null;
        return switch (stored.trim().toLowerCase().replace('-', '_').replace(' ', '_')) {
            case "related" -> "RELATED";
            case "somewhat_related" -> "SOMEWHAT_RELATED";
            case "unrelated" -> "UNRELATED";
            default -> null;
        };
    }

    public static String jobStored(String key) {
        if (key == null) return null;
        return switch (key.trim().toUpperCase()) {
            case "RELATED" -> "related";
            case "SOMEWHAT_RELATED" -> "somewhat_related";
            case "UNRELATED" -> "unrelated";
            default -> null;
        };
    }

    /** "High" (database) -> "HIGH" (API) */
    public static String levelKey(String stored) {
        if (stored == null) return null;
        return switch (stored.trim().toLowerCase()) {
            case "high" -> "HIGH";
            case "average" -> "AVERAGE";
            case "low" -> "LOW";
            default -> null;
        };
    }

    public static String levelStored(String key) {
        if (key == null) return null;
        return switch (key.trim().toUpperCase()) {
            case "HIGH" -> "High";
            case "AVERAGE" -> "Average";
            case "LOW" -> "Low";
            default -> null;
        };
    }
}