package com.iodev.practicum.util;

import java.util.Map;

/**
 * Isang pinagmulan ng pangalan ng status ng mga isinumite (requirements, weekly reports, DTR).
 * Ito ang isinusulat sa database: Assigned, For Checking, Checked, Invalid.
 * Sa pagbasa, hindi mahalaga ang laki ng letra o kung may underscore ("for_checking", "For checking").
 */
public final class SubmissionStatus {

    public static final String ASSIGNED = "Assigned";
    public static final String FOR_CHECKING = "For Checking";
    public static final String CHECKED = "Checked";
    public static final String INVALID = "Invalid";

    private static final Map<String, String> STORED = Map.of(
            "ASSIGNED", ASSIGNED,
            "FOR_CHECKING", FOR_CHECKING,
            "CHECKED", CHECKED,
            "INVALID", INVALID);

    private SubmissionStatus() {}

    /** ASSIGNED / FOR_CHECKING / CHECKED / INVALID -> pangalang isusulat sa database; null kung mali */
    public static String stored(String key) {
        return key == null ? null : STORED.get(key.trim().toUpperCase());
    }

    /** Anumang nakasulat sa database -> ASSIGNED / FOR_CHECKING / CHECKED / INVALID */
    public static String key(String raw) {
        if (raw == null) return "ASSIGNED";
        return switch (raw.trim().toLowerCase().replace('_', ' ')) {
            case "checked" -> "CHECKED";
            case "for checking" -> "FOR_CHECKING";
            case "invalid" -> "INVALID";
            default -> "ASSIGNED";
        };
    }

    public static boolean isChecked(String raw) {
        return "CHECKED".equals(key(raw));
    }
}
