package com.iodev.practicum.service;

import java.util.Set;

/** Pang-normalize ng pangalan ng company/department para mahuli ang duplicate (hal. "ABC Corp." = "abc corporation"). */
public final class CompanyMatch {

    private static final Set<String> NOISE = Set.of(
            "inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited",
            "the", "of", "and", "phils", "philippines", "ph");

    private CompanyMatch() {}

    public static String normalize(String s) {
        if (s == null) return "";
        String cleaned = s.toLowerCase().replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
        StringBuilder out = new StringBuilder();
        for (String w : cleaned.split(" ")) {
            if (w.isEmpty() || NOISE.contains(w)) continue;
            if (out.length() > 0) out.append(' ');
            out.append(w);
        }
        // kung puro noise ang pangalan, gamitin ang buo
        return out.length() == 0 ? cleaned : out.toString();
    }

    /** Magkapareho o ang isa ay nakapaloob sa isa (hindi bababa sa 4 na letra) */
    public static boolean similar(String a, String b) {
        String x = normalize(a), y = normalize(b);
        if (x.isEmpty() || y.isEmpty()) return false;
        if (x.equals(y)) return true;
        String sx = x.replace(" ", ""), sy = y.replace(" ", "");
        if (sx.equals(sy)) return true;
        return Math.min(sx.length(), sy.length()) >= 4 && (sx.contains(sy) || sy.contains(sx));
    }

    public static boolean sameDepartment(String a, String b) {
        String x = a == null || a.isBlank() ? "n/a" : a.toLowerCase().replaceAll("[^a-z0-9]", "");
        String y = b == null || b.isBlank() ? "n/a" : b.toLowerCase().replaceAll("[^a-z0-9]", "");
        return x.equals(y);
    }
}
