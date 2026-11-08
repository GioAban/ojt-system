package com.iodev.practicum.util;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Student;

import java.util.List;

/**
 * Ang Midterm at Final Evaluation: mga built-in na DocumentRequirement na binubuksan o isinasara bawat student.
 * Dito lang nagpapasya kung sarado ang isang evaluation. Ang karaniwang requirement ay hindi kailanman sarado.
 */
public final class EvaluationAccess {

    public static final String MIDTERM = "MIDTERM_EVALUATION";
    public static final String FINAL = "FINAL_EVALUATION";

    /** Ayos ng paglabas: Midterm muna bago Final */
    public static final List<String> KEYS = List.of(MIDTERM, FINAL);

    public static final String TYPE = "pre";

    public static final String CLOSED_MESSAGE =
            "This evaluation is closed by your coordinator, so it can't be changed right now.";

    private EvaluationAccess() {}

    public static boolean validKey(String key) {
        return key != null && KEYS.contains(key);
    }

    public static String titleOf(String key) {
        return MIDTERM.equals(key) ? "Midterm Evaluation" : "Final Evaluation";
    }

    public static boolean isBuiltIn(DocumentRequirement r) {
        return r.getSystemKey() != null;
    }

    public static boolean isOpen(Student s, String key) {
        if (MIDTERM.equals(key)) return Boolean.TRUE.equals(s.getOpenMidtermEvaluation());
        if (FINAL.equals(key)) return Boolean.TRUE.equals(s.getOpenFinalEvaluation());
        return false;
    }

    public static void setOpen(Student s, String key, boolean open) {
        if (MIDTERM.equals(key)) s.setOpenMidtermEvaluation(open);
        else if (FINAL.equals(key)) s.setOpenFinalEvaluation(open);
    }

    /** Totoo lang kung built-in ang requirement at sarado ito para sa student */
    public static boolean isClosed(Student s, DocumentRequirement r) {
        return isBuiltIn(r) && !isOpen(s, r.getSystemKey());
    }
}
