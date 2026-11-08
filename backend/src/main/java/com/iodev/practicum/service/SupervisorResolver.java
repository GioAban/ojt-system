package com.iodev.practicum.service;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;

import java.util.regex.Pattern;

/**
 * Iisang pinagkukunan ng supervisor ng student.
 * Pagkakasunod: supervisor ng department, tapos immediate supervisor ng company, tapos blangko.
 * Buong record ang kinukuha sa iisang source para hindi maghalo ang pangalan at posisyon ng magkaibang tao.
 */
public final class SupervisorResolver {

    public record Supervisor(String name, String position, String contactNumber, String email) {
        public static final Supervisor BLANK = new Supervisor("", "", "", "");

        public boolean isBlank() { return name.isEmpty(); }

        /** null kapag blangko, para sa mga response na dati nang null ang walang laman */
        public String nameOrNull() { return name.isEmpty() ? null : name; }
        public String positionOrNull() { return position.isEmpty() ? null : position; }
        public String contactNumberOrNull() { return contactNumber.isEmpty() ? null : contactNumber; }
        public String emailOrNull() { return email.isEmpty() ? null : email; }
    }

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{7,20}$");

    private SupervisorResolver() {}

    /**
     * Pinagsasaluhang tseke ng supervisor (company, department at hiling ng student).
     * Lahat opsyonal; kapag may pangalan, kailangan ang posisyon, at baliktad. Null kapag walang mali.
     */
    public static String validate(String rawName, String rawPosition, String rawContact, String rawEmail,
                                  String label) {
        String name = clean(rawName);
        String position = clean(rawPosition);
        String contact = clean(rawContact);
        String email = clean(rawEmail);

        if (!name.isEmpty() && position.isEmpty()) return "Enter the " + label + "'s position.";
        if (name.isEmpty() && !position.isEmpty()) return "Enter the " + label + "'s name.";
        if (name.length() > 255 || position.length() > 255) {
            return "The " + label + "'s name or position is too long (max 255 characters).";
        }
        if (!contact.isEmpty() && !PHONE.matcher(contact).matches()) {
            return "Enter a valid " + label + " contact number.";
        }
        if (!email.isEmpty() && (email.length() > 255 || !EMAIL.matcher(email).matches())) {
            return "Enter a valid " + label + " email.";
        }
        return null;
    }

    /** May laman ba kahit isang field ng supervisor */
    public static boolean anyFilled(String... values) {
        for (String v : values) {
            if (!clean(v).isEmpty()) return true;
        }
        return false;
    }

    /**
     * Nililinis ang isang field ng supervisor: trim, pinagsasama ang espasyo, at itinuturing na blangko
     * ang lumang placeholder na "N/A" para hindi ito lumabas o maibalik sa pag-save.
     */
    public static String clean(String v) {
        if (v == null) return "";
        String s = v.trim().replaceAll("\\s+", " ");
        return s.equalsIgnoreCase("N/A") ? "" : s;
    }

    /** Pareho ng clean() pero null kapag blangko (para sa mga response) */
    public static String cleanOrNull(String v) {
        String s = clean(v);
        return s.isEmpty() ? null : s;
    }

    public static Supervisor forStudent(Student student) {
        return student == null ? Supervisor.BLANK : forDepartment(student.getDepartment());
    }

    public static Supervisor forDepartment(Department d) {
        if (d == null) return Supervisor.BLANK;

        String name = nz(d.getSupervisorFullname());
        if (!name.isEmpty()) {
            return new Supervisor(name, nz(d.getSupervisorPosition()),
                    nz(d.getSupervisorContactNumber()), nz(d.getSupervisorEmail()));
        }
        return forCompany(d.getCompany());
    }

    public static Supervisor forCompany(Company c) {
        if (c == null) return Supervisor.BLANK;

        String name = nz(c.getImsupFullname());
        if (name.isEmpty()) return Supervisor.BLANK;
        return new Supervisor(name, nz(c.getImsupPosition()),
                nz(c.getImsupContactNumber()), nz(c.getImsupEmail()));
    }

    private static String nz(String v) {
        return clean(v);
    }
}
