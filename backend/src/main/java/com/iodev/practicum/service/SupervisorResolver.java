package com.iodev.practicum.service;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;

import java.util.regex.Pattern;

/**
 * Iisang pinagkukunan ng supervisor ng student.
 * Pagkakasunod: supervisor ng department, tapos immediate supervisor ng company, tapos blangko.
 * Ang N/A (company na walang department) ay walang sariling supervisor: company muna.
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
    /**
     * Contact number: malayang teksto (anumang format, puwedeng higit sa isang numero). Ang tanging tseke ay ang haba,
     * at kung kailangan, na may laman. Kasya sa varchar(255) ng lahat ng contact column.
     */
    public static final int CONTACT_MAX = 255;
    public static final String CONTACT_TOO_LONG = "The contact number is too long (max 255 characters).";

    /** Contact number: trim lang sa dulo (walang binabago sa loob); ang lumang "N/A" ay blangko */
    public static String cleanContact(String v) {
        if (v == null) return "";
        String s = v.trim();
        return s.equalsIgnoreCase("N/A") ? "" : s;
    }

    /** Pareho ng cleanContact() pero null kapag blangko */
    public static String cleanContactOrNull(String v) {
        String s = cleanContact(v);
        return s.isEmpty() ? null : s;
    }

    private SupervisorResolver() {}

    /**
     * Pinagsasaluhang tseke ng supervisor (company, department at hiling ng student).
     * Lahat opsyonal; kapag may pangalan, kailangan ang posisyon, at baliktad. Null kapag walang mali.
     */
    public static String validate(String rawName, String rawPosition, String rawContact, String rawEmail,
                                  String label) {
        String name = clean(rawName);
        String position = clean(rawPosition);
        String contact = cleanContact(rawContact);
        String email = clean(rawEmail);

        if (!name.isEmpty() && position.isEmpty()) return "Enter the " + label + "'s position.";
        if (name.isEmpty() && !position.isEmpty()) return "Enter the " + label + "'s name.";
        if (name.length() > 255 || position.length() > 255) {
            return "The " + label + "'s name or position is too long (max 255 characters).";
        }
        if (contact.length() > CONTACT_MAX) return CONTACT_TOO_LONG;
        if (!email.isEmpty() && (email.length() > 255 || !EMAIL.matcher(email).matches())) {
            return "Enter a valid " + label + " email.";
        }
        return null;
    }

    /**
     * Immediate supervisor ng company: kailangan lahat (pangalan, posisyon, contact number at email), may format.
     * Ang mga field ay may prefix (hal. "supervisor" -> "supervisorName", "supervisorEmail").
     */
    public static void requireAll(FieldErrors errors, String prefix, String rawName, String rawPosition,
                                  String rawContact, String rawEmail) {
        String name = clean(rawName);
        String position = clean(rawPosition);
        String contact = cleanContact(rawContact);
        String email = clean(rawEmail);
        if (name.isEmpty()) errors.add(prefix + "Name", "Enter the immediate supervisor's name.");
        else if (name.length() > 255) errors.add(prefix + "Name", "The name is too long (max 255 characters).");
        if (position.isEmpty()) errors.add(prefix + "Position", "Enter the immediate supervisor's position.");
        else if (position.length() > 255) errors.add(prefix + "Position", "The position is too long (max 255 characters).");
        if (contact.isEmpty()) errors.add(prefix + "ContactNumber", "Enter the immediate supervisor's contact number.");
        else if (contact.length() > CONTACT_MAX) errors.add(prefix + "ContactNumber", CONTACT_TOO_LONG);
        if (email.isEmpty()) errors.add(prefix + "Email", "Enter the immediate supervisor's email.");
        else if (email.length() > 255 || !EMAIL.matcher(email).matches()) errors.add(prefix + "Email", "Enter a valid email address.");
    }

    /**
     * Supervisor ng department: opsyonal, pero magkapares ang pangalan at posisyon; may format ang contact at email.
     * @param prefix hal. "departments[0].supervisor" -> "departments[0].supervisorName"
     */
    public static void optionalPair(FieldErrors errors, String prefix, String rawName, String rawPosition,
                                    String rawContact, String rawEmail) {
        String name = clean(rawName);
        String position = clean(rawPosition);
        String contact = cleanContact(rawContact);
        String email = clean(rawEmail);
        if (!name.isEmpty() && position.isEmpty()) errors.add(prefix + "Position", "Enter the supervisor's position.");
        if (name.isEmpty() && !position.isEmpty()) errors.add(prefix + "Name", "Enter the supervisor's name.");
        if (name.length() > 255) errors.add(prefix + "Name", "The name is too long (max 255 characters).");
        if (position.length() > 255) errors.add(prefix + "Position", "The position is too long (max 255 characters).");
        if (contact.length() > CONTACT_MAX) errors.add(prefix + "ContactNumber", CONTACT_TOO_LONG);
        if (!email.isEmpty() && (email.length() > 255 || !EMAIL.matcher(email).matches())) {
            errors.add(prefix + "Email", "Enter a valid email address.");
        }
    }

    /** Placeholder na department ng company na walang department (blangko o "N/A") */
    public static boolean isPlaceholderDepartment(String name) {
        return name == null || name.isBlank() || name.trim().equalsIgnoreCase("N/A");
    }

    /** Ang ipinapakitang pangalan ng department: "N/A" para sa placeholder */
    public static String departmentLabel(String name) {
        return isPlaceholderDepartment(name) ? "N/A" : name.trim();
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

    /**
     * Totoong department: ang sariling supervisor, kung wala ay ang immediate supervisor ng company.
     * N/A (company na walang department): ang immediate supervisor ng company. Ang lumang supervisor na naka-save
     * sa N/A ay ginagamit lang kapag walang immediate supervisor ang company (lumang datos).
     */
    public static Supervisor forDepartment(Department d) {
        if (d == null) return Supervisor.BLANK;

        Supervisor own = own(d);
        if (isPlaceholderDepartment(d.getName())) {
            Supervisor company = forCompany(d.getCompany());
            return company.isBlank() ? own : company;
        }
        return own.isBlank() ? forCompany(d.getCompany()) : own;
    }

    /** Saan galing ang supervisor na ipinapakita: "department", "company" o "none" (kapareho ng forDepartment) */
    public static String sourceOf(Department d) {
        if (d == null) return "none";
        boolean hasOwn = !own(d).isBlank();
        boolean hasCompany = !forCompany(d.getCompany()).isBlank();
        if (isPlaceholderDepartment(d.getName())) return hasCompany ? "company" : hasOwn ? "department" : "none";
        return hasOwn ? "department" : hasCompany ? "company" : "none";
    }

    /** Ang supervisor na naka-save mismo sa department (blangko kung wala) */
    public static Supervisor own(Department d) {
        if (d == null) return Supervisor.BLANK;
        String name = nz(d.getSupervisorFullname());
        if (name.isEmpty()) return Supervisor.BLANK;
        return new Supervisor(name, nz(d.getSupervisorPosition()),
                cleanContact(d.getSupervisorContactNumber()), nz(d.getSupervisorEmail()));
    }

    public static Supervisor forCompany(Company c) {
        if (c == null) return Supervisor.BLANK;

        String name = nz(c.getImsupFullname());
        if (name.isEmpty()) return Supervisor.BLANK;
        return new Supervisor(name, nz(c.getImsupPosition()),
                cleanContact(c.getImsupContactNumber()), nz(c.getImsupEmail()));
    }

    private static String nz(String v) {
        return clean(v);
    }
}
