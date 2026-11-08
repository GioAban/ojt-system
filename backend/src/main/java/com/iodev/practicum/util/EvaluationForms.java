package com.iodev.practicum.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Ang nilalaman ng papel na Midterm at Final Evaluation. Hindi ito nababago ng coordinator sa ngayon. */
public final class EvaluationForms {

    public record Criterion(String category, String name, BigDecimal weight) {}

    private static final String WORK = "Work Performance";
    private static final String TRAITS = "Personal Traits";
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private static final List<Criterion> MIDTERM = midterm();
    private static final List<Criterion> FINAL = finalForm();

    private EvaluationForms() {}

    public static List<Criterion> criteria(String key) {
        return EvaluationAccess.MIDTERM.equals(key) ? MIDTERM : FINAL;
    }

    public static String evaluationType(String key) {
        return EvaluationAccess.MIDTERM.equals(key) ? "midterm" : "final";
    }

    public static String scoreType(String key) {
        return EvaluationAccess.MIDTERM.equals(key) ? "rating" : "percentage";
    }

    /** Midterm: buong bilang na 1 hanggang 5. Final: 0 hanggang 100, hanggang dalawang decimal. */
    public static boolean validScore(String key, BigDecimal score) {
        if (EvaluationAccess.MIDTERM.equals(key)) {
            return score.compareTo(BigDecimal.ONE) >= 0 && score.compareTo(new BigDecimal("5")) <= 0
                    && score.stripTrailingZeros().scale() <= 0;
        }
        return score.signum() >= 0 && score.compareTo(HUNDRED) <= 0 && score.stripTrailingZeros().scale() <= 2;
    }

    /** Puntos ng isang criterion sa kabuuan: rating mismo sa Midterm, grade × weight sa Final */
    public static BigDecimal points(BigDecimal score, BigDecimal weight) {
        return weight == null ? score : score.multiply(weight).divide(HUNDRED, 4, RoundingMode.HALF_UP);
    }

    /** Midterm: kabuuan ÷ pinakamataas × 100. Final: ang kabuuan ay sa 100 na. */
    public static BigDecimal normalized(String key, BigDecimal original, int criteriaCount) {
        if (!EvaluationAccess.MIDTERM.equals(key)) return original.setScale(2, RoundingMode.HALF_UP);
        return original.multiply(HUNDRED).divide(new BigDecimal(criteriaCount * 5), 2, RoundingMode.HALF_UP);
    }

    private static List<Criterion> midterm() {
        List<Criterion> out = new ArrayList<>();
        for (String name : List.of("Knowledge of Work", "Quality and Quantity of Work", "Punctuality / Attendance",
                "Communication Skills", "Rapport with employees")) {
            out.add(new Criterion(WORK, name, null));
        }
        for (String name : List.of("Physical Appearance / Grooming", "Ability to follow directions", "Courtesy",
                "Initiative", "Drive and Leadership", "Interest / Motivation", "Reliability", "Mental Maturity",
                "Emotional Maturity", "Interpersonal Maturity")) {
            out.add(new Criterion(TRAITS, name, null));
        }
        return List.copyOf(out);
    }

    private static List<Criterion> finalForm() {
        List<Criterion> out = new ArrayList<>();
        out.add(new Criterion(null, "Knowledge of the Work Assigned", new BigDecimal("20")));
        out.add(new Criterion(null, "Efficiency", new BigDecimal("10")));
        out.add(new Criterion(null, "Quality of Work", new BigDecimal("10")));
        for (String name : List.of("Cleanliness and Orderliness of Work", "Handling of Office Equipments and Materials",
                "Personality", "Attendance", "Punctuality", "Honesty", "Initiative", "Courtesy and Respect",
                "Rapport with Co-workers", "Uniform / Dress Code", "Reliability", "Sense of Humor")) {
            out.add(new Criterion(null, name, new BigDecimal("5")));
        }
        return List.copyOf(out);
    }
}
