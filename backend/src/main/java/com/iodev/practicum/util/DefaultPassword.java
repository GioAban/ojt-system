package com.iodev.practicum.util;

import com.iodev.practicum.model.Student;

import java.util.Locale;

/**
 * Default password ng student: Student ID + unang letra ng last name + huling letra ng first name,
 * lahat lowercase. Halimbawa: 2021-00123, Dela Cruz, Juan -> 2021-00123dn
 */
public final class DefaultPassword {

    private DefaultPassword() {}

    public static String of(Student s) {
        String id = s.getStudentNumber() == null ? "" : s.getStudentNumber().trim();
        return id + firstLetter(s.getLastname()) + lastLetter(s.getFirstname());
    }

    private static String firstLetter(String name) {
        if (name == null) return "";
        for (int i = 0; i < name.length(); i++) {
            if (Character.isLetter(name.charAt(i))) {
                return String.valueOf(name.charAt(i)).toLowerCase(Locale.ROOT);
            }
        }
        return "";
    }

    private static String lastLetter(String name) {
        if (name == null) return "";
        for (int i = name.length() - 1; i >= 0; i--) {
            if (Character.isLetter(name.charAt(i))) {
                return String.valueOf(name.charAt(i)).toLowerCase(Locale.ROOT);
            }
        }
        return "";
    }
}
