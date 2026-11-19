package com.iodev.practicum.service;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/**
 * Mga field ng student na binabago sa Students page at sa mga report. Iisang pagsusuri (parehong mensahe)
 * para sa pagdagdag, pag-import, pag-edit sa Students page, at "Save changes to database" ng report.
 */
@Service
public class StudentProfileService {

    private static final Pattern NUMBER = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9\\-/]{2,49}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Autowired private StudentManagementRepository repository;
    @Autowired private AccountEmailService accountEmails;

    // ---------------------------------------------------------------------
    // Mga validator (ibinabalik ang nilinis na halaga o naghahagis ng ActionException 400)
    // ---------------------------------------------------------------------

    public String validNumber(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) throw ActionException.bad("Student number is required.");
        if (!NUMBER.matcher(v).matches()) throw ActionException.bad("Student number can only have letters, numbers, - and /.");
        return v;
    }

    public String validName(String raw, String label) {
        String v = clean(raw);
        if (v.isEmpty()) throw ActionException.bad(label + " is required.");
        if (v.length() > 100) throw ActionException.bad(label + " is too long (max 100 characters).");
        return v;
    }

    public String validInitial(String raw) {
        String v = clean(raw).replace(".", "");
        if (v.isEmpty()) return null;
        if (v.length() > 3) throw ActionException.bad("Middle initial is too long.");
        return v.toUpperCase();
    }

    public String validGender(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) throw ActionException.bad("Gender is required.");
        if (v.equals("male") || v.equals("m")) return "Male";
        if (v.equals("female") || v.equals("f")) return "Female";
        throw ActionException.bad("Gender must be Male or Female.");
    }

    public String validYear(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) return null;
        String digit = v.replaceAll("[^0-9]", "");
        if (digit.length() == 1 && "12345".contains(digit)) {
            return switch (digit) {
                case "1" -> "1st Year";
                case "2" -> "2nd Year";
                case "3" -> "3rd Year";
                case "4" -> "4th Year";
                default -> "5th Year";
            };
        }
        throw ActionException.bad("Year must be 1st to 5th Year.");
    }

    /** Contact number: malayang teksto (anumang format, puwedeng higit sa isang numero); trim lang. Null kapag blangko. */
    public String validContact(String raw) {
        String v = SupervisorResolver.cleanContact(raw);
        if (v.isEmpty()) return null;
        if (v.length() > SupervisorResolver.CONTACT_MAX) throw ActionException.bad(SupervisorResolver.CONTACT_TOO_LONG);
        return v;
    }

    public String validEmail(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) throw ActionException.bad("Email is required.");
        if (v.length() > 255 || !EMAIL.matcher(v).matches()) throw ActionException.bad("Enter a valid email.");
        return v;
    }

    public String validBirthday(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        LocalDate d = null;
        for (DateTimeFormatter f : List.of(DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("M/d/yyyy"))) {
            try { d = LocalDate.parse(v, f); break; } catch (DateTimeParseException ignored) { }
        }
        if (d == null) throw ActionException.bad("Birthday must look like 2003-05-14.");
        if (d.getYear() < 1950 || d.isAfter(LocalDate.now())) throw ActionException.bad("Birthday is out of range.");
        return d.toString();
    }

    public String validCourse(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 50) throw ActionException.bad("Course is too long (max 50 characters).");
        return v;
    }

    public String validShortText(String raw, String label) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 255) throw ActionException.bad(label + " is too long (max 255 characters).");
        return v;
    }

    public String validAddress(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 255) throw ActionException.bad("Address is too long (max 255 characters).");
        return v;
    }

    /** May account ang student (may email): saka lang mababago ang email, gaya ng Students page */
    public static boolean hasAccount(Student s) {
        return s.getEmail() != null && !s.getEmail().isBlank();
    }

    // ---------------------------------------------------------------------
    // Pag-edit ng isang field
    // ---------------------------------------------------------------------

    /** Pangalan ng field para sa tao (buod ng report at audit) */
    public static String labelOf(String field) {
        return switch (field == null ? "" : field) {
            case "studentNumber" -> "Student number";
            case "lastname" -> "Last name";
            case "firstname" -> "First name";
            case "middleInitial" -> "Middle initial";
            case "gender" -> "Gender";
            case "year" -> "Year";
            case "course" -> "Section / Subject code";
            case "contact" -> "Contact number";
            case "email" -> "Email";
            case "birthday" -> "Birthday";
            case "address" -> "Address";
            case "parent" -> "Parent";
            case "guardian" -> "Guardian";
            default -> field == null ? "" : field;
        };
    }

    /** Ang kasalukuyang halaga ng field (para sa lumang halaga sa buod at sa pagsusuri kung nagbago na) */
    public static String currentValue(Student s, String field) {
        String v = switch (field == null ? "" : field) {
            case "studentNumber" -> s.getStudentNumber();
            case "lastname" -> s.getLastname();
            case "firstname" -> s.getFirstname();
            case "middleInitial" -> s.getMiddleInitial();
            case "gender" -> s.getGender();
            case "year" -> s.getYear();
            case "course" -> s.getSubjectCode();
            case "contact" -> s.getContact();
            case "email" -> s.getEmail();
            case "birthday" -> s.getBirthday();
            case "address" -> s.getAddress();
            case "parent" -> s.getParent();
            case "guardian" -> s.getGuardian();
            default -> null;
        };
        return v == null ? "" : v.trim();
    }

    /**
     * Sinusuri ang isang field gaya ng Students page; ibinabalik ang pagbabagong isusulat.
     * 400 kapag mali ang halaga, 409 kapag may kapareho (student number, email) o walang account (email).
     */
    public PreparedChange check(Student s, String field, String raw) {
        Long semesterId = s.getSemester().getId();
        Long id = s.getId();
        String f = field == null ? "" : field;

        String next;
        Consumer<String> set;
        switch (f) {
            case "studentNumber" -> {
                next = validNumber(raw);
                if (repository.numberExistsExcluding(next, semesterId, id)) {
                    throw ActionException.conflict("That student number already exists in this semester.");
                }
                set = s::setStudentNumber;
            }
            case "lastname" -> { next = validName(raw, "Last name"); set = s::setLastname; }
            case "firstname" -> { next = validName(raw, "First name"); set = s::setFirstname; }
            case "middleInitial" -> { next = validInitial(raw); set = s::setMiddleInitial; }
            case "gender" -> { next = validGender(raw); set = s::setGender; }
            case "year" -> { next = validYear(raw); set = s::setYear; }
            case "course" -> {
                next = validCourse(raw);
                if (next == null) throw ActionException.bad("Course is required.");
                set = s::setSubjectCode;
            }
            case "contact" -> { next = validContact(raw); set = s::setContact; }
            case "email" -> {
                if (!hasAccount(s)) {
                    throw ActionException.conflict("Create the account first, then you can change the email.");
                }
                next = validEmail(raw);
                if (accountEmails.inUse(next, AccountEmailService.Exclude.student(id))) {
                    throw ActionException.conflict(AccountEmailService.IN_USE);
                }
                set = s::setEmail;
            }
            case "birthday" -> { next = validBirthday(raw); set = s::setBirthday; }
            case "address" -> { next = validAddress(raw); set = s::setAddress; }
            case "parent" -> { next = validShortText(raw, "Parent"); set = s::setParent; }
            case "guardian" -> { next = validShortText(raw, "Guardian"); set = s::setGuardian; }
            default -> throw ActionException.bad("That field can't be edited here.");
        }

        String old = currentValue(s, f);
        String value = next;
        if (old.equals(value == null ? "" : value)) return new PreparedChange(labelOf(f), old, old, 1, null);
        return new PreparedChange(labelOf(f), old, value == null ? "" : value, 1, () -> {
            set.accept(value);
            repository.save(s);
        });
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
