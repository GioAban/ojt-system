package com.iodev.practicum.service;

import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import com.iodev.practicum.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Iisang tuntunin: isang email, isang account sa buong sistema. Tinitingnan ang users (coordinator/staff),
 * directors, students (kasama ang archived at revoked) at ang PENDING na registration.
 * Ang VERIFIED na registration ay may Student na, kaya ang students table na ang bahala roon.
 * Hindi binibilang ang EMAIL_PENDING, REJECTED at REVOKED na registration.
 * Trim at lower-case ang paghahambing, kaya hindi umaasa sa collation ng database.
 */
@Service
public class AccountEmailService {

    /** Parehong mensahe sa lahat ng endpoint (409) */
    public static final String IN_USE = "This email is already in use.";

    /** Ang account na ine-edit, para hindi nito harangan ang sarili niyang email */
    public record Exclude(Long userId, Long studentId, Long registrationId) {
        public static final Exclude NONE = new Exclude(null, null, null);

        public static Exclude user(Long id) { return new Exclude(id, null, null); }
        public static Exclude student(Long id) { return new Exclude(null, id, null); }
        public static Exclude registration(Long id) { return new Exclude(null, null, id); }
    }

    private final UserRepository users;
    private final DirectorRepository directors;
    private final StudentManagementRepository students;
    private final StudentRegistrationRepository registrations;

    public AccountEmailService(UserRepository users, DirectorRepository directors,
                               StudentManagementRepository students, StudentRegistrationRepository registrations) {
        this.users = users;
        this.directors = directors;
        this.students = students;
        this.registrations = registrations;
    }

    public static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /** True kapag may ibang account na gumagamit ng email; walang laman = false */
    public boolean inUse(String email, Exclude self) {
        String e = normalize(email);
        if (e.isEmpty()) return false;
        Exclude x = self == null ? Exclude.NONE : self;

        boolean user = x.userId() == null
                ? users.emailInUse(e)
                : users.emailInUseExcluding(e, x.userId());
        if (user) return true;
        if (directors.emailInUse(e)) return true;
        boolean student = x.studentId() == null
                ? students.emailExists(e)
                : students.emailExistsExcluding(e, x.studentId());
        if (student) return true;
        return registrations.emailTaken(e, x.registrationId());
    }
}
